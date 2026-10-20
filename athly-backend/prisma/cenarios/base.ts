/**
 * Base dos cenários locais do planner (ver `cli.ts` para os comandos).
 *
 * Logado como `cenario-<nome>@athly.test`, o Health simulado do app (MockHealthKitService)
 * devolve os dados do cenário:
 *   vazio  — nenhuma corrida (o backend gera o plano de avaliação)
 *   gps    — splits por km da rota e FC, mas condicionamento baixo (VDOT ~26)
 *   resumo — só totais (distância, tempo, pace médio), sem FC nem rota (VDOT ~33)
 *   medio  — splits da rota e FC, condicionamento intermediário (VDOT ~39)
 *   veloz  — só totais, corredor forte (VDOT ~50, ~50 km/semana)
 *
 * Duas contas só do eval, com um plano em andamento semeado no banco (ver
 * `eval/plano-em-andamento.ts`); no simulador elas caem no Health padrão do mock:
 *   disciplinado — cumpriu o plano de meia inteiro, com FC (pronto para a meta)
 *   irregular    — fez ~60% do plano, sem FC (no limite da meta)
 */
import 'dotenv/config';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { LEGAL_DOCUMENT_VERSIONS } from '../../src/common/legal/legal-documents';

export const SENHA = 'Athly1234';
export const SAIDA = join(__dirname, '..', '..', '.cenarios');
// Do menos ao mais condicionado: a ordem das linhas do relatório do eval.
export const CENARIOS = [
  'vazio',
  'gps',
  'resumo',
  'medio',
  'veloz',
  'disciplinado',
  'irregular',
] as const;
export type Cenario = (typeof CENARIOS)[number];

const PERFIS: Record<
  Cenario,
  { name: string; gender: string; dateOfBirth: string; weight: number; height: number }
> = {
  resumo: {
    name: 'Cenário Resumo',
    gender: 'male',
    dateOfBirth: '1990-05-10',
    weight: 74,
    height: 176,
  },
  gps: {
    name: 'Cenário GPS',
    gender: 'female',
    dateOfBirth: '1993-08-22',
    weight: 68,
    height: 165,
  },
  vazio: {
    name: 'Cenário Vazio',
    gender: 'male',
    dateOfBirth: '1998-02-14',
    weight: 85,
    height: 180,
  },
  medio: {
    name: 'Cenário Médio',
    gender: 'female',
    dateOfBirth: '1985-03-30',
    weight: 60,
    height: 166,
  },
  veloz: {
    name: 'Cenário Veloz',
    gender: 'male',
    dateOfBirth: '1988-11-05',
    weight: 68,
    height: 178,
  },
  disciplinado: {
    name: 'Cenário Disciplinado',
    gender: 'female',
    dateOfBirth: '1989-06-18',
    weight: 59,
    height: 167,
  },
  irregular: {
    name: 'Cenário Irregular',
    gender: 'male',
    dateOfBirth: '1986-01-27',
    weight: 82,
    height: 179,
  },
};

export const emailDe = (cenario: Cenario) => `cenario-${cenario}@athly.test`;
const cenarioDe = (email: string) =>
  CENARIOS.find((cenario) => email.startsWith(`cenario-${cenario}`)) ?? 'outro';

function bancoLocal(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não definida.');
  const host = new URL(url).hostname;
  // Só roda contra o Postgres local: o script apaga dados.
  if (!['localhost', '127.0.0.1', '::1', 'db', 'host.docker.internal'].includes(host)) {
    throw new Error(`DATABASE_URL aponta para "${host}", não para o banco local. Abortado.`);
  }
  return url;
}

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: bancoLocal() }),
});

export async function seed() {
  const password = await bcrypt.hash(SENHA, 10);
  const now = new Date();
  for (const cenario of CENARIOS) {
    const { dateOfBirth, ...perfil } = PERFIS[cenario];
    const data = {
      ...perfil,
      dateOfBirth: new Date(`${dateOfBirth}T00:00:00Z`),
      imc: Math.round((perfil.weight / (perfil.height / 100) ** 2) * 10) / 10,
      password,
      termsAcceptedAt: now,
      termsVersion: LEGAL_DOCUMENT_VERSIONS.terms,
      privacyAcceptedAt: now,
      privacyVersion: LEGAL_DOCUMENT_VERSIONS.privacy,
      subscriptionStatus: 'active',
      subscriptionExpiresAt: new Date(now.getTime() + 365 * 86_400_000),
    };
    const email = emailDe(cenario);
    await prisma.user.upsert({ where: { email }, update: data, create: { email, ...data } });
    await reset(cenario);
  }
  console.log(`\nContas prontas (senha ${SENHA}):`);
  for (const cenario of CENARIOS) console.log(`  ${emailDe(cenario)}`);
}

/**
 * Volta a conta ao "Sem meta definida". Por padrão salva antes as gerações, que o cascade
 * apaga; o eval desliga isso porque já salvou cada caso na própria pasta.
 */
export async function reset(cenario: Cenario, { exportarAntes = true, silencioso = false } = {}) {
  const email = emailDe(cenario);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`A conta ${email} não existe. Rode "./cenarios.sh seed" antes.`);
  if (exportarAntes) await exportar(cenario);
  const userId = user.id;
  await prisma.$transaction([
    prisma.workoutFeedback.deleteMany({ where: { userId } }),
    // Cascade: semanas, treinos, raciocínios e logs de prompt do plano.
    prisma.trainingPlan.deleteMany({ where: { userId } }),
    prisma.planGenerationJob.deleteMany({ where: { userId } }),
    prisma.userGoal.deleteMany({ where: { userId } }),
    prisma.plannerHealthContext.deleteMany({ where: { userId } }),
    // Zonas ficam em cache por 7 dias; sem apagar, a próxima meta reaproveitaria as antigas.
    prisma.userEffortZone.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        assessmentCompleted: false,
        goals: [],
        availableDays: [],
        fitnessLevel: null,
        comfortPaceSeconds: null,
        // Laudo do plano anterior: entraria no prompt da próxima meta.
        lastTrainingReport: Prisma.DbNull,
        lastTrainingReportAt: null,
        // FC de repouso do Health simulado: o app reenvia a cada geração, se o cenário tiver.
        appleHealthRestingHeartRate: null,
        appleHealthRestingHeartRateMeasuredAt: null,
        appleHealthHeartRateCapturedAt: null,
      },
    }),
  ]);
  if (!silencioso) console.log(`${email}: sem meta, pronta para um novo onboarding.`);
}

export async function exportar(cenario: Cenario) {
  const logs = await prisma.aiPlannerPromptLog.findMany({
    where: { weeklyGoal: { trainingPlan: { user: { email: emailDe(cenario) } } } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  for (const { id } of logs) await salvarGeracao(id);
}

export async function acompanhar() {
  const inicio = new Date();
  const status = new Map<string, string>();
  // O backend esvazia o payload do job ao concluir: guarda a entrada enquanto ele está na fila.
  const entradas = new Map<string, Entrada>();
  const salvos = new Set<string>();
  console.log('Acompanhando as gerações dos cenários. Ctrl+C para sair.\n');
  for (;;) {
    const jobs = await prisma.planGenerationJob.findMany({
      where: { updatedAt: { gte: inicio }, user: { email: { startsWith: 'cenario-' } } },
      orderBy: { updatedAt: 'asc' },
      select: {
        id: true,
        status: true,
        error: true,
        payload: true,
        weeklyGoalId: true,
        user: { select: { email: true } },
      },
    });
    for (const job of jobs) {
      const payload = job.payload as Entrada | null;
      if (payload?.runs) entradas.set(job.id, payload);
      if (status.get(job.id) !== job.status) {
        status.set(job.id, job.status);
        const hora = new Date().toLocaleTimeString('pt-BR');
        const erro = job.status === 'FAILED' && job.error ? ` — ${job.error}` : '';
        console.log(`[${hora}] ${job.user.email}: ${job.status}${erro}`);
      }
      if (job.status === 'COMPLETED' && job.weeklyGoalId && !salvos.has(job.weeklyGoalId)) {
        salvos.add(job.weeklyGoalId);
        const log = await prisma.aiPlannerPromptLog.findUnique({
          where: { weeklyGoalId: job.weeklyGoalId },
          select: { id: true },
        });
        if (log) await salvarGeracao(log.id, { imprimir: true, entrada: entradas.get(job.id) });
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

export type Entrada = { runs?: unknown[]; detailedSessions?: { splitsSource?: string }[] };

/** Salva prompt, resposta, entrada e resumo de uma geração. Devolve a pasta. */
export async function salvarGeracao(
  logId: string,
  {
    imprimir = false,
    entrada,
    pasta,
  }: { imprimir?: boolean; entrada?: Entrada; pasta?: string } = {},
): Promise<string> {
  const log = await prisma.aiPlannerPromptLog.findUniqueOrThrow({
    where: { id: logId },
    include: {
      weeklyGoal: {
        include: {
          workouts: { orderBy: { dateScheduled: 'asc' } },
          trainingPlan: { include: { user: { select: { email: true } }, userGoal: true } },
        },
      },
    },
  });
  const { weeklyGoal } = log;
  const email = weeklyGoal.trainingPlan.user.email;
  const carimbo = log.createdAt.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '');
  pasta ??= join(SAIDA, cenarioDe(email), `${carimbo}_${log.generationType}`);
  if (existsSync(pasta) && !imprimir && !entrada) return pasta;
  mkdirSync(pasta, { recursive: true });

  writeFileSync(join(pasta, 'prompt.md'), log.promptText);
  writeFileSync(join(pasta, 'resposta.json'), jsonLegivel(log.rawResponse));
  if (entrada) writeFileSync(join(pasta, 'entrada.json'), JSON.stringify(entrada, null, 2));

  const goal = weeklyGoal.trainingPlan.userGoal;
  const usage = (log.parsedResponse as { aiUsage?: Record<string, unknown> } | null)?.aiUsage;
  const fontes = [...new Set((entrada?.detailedSessions ?? []).map((s) => s.splitsSource ?? '?'))];
  const linhas = [
    `${email} — geração "${log.generationType}" em ${log.createdAt.toLocaleString('pt-BR')}`,
    `Modelo ${log.modelUsed}, prompt ${log.promptVersion}` +
      (usage
        ? `, tokens ${String(usage.inputTokens)} entrada / ${String(usage.outputTokens)} saída`
        : ''),
    entrada
      ? `Entrada do app: ${entrada.runs?.length ?? 0} corridas, ` +
        `${entrada.detailedSessions?.length ?? 0} sessões detalhadas` +
        (fontes.length ? ` (splits: ${fontes.join(', ')})` : '')
      : 'Entrada do app: não capturada (só o "acompanhar" ao vivo a vê; o prompt tem os dados)',
    `Meta: ${goal?.rawText ?? '—'}`,
    `Meta interpretada: ${JSON.stringify(goal?.parsedGoal ?? null)}`,
    `Viabilidade: ${JSON.stringify(goal?.feasibility ?? null)}`,
    `Treinos gerados (${weeklyGoal.workouts.length}):`,
    ...weeklyGoal.workouts.map(
      (w) =>
        `  ${w.dateScheduled.toISOString().slice(0, 10)}  ${w.title}` +
        (w.intensity != null ? `  [intensidade ${w.intensity}]` : '') +
        (w.description ? `\n      ${w.description}` : ''),
    ),
    `Prompt: ${log.promptText.length.toLocaleString('pt-BR')} caracteres`,
  ];
  writeFileSync(join(pasta, 'resumo.txt'), `${linhas.join('\n')}\n`);
  if (imprimir) console.log(`\n${linhas.join('\n')}\n→ ${pasta}\n`);
  return pasta;
}

function jsonLegivel(texto: string): string {
  try {
    return JSON.stringify(JSON.parse(texto), null, 2);
  } catch {
    return texto;
  }
}
