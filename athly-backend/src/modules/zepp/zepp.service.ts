import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { buildFitPlan } from '../connect-iq/fit/workout-fit-plan';
import { toWatchPlan } from '../connect-iq/fit/workout-watch-plan';
import { calculateHeartRateZones } from '../users/heart-rate-zones';
import { localCalendar, addCalendarDays } from '../ai-planner/weekly-calendar';
import {
  digest,
  seal,
  unseal,
  validateDownloadUrl,
  parseEvents,
  fitSummary,
  zeppSteps,
} from './zepp-codec';

@Injectable()
export class ZeppService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;
  private busy = false;
  constructor(private readonly db: PrismaService) {}
  get enabled() {
    return process.env.ZEPP_ENABLED === 'true';
  }
  private get automaticWorkoutsEnabled() {
    return process.env.ZEPP_WORKOUTS_VALIDATED === 'true';
  }
  private get workoutsEnabled() {
    return (
      this.enabled &&
      (this.automaticWorkoutsEnabled || process.env.ZEPP_WORKOUTS_MANUAL_ENABLED === 'true')
    );
  }
  private config(name: string): string {
    const v = process.env[name];
    if (!v) throw new ServiceUnavailableException('Integração Zepp não configurada');
    return v;
  }
  private requireEnabled() {
    if (!this.enabled) throw new ServiceUnavailableException('Integração Zepp ainda indisponível');
  }
  private encrypt(s: string) {
    return seal(s, this.config('ZEPP_TOKEN_KEY'));
  }
  private decrypt(s: string) {
    return unseal(s, this.config('ZEPP_TOKEN_KEY'));
  }
  async status(userId: string) {
    const c = await this.db.zeppConnection.findUnique({ where: { userId } });
    return {
      enabled: this.enabled,
      connected: c?.connected ?? false,
      lastSyncAt: c?.lastSyncAt ?? null,
      error: c?.error ?? null,
      workoutsEnabled: this.workoutsEnabled,
      historyImportAvailable: true,
      backfillRequestedAt: c?.backfillRequestedAt ?? null,
      backfillRequestId: c?.backfillRequestId ?? null,
      backfillError: c?.backfillError ?? null,
    };
  }
  async authorize(userId: string, timeZone: string) {
    this.requireEnabled();
    try {
      new Intl.DateTimeFormat('en', { timeZone }).format();
    } catch {
      throw new BadRequestException('Fuso inválido');
    }
    const state = randomBytes(32).toString('hex');
    const data = {
      timeZone,
      stateHash: digest(state),
      stateExpiresAt: new Date(Date.now() + 600_000),
    };
    await this.db.zeppConnection.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    const q = new URLSearchParams({
      client_id: this.config('ZEPP_CLIENT_ID'),
      response_type: 'code',
      state,
      token: '["access","refresh"]',
    });
    return { url: `https://user.zepp.com/oauth2/index.html#/login?${q}` };
  }
  private async tokenRequest(kind: 'access_token' | 'refresh_token', value: string) {
    const fields = {
      client_id: this.config('ZEPP_CLIENT_ID'),
      client_secret: this.config('ZEPP_CLIENT_SECRET'),
      grant_type: kind === 'access_token' ? 'authorization_code' : 'refresh_token',
      ...(kind === 'access_token'
        ? { code: value, redirect_uri: this.config('ZEPP_REDIRECT_URI') }
        : { refresh_token: value }),
    };
    const response = await fetch(`https://auth.zepp.com/v2/oauth2/${kind}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(kind === 'refresh_token' ? { Authorization: `Bearer ${value}` } : {}),
      },
      body: new URLSearchParams(fields),
      signal: AbortSignal.timeout(30_000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Autorização Zepp falhou; conecte novamente.');
    const t = await response.json();
    if (!t.access_token || !t.refresh_token || !Number.isFinite(t.expires_in) || t.expires_in <= 0)
      throw new Error('Resposta OAuth inválida');
    return t;
  }
  async callback(state: string, code?: string) {
    this.requireEnabled();
    if (!state) throw new BadRequestException('Estado inválido');
    const c = await this.db.zeppConnection.findFirst({
      where: { stateHash: digest(state), stateExpiresAt: { gt: new Date() } },
    });
    if (!c) throw new BadRequestException('Autorização expirada');
    const consumed = await this.db.zeppConnection.updateMany({
      where: { userId: c.userId, stateHash: digest(state) },
      data: { stateHash: null, stateExpiresAt: null },
    });
    if (!consumed.count || !code) throw new BadRequestException('Autorização cancelada');
    const t = await this.tokenRequest('access_token', code);
    if (!t.user_id) throw new BadRequestException('Conta Zepp ausente');
    await this.db.zeppConnection.update({
      where: { userId: c.userId },
      data: {
        zeppUserId: String(t.user_id),
        tokens: this.encrypt(JSON.stringify(t)),
        connected: true,
        expiresAt: new Date(Date.now() + t.expires_in * 1000),
        nextSyncAt: new Date(),
        syncHash: null,
        error: null,
      },
    });
    return 'Athly conectada ao Zepp. Você pode fechar esta janela e voltar à Athly.';
  }
  private async access(userId: string) {
    const c = await this.db.zeppConnection.findUniqueOrThrow({ where: { userId } });
    if (!c.connected || !c.tokens) throw new Error('Conecte sua conta Zepp');
    let t = JSON.parse(this.decrypt(c.tokens));
    if (!c.expiresAt || c.expiresAt.getTime() < Date.now() + 60_000) {
      t = await this.tokenRequest('refresh_token', t.refresh_token);
      await this.db.zeppConnection.updateMany({
        where: { userId, connected: true, tokens: c.tokens },
        data: {
          tokens: this.encrypt(JSON.stringify(t)),
          expiresAt: new Date(Date.now() + t.expires_in * 1000),
        },
      });
    }
    return t.access_token as string;
  }
  private async api(userId: string, path: string, body?: unknown) {
    const response = await fetch(`https://api-open.zepp.com${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await this.access(userId)}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
      redirect: 'error',
    });
    if (!response.ok) {
      if (path.startsWith('/users/-/workouts')) {
        if (response.status === 401 || response.status === 403)
          throw new ServiceUnavailableException(
            'A Zepp recusou o envio. Reconecte a conta e confira a permissão Training Plan.',
          );
        throw new ServiceUnavailableException(
          `A Zepp não aceitou os treinos (HTTP ${response.status}). Tente novamente mais tarde.`,
        );
      }
      throw new Error(`Zepp HTTP ${response.status}`);
    }
    const text = await response.text();
    const result = text ? JSON.parse(text) : null;
    if (
      (path.startsWith('/users/-/workouts') && result?.code !== 1) ||
      (result && result.code < 0)
    ) {
      throw new ServiceUnavailableException(
        'Zepp recusou a sincronização. Confira a permissão Training Plan e a compatibilidade dos treinos.',
      );
    }
  }
  async disconnect(userId: string) {
    this.requireEnabled();
    await this.api(userId, '/users/-/thirdparty/unauthorize');
    await this.clear(userId);
    return {};
  }
  private async clear(userId: string) {
    await this.db.$transaction([
      this.db.zeppConnection.updateMany({
        where: { userId },
        data: {
          connected: false,
          zeppUserId: null,
          tokens: null,
          expiresAt: null,
          leaseUntil: null,
          stateHash: null,
          stateExpiresAt: null,
          syncHash: null,
          error: null,
          backfillRequestedAt: null,
          backfillRequestId: null,
          backfillError: null,
        },
      }),
      this.db.zeppActivity.deleteMany({ where: { userId } }),
    ]);
  }
  async requestSync(userId: string) {
    this.requireEnabled();
    if (!this.workoutsEnabled)
      throw new ServiceUnavailableException('Envio de treinos ainda indisponível.');
    const connection = await this.db.zeppConnection.findUnique({ where: { userId } });
    if (!connection?.connected)
      throw new BadRequestException('Conecte sua conta Zepp antes de enviar treinos.');
    const now = new Date();
    const lease = new Date(now.getTime() + 120_000);
    const claim = await this.db.zeppConnection.updateMany({
      where: {
        userId,
        connected: true,
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      data: { leaseUntil: lease },
    });
    if (!claim.count)
      throw new HttpException(
        'Já existe um envio em andamento. Aguarde e atualize a conexão.',
        409,
      );
    try {
      // Manual sends await the provider receipt; queued work is not delivery confirmation.
      const result = await this.sync(userId, connection.timeZone, null);
      return { status: 'ACCEPTED', ...result };
    } catch (e) {
      const message =
        e instanceof HttpException
          ? e.message
          : 'Não foi possível confirmar o envio à Zepp. Atualize a conexão e tente novamente.';
      await this.db.zeppConnection.updateMany({
        where: { userId, leaseUntil: lease },
        data: { error: message },
      });
      if (e instanceof HttpException) throw e;
      throw new ServiceUnavailableException(message);
    } finally {
      await this.db.zeppConnection.updateMany({
        where: { userId, leaseUntil: lease },
        data: { leaseUntil: null, nextSyncAt: new Date(Date.now() + 300_000) },
      });
    }
  }
  async requestBackfill(userId: string, startTime: number, endTime: number) {
    this.requireEnabled();
    const now = new Date();
    if (
      !Number.isSafeInteger(startTime) ||
      !Number.isSafeInteger(endTime) ||
      startTime < 0 ||
      endTime < startTime ||
      endTime - startTime > 30 * 86400 ||
      endTime > Math.floor(now.getTime() / 1000) + 60
    )
      throw new BadRequestException('Escolha um período passado de até 30 dias.');
    const connection = await this.db.zeppConnection.findUnique({ where: { userId } });
    if (!connection?.connected || !connection.tokens)
      throw new BadRequestException('Conecte sua conta Zepp antes de buscar corridas.');
    if (
      connection.backfillRequestId &&
      connection.backfillRequestedAt &&
      now.getTime() - connection.backfillRequestedAt.getTime() < 300_000 &&
      connection.backfillWindowStart === startTime &&
      (connection.backfillWindowEnd ?? 0) >= endTime - 300
    ) {
      return { requestId: connection.backfillRequestId, status: 'ACCEPTED' as const };
    }
    // Persistent per-account cooldown also prevents simultaneous requests across replicas.
    const claim = await this.db.zeppConnection.updateMany({
      where: {
        userId,
        connected: true,
        tokens: connection.tokens,
        OR: [
          { backfillRequestedAt: null },
          { backfillRequestedAt: { lt: new Date(now.getTime() - 60_000) } },
        ],
      },
      data: {
        backfillRequestedAt: now,
        backfillRequestId: null,
        backfillError: null,
        backfillWindowStart: startTime,
        backfillWindowEnd: endTime,
      },
    });
    if (!claim.count) throw new HttpException('Aguarde um minuto antes de pedir outra busca.', 429);
    try {
      const query = new URLSearchParams({
        summaryStartTimeInSeconds: String(startTime),
        summaryEndTimeInSeconds: String(endTime),
      });
      const response = await fetch(
        `https://api-open.zepp.com/wellness-api/rest/backfill/activities?${query}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${await this.access(userId)}` },
          signal: AbortSignal.timeout(30_000),
          redirect: 'error',
        },
      );
      if (response.status === 429)
        throw new HttpException(
          'A Zepp limitou as buscas. Aguarde antes de tentar novamente.',
          429,
        );
      if (response.status === 401 || response.status === 403)
        throw new BadRequestException(
          'A Zepp recusou o acesso ao histórico. Reconecte a conta e confira a permissão Sport.',
        );
      if (response.status !== 202)
        throw new ServiceUnavailableException(
          'A Zepp não confirmou a busca. Tente novamente mais tarde.',
        );
      const result = await response.json();
      if (
        result?.status !== 'ACCEPTED' ||
        typeof result.requestId !== 'string' ||
        !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(result.requestId)
      )
        throw new ServiceUnavailableException('Resposta de histórico inválida da Zepp.');
      await this.db.zeppConnection.updateMany({
        where: { userId, connected: true, backfillRequestedAt: now },
        data: { backfillRequestId: result.requestId },
      });
      return { requestId: result.requestId as string, status: 'ACCEPTED' as const };
    } catch (error) {
      const failure =
        error instanceof HttpException
          ? error
          : new ServiceUnavailableException(
              'Não foi possível confirmar a busca na Zepp. Aguarde e tente novamente.',
            );
      await this.db.zeppConnection.updateMany({
        where: { userId, connected: true, backfillRequestedAt: now },
        data: { backfillError: failure.message },
      });
      throw failure;
    }
  }
  async webhook(body: unknown) {
    this.requireEnabled();
    let events: Record<string, any>[];
    try {
      events = parseEvents(body);
    } catch {
      throw new BadRequestException('Webhook inválido');
    }
    for (const event of events) {
      if (event.eventType === 'authorizationChange' && event.changeType === 'delete') {
        const c = await this.db.zeppConnection.findFirst({
          where: { zeppUserId: String(event.userId), connected: true },
        });
        if (c) await this.clear(c.userId);
      }
      if (
        event.activityFiles !== undefined &&
        (!Array.isArray(event.activityFiles) || event.activityFiles.length > 100)
      )
        throw new BadRequestException('Lote inválido');
      for (const item of event.activityFiles ?? []) {
        if (item.fileType !== 'FIT') continue;
        if (
          typeof item.summaryId !== 'string' ||
          item.summaryId.length > 128 ||
          typeof item.userId !== 'string'
        )
          throw new BadRequestException('Atividade inválida');
        let url: string;
        try {
          url = validateDownloadUrl(item.callbackURL);
        } catch {
          throw new BadRequestException('URL inválida');
        }
        const c = await this.db.zeppConnection.findFirst({
          where: { zeppUserId: item.userId, connected: true },
        });
        if (!c) continue;
        await this.db.zeppActivity.upsert({
          where: { userId_summaryId: { userId: c.userId, summaryId: item.summaryId } },
          create: { userId: c.userId, summaryId: item.summaryId, downloadUrl: this.encrypt(url) },
          update: {},
        });
      }
    }
    return {};
  }
  async candidates(userId: string, workoutId: string, start: number, end: number, cursor?: string) {
    this.requireEnabled();
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end <= start ||
      end - start > 30 * 86400
    )
      throw new BadRequestException('Período inválido');
    if (!(await this.db.workout.findFirst({ where: { id: workoutId, userId } })))
      throw new NotFoundException();
    const links = await this.db.zeppActivityLink.findMany({
      where: { userId, workoutId: { not: workoutId } },
    });
    const rows = await this.db.zeppActivity.findMany({
      where: {
        userId,
        status: { in: ['ready', 'resolved'] },
        startedAt: { gte: new Date(start * 1000), lt: new Date(end * 1000) },
        summaryId: { notIn: links.map((l) => l.summaryId) },
      },
      orderBy: { id: 'asc' },
      take: 51,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return {
      items: rows
        .slice(0, 50)
        .map((r) => ({ id: r.id, hasRoute: r.hasRoute, ...(r.summary as object) })),
      nextCursor: rows.length > 50 ? rows[49].id : null,
    };
  }
  async activities(userId: string) {
    const rows = await this.db.zeppActivity.findMany({
      where: { userId, status: 'ready', createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map((r) => ({ id: r.id, ...(r.summary as object) }));
  }
  async file(userId: string, id: string) {
    const a = await this.db.zeppActivity.findFirst({
      where: { userId, id, status: { in: ['ready', 'resolved'] } },
    });
    if (!a?.fit) throw new NotFoundException();
    return Buffer.from(a.fit);
  }
  async resolve(userId: string, id: string, resolution: string, workoutId?: string) {
    if (!['linked', 'free_run', 'dismissed'].includes(resolution))
      throw new BadRequestException('Resolução inválida');
    if (
      resolution === 'linked' &&
      (!workoutId || !(await this.db.workout.findFirst({ where: { id: workoutId, userId } })))
    )
      throw new BadRequestException('Treino inválido');
    const activity = await this.db.zeppActivity.findFirst({ where: { userId, id } });
    if (activity) {
      const link = await this.db.zeppActivityLink.findUnique({
        where: { userId_summaryId: { userId, summaryId: activity.summaryId } },
      });
      if (link) {
        if (resolution !== 'linked' || link.workoutId !== workoutId) return {};
      } else if (resolution === 'linked') {
        const workout = await this.db.workout.findFirst({
          where: { id: workoutId, userId, status: { in: ['done', 'partial'] } },
        });
        if (!workout)
          throw new BadRequestException('Conclua o treino antes de vincular a atividade.');
        await this.db.zeppActivityLink.create({
          data: { userId, summaryId: activity.summaryId, workoutId: workoutId! },
        });
      }
    }
    const r = await this.db.zeppActivity.updateMany({
      where: { userId, id, status: { in: ['ready', 'resolved'] } },
      data: {
        status: 'resolved',
        resolution,
        workoutId: resolution === 'linked' ? workoutId : null,
      },
    });
    if (!r.count) throw new NotFoundException();
    return {};
  }
  onApplicationBootstrap() {
    this.timer = setInterval(() => {
      void this.drain().catch(() => undefined);
    }, 5000);
    this.timer.unref();
  }
  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }
  async drain() {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.db.zeppActivity.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - 30 * 86400_000) } },
      });
      if (!this.enabled) return;
      const now = new Date();
      const connections = this.automaticWorkoutsEnabled
        ? await this.db.zeppConnection.findMany({
            where: {
              connected: true,
              nextSyncAt: { lte: now },
              OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
            },
            take: 10,
          })
        : [];
      for (const c of connections) {
        const lease = new Date(Date.now() + 120_000);
        const claim = await this.db.zeppConnection.updateMany({
          where: {
            userId: c.userId,
            connected: true,
            OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
          },
          data: { leaseUntil: lease },
        });
        if (!claim.count) continue;
        try {
          await this.sync(c.userId, c.timeZone, c.syncHash);
        } catch (e) {
          await this.db.zeppConnection.updateMany({
            where: { userId: c.userId, leaseUntil: lease },
            data: { error: e instanceof Error ? e.message : 'Falha na sincronização' },
          });
        } finally {
          await this.db.zeppConnection.updateMany({
            where: { userId: c.userId, leaseUntil: lease },
            data: { leaseUntil: null, nextSyncAt: new Date(Date.now() + 300_000) },
          });
        }
      }
      const pending = await this.db.zeppActivity.findMany({
        where: {
          status: 'pending',
          nextAttemptAt: { lte: now },
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
        },
        take: 10,
      });
      for (const a of pending) {
        const lease = new Date(Date.now() + 120_000);
        const claim = await this.db.zeppActivity.updateMany({
          where: {
            id: a.id,
            status: 'pending',
            OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
          },
          data: { leaseUntil: lease, attempts: { increment: 1 } },
        });
        if (!claim.count) continue;
        try {
          if (Date.now() - a.createdAt.getTime() >= 86400_000) throw new Error('URL FIT expirada');
          const response = await fetch(validateDownloadUrl(this.decrypt(a.downloadUrl)), {
            headers: { Authorization: `Bearer ${await this.access(a.userId)}` },
            redirect: 'error',
            signal: AbortSignal.timeout(60_000),
          });
          if (!response.ok || !response.body) throw new Error(`FIT HTTP ${response.status}`);
          const chunks: Uint8Array[] = [];
          let size = 0;
          for await (const chunk of response.body as any) {
            size += chunk.length;
            if (size > 50 * 1024 * 1024) throw new Error('FIT excede 50 MB');
            chunks.push(chunk);
          }
          const bytes = Buffer.concat(chunks);
          const summary = fitSummary(bytes);
          await this.db.zeppActivity.updateMany({
            where: { id: a.id, leaseUntil: lease },
            data: {
              fit: new Uint8Array(bytes),
              summary: JSON.parse(JSON.stringify(summary)),
              startedAt: new Date(String(summary.startedAt)),
              hasRoute: summary.hasRoute,
              status: 'ready',
              error: null,
              leaseUntil: null,
              downloadUrl: '',
            },
          });
        } catch {
          await this.db.zeppActivity.updateMany({
            where: { id: a.id, leaseUntil: lease },
            data: {
              leaseUntil: null,
              error: 'Falha ao receber FIT. Verifique a conexão Zepp.',
              status:
                Date.now() - a.createdAt.getTime() >= 86400_000 || a.attempts >= 9
                  ? 'failed'
                  : 'pending',
              nextAttemptAt: new Date(Date.now() + Math.min(3600_000, 60_000 * 2 ** a.attempts)),
            },
          });
        }
      }
    } finally {
      this.busy = false;
    }
  }
  private async sync(userId: string, timeZone: string, previous: string | null) {
    const day = localCalendar(new Date(), timeZone).date;
    const end = addCalendarDays(day, 6);
    const rows = await this.db.workout.findMany({
      where: {
        userId,
        status: 'scheduled',
        sportType: 'running',
        trainingPlan: { status: 'ACTIVE' },
        dateScheduled: { gte: day, lte: end },
      },
      orderBy: [{ dateScheduled: 'asc' }, { id: 'asc' }],
    });
    const profile = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        restingHeartRate: true,
        maxHeartRate: true,
        dateOfBirth: true,
        appleHealthRestingHeartRate: true,
        appleHealthRestingHeartRateMeasuredAt: true,
      },
    });
    // Legacy prescriptions may only contain a zone number. Saved bpm snapshots take
    // precedence in zeppSteps so profile changes never rewrite an existing prescription.
    const hrZones = Object.fromEntries(
      calculateHeartRateZones(profile ?? {}).zones.map(({ zone, minBpm, maxBpm }) => [
        `zone${zone}`,
        { min: minBpm, max: maxBpm },
      ]),
    );
    const workouts: object[] = [];
    for (const w of rows) {
      const plan = buildFitPlan(w);
      if (!plan.ok) throw new BadRequestException(`Treino incompatível com a Zepp: ${w.title}`);
      let steps: ReturnType<typeof zeppSteps>;
      try {
        steps = zeppSteps(toWatchPlan(plan.plan), hrZones);
      } catch (e) {
        throw new BadRequestException(
          `${w.title} (${w.dateScheduled.toISOString().slice(0, 10)}): ${e instanceof Error ? e.message : 'Treino incompatível com a Zepp.'}`,
        );
      }
      const mapping = await this.db.zeppWorkoutMapping.upsert({
        where: { workoutId: w.id },
        create: { workoutId: w.id },
        update: {},
      });
      workouts.push({
        workoutId: mapping.id,
        workoutDate: w.dateScheduled.toISOString().slice(0, 10),
        sport: 'RUNNING',
        workoutName: w.title,
        steps,
      });
    }
    const body = {
      startDate: day.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      workouts,
    };
    const hash = digest(JSON.stringify(body));
    if (hash !== previous) await this.api(userId, '/users/-/workouts?version=2.0.0', body);
    await this.db.zeppConnection.updateMany({
      where: { userId, connected: true },
      data: { syncHash: hash, lastSyncAt: new Date(), error: null },
    });
    return { workoutCount: workouts.length, startDate: body.startDate, endDate: body.endDate };
  }
}
