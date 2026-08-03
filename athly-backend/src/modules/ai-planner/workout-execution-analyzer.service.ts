import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { DetailedSessionDto, SegmentDto } from './dto/plan-from-health.dto';
import { SegmentLabel } from './dto/plan-from-health.dto';

export interface PrescribedWorkoutSummary {
  id: string;
  dateScheduled: string;
  title: string;
  intensity: number | null;
  mainBlockDescription: string;
  targetPaceRange?: { minSecPerKm: number; maxSecPerKm: number };
  expectedRepCount?: number;
  expectedRepDistanceKm?: number;
  expectedMainDurationMin?: number;
  totalDistanceKm?: number;
  /** Duração prescrita do aquecimento (estimada a partir da árvore de segments). */
  warmupSeconds?: number;
  warmupDistanceM?: number;
  cooldownSeconds?: number;
  cooldownDistanceM?: number;
}

export interface ExecutionAnalysis {
  meanRepPace?: string;
  fastestRep?: string;
  slowestRep?: string;
  /**
   * Pace do bloco principal (aquecimento/volta à calma excluídos quando identificáveis).
   * É este — e não o pace médio da sessão — que deve embasar julgamento de fitness.
   */
  mainPace?: string;
  pacingStrategy?: 'fade' | 'even' | 'negative' | 'erratic' | 'n/a';
  paceVarianceSeconds?: number;
  targetAdherence?: 'within' | 'undershot' | 'overshot' | 'unknown';
  deviationFromTargetSecPerKm?: number;
  avgHrRecoveryBpm?: number;
  observations: string[];
}

export interface AnalyzedSession {
  session: DetailedSessionDto;
  prescribed: PrescribedWorkoutSummary | null;
  executionAnalysis: ExecutionAnalysis;
  feedback?: { effort: number; fatigue: number; completed: boolean };
}

/**
 * Digests detailed sessions into deterministic statistics the AI can read directly.
 * Intentionally keeps all numeric/temporal reasoning on the server — the model only reads the verdict.
 */
@Injectable()
export class WorkoutExecutionAnalyzerService {
  constructor(private readonly prisma: PrismaService) {}

  async analyzeSessions(
    userId: string,
    sessions: DetailedSessionDto[],
    options?: { trainingPlanId?: string; beforeDate?: Date; persistedLimit?: number },
  ): Promise<AnalyzedSession[]> {
    const mergedSessions = await this.withPersistedExecutionDetails(userId, sessions, options);
    if (mergedSessions.length === 0) return [];

    const workoutIds = mergedSessions
      .map((s) => s.athlyWorkoutId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    const uuids = mergedSessions
      .map((s) => s.appleHealthWorkoutUUID)
      .filter((uuid): uuid is string => typeof uuid === 'string' && uuid.length > 0);

    const linkedByWorkoutId = new Map<
      string,
      Awaited<ReturnType<PrismaService['workout']['findMany']>>[number]
    >();
    const linkedByUuid = new Map<
      string,
      Awaited<ReturnType<PrismaService['workout']['findMany']>>[number]
    >();

    if (workoutIds.length > 0 || uuids.length > 0) {
      const workouts = await this.prisma.workout.findMany({
        where: {
          userId,
          OR: [{ id: { in: workoutIds } }, { appleHealthWorkoutUUID: { in: uuids } }],
        },
        include: { feedback: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });

      for (const w of workouts) {
        linkedByWorkoutId.set(w.id, w);
        if (w.appleHealthWorkoutUUID) linkedByUuid.set(w.appleHealthWorkoutUUID, w);
      }
    }

    const sessionDates = mergedSessions.map((s) => new Date(s.startDate));
    const minDate = new Date(Math.min(...sessionDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...sessionDates.map((d) => d.getTime())));
    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(23, 59, 59, 999);

    const dayWindowWorkouts = await this.prisma.workout.findMany({
      where: {
        userId,
        dateScheduled: { gte: minDate, lte: maxDate },
        sportType: { not: 'other' },
      },
      include: { feedback: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    const byDay = new Map<string, typeof dayWindowWorkouts>();
    for (const w of dayWindowWorkouts) {
      const key = w.dateScheduled.toISOString().split('T')[0];
      const list = byDay.get(key) ?? [];
      list.push(w);
      byDay.set(key, list);
    }

    return mergedSessions.map((session) => {
      const workout = this.resolveWorkout(session, linkedByWorkoutId, linkedByUuid, byDay);
      const prescribed = workout ? this.summarizePrescribed(workout) : null;
      const lastFeedback = workout?.feedback?.[0];
      const feedback = lastFeedback
        ? {
            effort: lastFeedback.effort,
            fatigue: lastFeedback.fatigue,
            completed: lastFeedback.completed,
          }
        : undefined;
      const executionAnalysis = this.analyzeExecution(session, prescribed, feedback);
      return { session, prescribed, executionAnalysis, feedback };
    });
  }

  private async withPersistedExecutionDetails(
    userId: string,
    sessions: DetailedSessionDto[],
    options?: { trainingPlanId?: string; beforeDate?: Date; persistedLimit?: number },
  ): Promise<DetailedSessionDto[]> {
    if (!options?.trainingPlanId || !options.beforeDate) return sessions;

    const persistedWorkouts = await this.prisma.workout.findMany({
      where: {
        userId,
        trainingPlanId: options.trainingPlanId,
        status: { in: ['done', 'partial'] },
        dateScheduled: { lt: options.beforeDate },
      },
      orderBy: { dateScheduled: 'desc' },
      take: options.persistedLimit ?? 7,
    });

    const seen = new Set<string>();
    const merged: DetailedSessionDto[] = [];

    const add = (session: DetailedSessionDto) => {
      const key = session.appleHealthWorkoutUUID || session.athlyWorkoutId || session.startDate;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(session);
    };

    sessions.forEach(add);

    for (const workout of persistedWorkouts) {
      const persisted = this.extractPersistedExecutionDetails(
        (workout as any).executionDetails,
        workout.id,
      );
      if (persisted) add(persisted);
    }

    return merged;
  }

  private extractPersistedExecutionDetails(
    raw: unknown,
    workoutId: string,
  ): DetailedSessionDto | null {
    if (!raw || typeof raw !== 'object') return null;
    const value = raw as Partial<DetailedSessionDto>;
    if (
      typeof value.startDate !== 'string' ||
      typeof value.distanceMeters !== 'number' ||
      typeof value.durationSeconds !== 'number' ||
      !Array.isArray(value.segments)
    ) {
      return null;
    }
    return {
      ...value,
      athlyWorkoutId: value.athlyWorkoutId ?? workoutId,
      segments: value.segments,
    } as DetailedSessionDto;
  }

  private resolveWorkout(
    session: DetailedSessionDto,
    byWorkoutId: Map<string, any>,
    byUuid: Map<string, any>,
    byDay: Map<string, any[]>,
  ): any | null {
    if (session.athlyWorkoutId) {
      const w = byWorkoutId.get(session.athlyWorkoutId);
      if (w) return w;
    }
    if (session.appleHealthWorkoutUUID) {
      const viaUuid = byUuid.get(session.appleHealthWorkoutUUID);
      if (viaUuid) return viaUuid;
    }

    const dayKey = session.startDate.split('T')[0];
    const sameDay = byDay.get(dayKey);
    if (sameDay && sameDay.length > 0) {
      return sameDay.find((w) => !w.appleHealthWorkoutUUID) ?? sameDay[0];
    }
    return null;
  }

  private summarizePrescribed(workout: any): PrescribedWorkoutSummary {
    const blocks = Array.isArray(workout.blocks) ? workout.blocks : [];
    const mainBlock = blocks.find((b: any) => b?.type === 'main') ?? blocks[0];
    const mainDescription: string = mainBlock?.instructions ?? workout.description ?? '';

    // Fonte da verdade: a árvore de segments persistida com o treino. Os blocks
    // legados achatam a faixa de pace e perdem a estrutura de reps — só servem de fallback.
    const tree = this.extractSegmentTree(workout.segments);
    const fromTree = tree ? this.summarizeFromTree(tree) : null;

    const legacyDistanceKm = blocks.reduce(
      (sum: number, b: any) => sum + (this.blockDistanceKm(b) ?? 0),
      0,
    );
    const targetPaceRange = fromTree?.targetPaceRange ?? this.parsePaceRange(mainBlock?.targetPace);
    const repStructure =
      fromTree?.expectedRepCount && fromTree.expectedRepCount > 0
        ? {
            expectedRepCount: fromTree.expectedRepCount,
            expectedRepDistanceKm: fromTree.expectedRepDistanceKm,
          }
        : this.parseRepStructure(mainDescription);
    const expectedMainDurationMin =
      fromTree?.expectedMainDurationMin ??
      this.blockDurationMin(mainBlock) ??
      this.parseDurationPrescription(mainDescription);
    const totalDistanceKm =
      fromTree?.totalDistanceKm ??
      (legacyDistanceKm > 0 ? Number(legacyDistanceKm.toFixed(2)) : undefined);

    return {
      id: workout.id,
      dateScheduled: workout.dateScheduled.toISOString().split('T')[0],
      title: workout.title,
      intensity: workout.intensity ?? null,
      mainBlockDescription: mainDescription.slice(0, 240),
      targetPaceRange,
      expectedRepCount: repStructure.expectedRepCount,
      expectedRepDistanceKm: repStructure.expectedRepDistanceKm,
      expectedMainDurationMin,
      totalDistanceKm,
      warmupSeconds: fromTree?.warmupSeconds,
      warmupDistanceM: fromTree?.warmupDistanceM,
      cooldownSeconds: fromTree?.cooldownSeconds,
      cooldownDistanceM: fromTree?.cooldownDistanceM,
    };
  }

  /** Blocks legados gravam `distance`/`duration`; dados antigos podem ter `distanceKm`/`durationMinutes`. */
  private blockDistanceKm(block: any): number | undefined {
    if (typeof block?.distance === 'number' && block.distance > 0) return block.distance;
    if (typeof block?.distanceKm === 'number' && block.distanceKm > 0) return block.distanceKm;
    return undefined;
  }

  private blockDurationMin(block: any): number | undefined {
    if (typeof block?.duration === 'number' && block.duration > 0) return block.duration;
    if (typeof block?.durationMinutes === 'number' && block.durationMinutes > 0)
      return block.durationMinutes;
    return undefined;
  }

  /** Aceita tanto o envelope `{schemaVersion, sport, segments}` quanto um array puro. */
  private extractSegmentTree(raw: unknown): any[] | null {
    if (Array.isArray(raw)) return raw.length > 0 ? raw : null;
    if (raw && typeof raw === 'object' && Array.isArray((raw as any).segments)) {
      const segs = (raw as any).segments;
      return segs.length > 0 ? segs : null;
    }
    return null;
  }

  private summarizeFromTree(segments: any[]): {
    targetPaceRange?: { minSecPerKm: number; maxSecPerKm: number };
    expectedRepCount?: number;
    expectedRepDistanceKm?: number;
    expectedMainDurationMin?: number;
    totalDistanceKm?: number;
    warmupSeconds?: number;
    warmupDistanceM?: number;
    cooldownSeconds?: number;
    cooldownDistanceM?: number;
  } {
    const paceHints: number[] = [];
    let repCount = 0;
    let repDistanceKm: number | undefined;
    const standaloneWorks: any[] = [];
    let mainDurationSec = 0;
    let mainDistanceMNoPace = 0;
    let totalDistanceM = 0;
    let warmupSeconds = 0;
    let warmupDistanceM = 0;
    let cooldownSeconds = 0;
    let cooldownDistanceM = 0;

    const collectPace = (seg: any) => {
      const t = seg?.target;
      if (t && typeof t === 'object') {
        if (typeof t.paceSecPerKmMin === 'number' && t.paceSecPerKmMin > 0)
          paceHints.push(t.paceSecPerKmMin);
        if (typeof t.paceSecPerKmMax === 'number' && t.paceSecPerKmMax > 0)
          paceHints.push(t.paceSecPerKmMax);
      }
    };

    const endOf = (seg: any): { by?: string; value?: number } => seg?.end ?? {};

    const accumulateMain = (seg: any, mult: number) => {
      const end = endOf(seg);
      if (end.by === 'durationSec' && typeof end.value === 'number')
        mainDurationSec += end.value * mult;
      if (end.by === 'distanceM' && typeof end.value === 'number') {
        totalDistanceM += end.value * mult;
        mainDistanceMNoPace += end.value * mult;
      }
    };

    for (const seg of segments) {
      if (!seg || typeof seg !== 'object') continue;
      const end = endOf(seg);
      if (seg.kind === 'warmup') {
        if (end.by === 'durationSec' && typeof end.value === 'number') warmupSeconds += end.value;
        if (end.by === 'distanceM' && typeof end.value === 'number') {
          warmupDistanceM += end.value;
          totalDistanceM += end.value;
        }
      } else if (seg.kind === 'cooldown') {
        if (end.by === 'durationSec' && typeof end.value === 'number') cooldownSeconds += end.value;
        if (end.by === 'distanceM' && typeof end.value === 'number') {
          cooldownDistanceM += end.value;
          totalDistanceM += end.value;
        }
      } else if (seg.kind === 'rest') {
        continue;
      } else if (seg.kind === 'set' && Array.isArray(seg.children)) {
        const reps =
          typeof seg.repetitions === 'number' && seg.repetitions >= 1 ? seg.repetitions : 1;
        for (const child of seg.children) {
          if (!child || typeof child !== 'object') continue;
          accumulateMain(child, reps);
          if (child.kind === 'work') {
            collectPace(child);
            repCount += reps;
            const childEnd = endOf(child);
            if (
              repDistanceKm === undefined &&
              childEnd.by === 'distanceM' &&
              typeof childEnd.value === 'number'
            ) {
              repDistanceKm = childEnd.value / 1000;
            }
          }
        }
      } else {
        accumulateMain(seg, 1);
        if (seg.kind === 'work') {
          collectPace(seg);
          standaloneWorks.push(seg);
        }
      }
    }

    // Pirâmides e afins: vários works soltos alternados com recovery contam como reps.
    if (repCount === 0 && standaloneWorks.length >= 2) {
      repCount = standaloneWorks.length;
      const firstDist = standaloneWorks
        .map((w) => endOf(w))
        .find((e) => e.by === 'distanceM' && typeof e.value === 'number');
      if (firstDist?.value) repDistanceKm = firstDist.value / 1000;
    }

    let targetPaceRange: { minSecPerKm: number; maxSecPerKm: number } | undefined;
    if (paceHints.length > 0) {
      const lo = Math.min(...paceHints);
      const hi = Math.max(...paceHints);
      targetPaceRange =
        lo === hi
          ? { minSecPerKm: lo - 10, maxSecPerKm: hi + 10 }
          : { minSecPerKm: lo, maxSecPerKm: hi };
    }

    // Converte os trechos por distância usando o meio da faixa de pace, quando existir.
    if (mainDistanceMNoPace > 0 && targetPaceRange) {
      const midPace = (targetPaceRange.minSecPerKm + targetPaceRange.maxSecPerKm) / 2;
      mainDurationSec += (mainDistanceMNoPace / 1000) * midPace;
    }

    return {
      targetPaceRange,
      expectedRepCount: repCount > 0 ? repCount : undefined,
      expectedRepDistanceKm: repDistanceKm,
      expectedMainDurationMin: mainDurationSec > 0 ? Math.round(mainDurationSec / 60) : undefined,
      totalDistanceKm: totalDistanceM > 0 ? Number((totalDistanceM / 1000).toFixed(2)) : undefined,
      warmupSeconds: warmupSeconds > 0 ? warmupSeconds : undefined,
      warmupDistanceM: warmupDistanceM > 0 ? warmupDistanceM : undefined,
      cooldownSeconds: cooldownSeconds > 0 ? cooldownSeconds : undefined,
      cooldownDistanceM: cooldownDistanceM > 0 ? cooldownDistanceM : undefined,
    };
  }

  private analyzeExecution(
    session: DetailedSessionDto,
    prescribed: PrescribedWorkoutSummary | null,
    feedback?: { effort: number; fatigue: number; completed: boolean },
  ): ExecutionAnalysis {
    const observations: string[] = [];
    // Quando a origem dos splits é sintética (ex.: Garmin/Nike lidos via Apple Health, que só carrega
    // totais), os "segments" são um preenchimento de pace uniforme — não dá para tirar veredito de
    // tiros/variação deles. Evita afirmar "pacing even" ou "sem tiros" como se fosse real.
    const isLowGranularity =
      session.splitsSource === 'synthetic' || session.splitsSource === 'prescribed_low_confidence';
    const reps = session.segments.filter((s) => s.label === SegmentLabel.rep);
    const recoveries = session.segments.filter((s) => s.label === SegmentLabel.rec);

    if (reps.length === 0) {
      const isIntervalPrescription = !!(
        prescribed?.expectedRepCount && prescribed.expectedRepCount > 0
      );
      if (isIntervalPrescription) {
        if (isLowGranularity) {
          observations.push(
            `O treino previa ${prescribed.expectedRepCount} tiros, mas esta corrida chegou com granularidade baixa — não dá para verificar a execução dos tiros com segurança.`,
          );
        } else if (session.splitsSource === 'route') {
          observations.push(
            `O treino previa ${prescribed.expectedRepCount} tiros, mas a corrida chegou apenas com splits por km (sem laps de treino) — não é possível verificar os tiros individualmente; NÃO conclua que o atleta deixou de executá-los.`,
          );
        } else {
          observations.push(
            `Nenhum tiro detectado na corrida, embora o treino previsse ${prescribed.expectedRepCount} repetições.`,
          );
        }
      }

      // Compara pace contra o BLOCO PRINCIPAL, não contra a sessão inteira: o pace
      // médio da sessão carrega aquecimento e volta à calma e sai sistematicamente
      // mais lento que o alvo, gerando falso "undershot".
      const main = this.extractMainPortion(session, prescribed);
      const mainPaceSec = main.paceSecPerKm ?? session.averagePaceSecondsPerKm;
      const scopeLabel = main.trimmed ? 'Bloco principal executado' : 'Treino executado';

      let targetAdherence: ExecutionAnalysis['targetAdherence'] = 'unknown';
      let deviationFromTargetSecPerKm: number | undefined;
      if (
        !isIntervalPrescription &&
        prescribed?.targetPaceRange &&
        typeof mainPaceSec === 'number' &&
        mainPaceSec > 0
      ) {
        // Prescrição de tiros sem laps na execução fica 'unknown': comparar pace de
        // sessão contínua com pace alvo de tiro é incomparável por definição.
        const { minSecPerKm, maxSecPerKm } = prescribed.targetPaceRange;
        if (mainPaceSec >= minSecPerKm && mainPaceSec <= maxSecPerKm) {
          targetAdherence = 'within';
          deviationFromTargetSecPerKm = 0;
        } else if (mainPaceSec < minSecPerKm) {
          targetAdherence = 'overshot';
          deviationFromTargetSecPerKm = Math.round(mainPaceSec - minSecPerKm);
          observations.push(
            `${scopeLabel} ${Math.abs(deviationFromTargetSecPerKm)}s/km mais rápido que o prescrito (overshot).`,
          );
        } else {
          targetAdherence = 'undershot';
          deviationFromTargetSecPerKm = Math.round(mainPaceSec - maxSecPerKm);
          observations.push(
            `${scopeLabel} ${deviationFromTargetSecPerKm}s/km mais lento que o prescrito (undershot).`,
          );
        }
      }

      let pacingStrategy: ExecutionAnalysis['pacingStrategy'] = 'n/a';
      let paceVarianceSeconds: number | undefined;
      if (isLowGranularity) {
        // Sem granularidade confiável: não inventa estratégia de pace. Mantém só o nível de sessão/bloco.
        observations.push(
          'Esta corrida veio sem granularidade suficiente para avaliar variação de pace com segurança — análise limitada ao ritmo médio/bloco reconstruído; não é possível confirmar tiros individualmente.',
        );
      } else {
        // Variance/strategy a partir dos splits do bloco principal — incluir o aquecimento
        // e a volta à calma aqui transformava um tempo run bem executado em "erratic"/"fade".
        const easyPaces = main.segments
          .filter((s) => s.label === SegmentLabel.easy)
          .map((s) => s.avgPaceSecondsPerKm)
          .filter((p): p is number => typeof p === 'number' && p > 0);
        if (easyPaces.length >= 4) {
          const fastest = Math.min(...easyPaces);
          const slowest = Math.max(...easyPaces);
          paceVarianceSeconds = Math.round(slowest - fastest);
          const firstHalf = avg(easyPaces.slice(0, Math.floor(easyPaces.length / 2)));
          const secondHalf = avg(easyPaces.slice(Math.ceil(easyPaces.length / 2)));
          const delta = secondHalf - firstHalf;
          if (paceVarianceSeconds > 25) {
            pacingStrategy = 'erratic';
            observations.push(
              `Variação grande entre splits do bloco principal (~${paceVarianceSeconds}s/km entre o mais rápido e o mais lento).`,
            );
          } else if (delta > 5) {
            pacingStrategy = 'fade';
            observations.push(
              'Pacing degradou na segunda metade do bloco principal (+5s/km ou mais).',
            );
          } else if (delta < -5) {
            pacingStrategy = 'negative';
          } else {
            pacingStrategy = 'even';
          }
        }
      }

      this.addContextualObservations(observations, prescribed, feedback, session, targetAdherence);

      return {
        mainPace:
          typeof mainPaceSec === 'number' && mainPaceSec > 0 ? formatPace(mainPaceSec) : undefined,
        pacingStrategy,
        targetAdherence,
        deviationFromTargetSecPerKm,
        paceVarianceSeconds,
        observations,
      };
    }

    if (isLowGranularity) {
      observations.push(
        'Os blocos foram reconstruídos com baixa confiança; use duração/volume e feedback, mas não conclua aderência de tiros ou estratégia de pace.',
      );
      this.addContextualObservations(observations, prescribed, feedback, session, 'unknown');
      return {
        pacingStrategy: 'n/a',
        targetAdherence: 'unknown',
        observations,
      };
    }

    const repPaces = reps
      .map((r) => r.avgPaceSecondsPerKm)
      .filter((p): p is number => typeof p === 'number' && p > 0);
    const meanPaceSec =
      repPaces.length > 0 ? repPaces.reduce((s, p) => s + p, 0) / repPaces.length : 0;

    let fastestIdx = -1;
    let slowestIdx = -1;
    let fastest = Infinity;
    let slowest = -Infinity;
    reps.forEach((r, i) => {
      const pace = r.avgPaceSecondsPerKm ?? 0;
      if (pace > 0 && pace < fastest) {
        fastest = pace;
        fastestIdx = i;
      }
      if (pace > 0 && pace > slowest) {
        slowest = pace;
        slowestIdx = i;
      }
    });

    const variance = slowest > 0 && fastest < Infinity ? slowest - fastest : undefined;

    let pacingStrategy: ExecutionAnalysis['pacingStrategy'] = 'even';
    if (repPaces.length >= 4) {
      const firstHalfAvg = avg(repPaces.slice(0, Math.floor(repPaces.length / 2)));
      const secondHalfAvg = avg(repPaces.slice(Math.ceil(repPaces.length / 2)));
      const delta = secondHalfAvg - firstHalfAvg;
      if (variance && variance > 25) pacingStrategy = 'erratic';
      else if (delta > 5) pacingStrategy = 'fade';
      else if (delta < -5) pacingStrategy = 'negative';
      else pacingStrategy = 'even';
    }

    let targetAdherence: ExecutionAnalysis['targetAdherence'] = 'unknown';
    let deviationFromTargetSecPerKm: number | undefined;
    if (prescribed?.targetPaceRange && meanPaceSec > 0) {
      const { minSecPerKm, maxSecPerKm } = prescribed.targetPaceRange;
      if (meanPaceSec >= minSecPerKm && meanPaceSec <= maxSecPerKm) {
        targetAdherence = 'within';
        deviationFromTargetSecPerKm = 0;
      } else if (meanPaceSec < minSecPerKm) {
        targetAdherence = 'overshot';
        deviationFromTargetSecPerKm = Math.round(meanPaceSec - minSecPerKm);
      } else {
        targetAdherence = 'undershot';
        deviationFromTargetSecPerKm = Math.round(meanPaceSec - maxSecPerKm);
      }
    }

    const hrRecoveryDeltas: number[] = [];
    for (let i = 0; i < reps.length; i++) {
      const rep = reps[i];
      const rec = recoveries[i];
      if (rep?.peakHR && rec?.endHR && rep.peakHR > rec.endHR) {
        hrRecoveryDeltas.push(rep.peakHR - rec.endHR);
      }
    }
    const avgHrRecoveryBpm =
      hrRecoveryDeltas.length > 0
        ? Math.round(hrRecoveryDeltas.reduce((s, d) => s + d, 0) / hrRecoveryDeltas.length)
        : undefined;

    if (pacingStrategy === 'fade') {
      observations.push('Pacing degradou na segunda metade dos tiros (+5s/km ou mais).');
    } else if (pacingStrategy === 'negative') {
      observations.push('Negative split: atleta acelerou na segunda metade dos tiros.');
    } else if (pacingStrategy === 'erratic') {
      observations.push(
        'Variação grande entre tiros (>25s/km entre o mais rápido e o mais lento).',
      );
    }
    if (avgHrRecoveryBpm && avgHrRecoveryBpm < 15) {
      observations.push(`Recuperação cardíaca baixa entre tiros (~${avgHrRecoveryBpm}bpm).`);
    }
    if (
      prescribed?.expectedRepCount &&
      prescribed.expectedRepCount > 0 &&
      reps.length !== prescribed.expectedRepCount
    ) {
      observations.push(
        `Atleta executou ${reps.length} tiros vs ${prescribed.expectedRepCount} prescritos.`,
      );
    }

    this.addContextualObservations(observations, prescribed, feedback, session, targetAdherence);

    return {
      meanRepPace: meanPaceSec > 0 ? formatPace(meanPaceSec) : undefined,
      mainPace: meanPaceSec > 0 ? formatPace(meanPaceSec) : undefined,
      fastestRep:
        fastestIdx >= 0 && fastest < Infinity
          ? `${formatPace(fastest)} (rep${fastestIdx + 1})`
          : undefined,
      slowestRep:
        slowestIdx >= 0 && slowest > 0
          ? `${formatPace(slowest)} (rep${slowestIdx + 1})`
          : undefined,
      pacingStrategy,
      paceVarianceSeconds: variance !== undefined ? Math.round(variance) : undefined,
      targetAdherence,
      deviationFromTargetSecPerKm,
      avgHrRecoveryBpm,
      observations,
    };
  }

  /**
   * Isola o bloco principal da sessão para julgamento de pace/pacing.
   * Prioridade: labels explícitos (warmup/cooldown) > trim por duração prescrita
   * (corta do início/fim os splits cobertos pelo aquecimento/volta à calma da
   * prescrição) > sessão inteira como fallback.
   */
  private extractMainPortion(
    session: DetailedSessionDto,
    prescribed: PrescribedWorkoutSummary | null,
  ): { segments: SegmentDto[]; paceSecPerKm?: number; trimmed: boolean } {
    const segs = session.segments ?? [];
    const stats = (list: SegmentDto[], trimmed: boolean) => {
      const distKm = list.reduce((s, x) => s + (x.distanceKm ?? 0), 0);
      const durSec = list.reduce((s, x) => s + (x.durationSeconds ?? 0), 0);
      return {
        segments: list,
        paceSecPerKm: distKm > 0 && durSec > 0 ? durSec / distKm : undefined,
        trimmed,
      };
    };

    const hasBoundaryLabels = segs.some(
      (s) => s.label === SegmentLabel.warmup || s.label === SegmentLabel.cooldown,
    );
    if (hasBoundaryLabels) {
      const main = segs.filter(
        (s) => s.label !== SegmentLabel.warmup && s.label !== SegmentLabel.cooldown,
      );
      if (main.length > 0) return stats(main, true);
    }

    if (session.splitsSource === 'synthetic' || segs.length < 3 || !prescribed) {
      return stats(segs, false);
    }

    const totalDur = segs.reduce((s, x) => s + (x.durationSeconds ?? 0), 0);
    const sessionPace =
      session.averagePaceSecondsPerKm ??
      (session.distanceMeters > 0 ? session.durationSeconds / (session.distanceMeters / 1000) : 0);
    const toSeconds = (sec?: number, distM?: number) =>
      (sec ?? 0) + (distM && sessionPace > 0 ? (distM / 1000) * sessionPace : 0);

    const warmupSec = toSeconds(prescribed.warmupSeconds, prescribed.warmupDistanceM);
    const cooldownSec = toSeconds(prescribed.cooldownSeconds, prescribed.cooldownDistanceM);
    if (warmupSec <= 0 && cooldownSec <= 0) return stats(segs, false);

    // Um split é descartado quando COMEÇA dentro da janela prescrita: o split de
    // transição (meio aquecimento, meio bloco) contaminaria o pace do bloco principal,
    // e na dúvida é mais seguro excluí-lo do que julgar fitness com warmup na conta.
    // Caps de segurança: nunca cortar mais de 40% do início nem 30% do fim.
    const frontCap = Math.min(warmupSec, totalDur * 0.4);
    const backCap = Math.min(cooldownSec, totalDur * 0.3);

    let start = 0;
    let cumFront = 0;
    while (start < segs.length && cumFront < frontCap) {
      cumFront += segs[start].durationSeconds ?? 0;
      start++;
    }
    let end = segs.length;
    let cumBack = 0;
    while (end > start && cumBack < backCap) {
      cumBack += segs[end - 1].durationSeconds ?? 0;
      end--;
    }

    const main = segs.slice(start, end);
    if (main.length === 0) return stats(segs, false);
    return stats(main, start > 0 || end < segs.length);
  }

  /**
   * Cruza adherence × effort/fatigue × intensidade prescrita × duração executada
   * para emitir observações de overreach, easy-rápido-demais, qualidade-falha, sessão encurtada.
   */
  private addContextualObservations(
    observations: string[],
    prescribed: PrescribedWorkoutSummary | null,
    feedback: { effort: number; fatigue: number; completed: boolean } | undefined,
    session: DetailedSessionDto,
    targetAdherence: ExecutionAnalysis['targetAdherence'],
  ): void {
    const intensity = prescribed?.intensity ?? null;

    if (feedback) {
      const { effort, fatigue, completed } = feedback;

      if (effort >= 8 && targetAdherence === 'within' && intensity !== null && intensity <= 4) {
        observations.push(
          `Esforço alto (${effort}/10) em treino fácil dentro da faixa — sinal de fadiga ou overreach.`,
        );
      }
      if (targetAdherence === 'overshot' && intensity !== null && intensity <= 4) {
        observations.push(
          'Easy/recuperação executado em ritmo de tempo — risco de overreach na próxima semana.',
        );
      }
      if (
        targetAdherence === 'undershot' &&
        intensity !== null &&
        intensity >= 7 &&
        completed === false
      ) {
        observations.push(
          'Atleta não absorveu o estímulo da sessão de qualidade — considere reduzir volume ou pace alvo.',
        );
      }
      if (effort === 10 && fatigue === 10 && completed === false) {
        observations.push(
          'Atleta estourou (effort/fatigue 10/10, não completou) — a próxima semana deve ter deload.',
        );
      }
    }

    // Sessão encurtada vs duração prescrita do bloco principal
    if (
      prescribed?.expectedMainDurationMin &&
      prescribed.expectedMainDurationMin > 0 &&
      session.durationSeconds > 0
    ) {
      const actualMin = session.durationSeconds / 60;
      if (actualMin < prescribed.expectedMainDurationMin * 0.8) {
        observations.push(
          `Sessão encurtada: atleta correu ${Math.round(actualMin)}min vs ${prescribed.expectedMainDurationMin}min prescritos no bloco principal.`,
        );
      }
    }
  }

  private parsePaceRange(
    targetPace?: string,
  ): { minSecPerKm: number; maxSecPerKm: number } | undefined {
    if (!targetPace) return undefined;
    const parts = targetPace.match(/(\d{1,2}):(\d{2})/g);
    if (!parts || parts.length === 0) return undefined;
    const paces = parts.map((p) => {
      const [m, s] = p.split(':').map(Number);
      return m * 60 + s;
    });
    if (paces.length === 1) {
      return { minSecPerKm: paces[0] - 5, maxSecPerKm: paces[0] + 5 };
    }
    return { minSecPerKm: Math.min(...paces), maxSecPerKm: Math.max(...paces) };
  }

  private parseRepStructure(description: string): {
    expectedRepCount?: number;
    expectedRepDistanceKm?: number;
  } {
    const match = description.match(
      /(\d+)\s*(?:x|×|repet(?:i[çc][õo]es)?)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(m|km)/i,
    );
    if (!match) return {};
    const count = parseInt(match[1], 10);
    const distNum = parseFloat(match[2].replace(',', '.'));
    const unit = match[3].toLowerCase();
    const distanceKm = unit === 'km' ? distNum : distNum / 1000;
    return { expectedRepCount: count, expectedRepDistanceKm: distanceKm };
  }

  /** Detecta "Corra por 20 minutos em ritmo de Limiar" → 20. */
  private parseDurationPrescription(description: string): number | undefined {
    if (!description) return undefined;
    const patterns = [
      /(\d+)\s*min(?:utos?)?\s+em\s+ritmo/i,
      /por\s+(\d+)\s*min(?:utos?)?/i,
      /durante\s+(\d+)\s*min(?:utos?)?/i,
    ];
    for (const re of patterns) {
      const m = description.match(re);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!Number.isNaN(n) && n > 0 && n < 240) return n;
      }
    }
    return undefined;
  }
}

function avg(nums: number[]): number {
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function formatPace(secondsPerKm: number): string {
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
