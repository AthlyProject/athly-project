/**
 * Medição de uma geração: o que o backend pediu no prompt (volume, fase, prontidão, modo de
 * prescrição), a viabilidade gravada e o plano que voltou, treino a treino. As verificações
 * (`verificacoes.ts`) julgam a partir daqui.
 */
import { heartRateApplies } from '../../../src/modules/ai-planner/heart-rate-prescription';
import type { Segment } from '../../../src/modules/workouts/types/segment.types';
import { prisma } from '../base';
import { ONBOARDING, type Caso } from './casos';
import type { historico } from './health';

export function buscarLog(weeklyGoalId: string) {
  return prisma.aiPlannerPromptLog.findUniqueOrThrow({
    where: { weeklyGoalId },
    include: {
      weeklyGoal: {
        include: {
          workouts: { orderBy: { dateScheduled: 'asc' }, include: { aiReasoning: true } },
          trainingPlan: { include: { userGoal: true } },
        },
      },
    },
  });
}
export type Log = Awaited<ReturnType<typeof buscarLog>>;

type Alvo = {
  paceSecPerKmMin?: number;
  paceSecPerKmMax?: number;
  rpe?: number;
  hrZone?: number;
  hrMinBpm?: number;
  hrMaxBpm?: number;
};
export type Seg = {
  kind: string;
  label?: string;
  end?: { by: string; value: number };
  target?: Alvo;
  repetitions?: number;
  children?: Seg[];
};

export const DIAS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export const DIAS_PT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
// O prompt proíbe metas de FC quando não há FC utilizável; isto pega as formas mais comuns.
const MENCAO_FC = /\d{2,3}\s?bpm|%\s?(da\s)?(FC|fcmáx)|zona\s?[1-5]\s?(de\s)?FC|"hrZone"/i;
// Zonas por reserva cardíaca (50/60/70/80/90%) aceitáveis para cada RPE.
const ZONAS_DO_RPE: Record<number, [number, number]> = {
  1: [1, 2],
  2: [1, 2],
  3: [1, 2],
  4: [2, 3],
  5: [2, 3],
  6: [3, 4],
  7: [3, 4],
  8: [4, 5],
  9: [4, 5],
  10: [4, 5],
};
const ATIVOS = ['warmup', 'work', 'recovery', 'cooldown'];

export interface ProblemasFc {
  ativos: number;
  comZona: number;
  comBpm: number;
  zonaEmTrechoCurto: string[];
  zonaIncoerente: string[];
}

/** No modo FC + RPE: trechos que pedem zona, quantos vieram com zona e bpm, e se a zona bate com o RPE. */
function conferirFc(segs: Seg[], onde: string, acc: ProblemasFc) {
  for (const s of segs) {
    if (s.kind === 'set') {
      conferirFc(s.children ?? [], onde, acc);
      continue;
    }
    if (!ATIVOS.includes(s.kind)) continue;
    const { rpe, hrZone, hrMinBpm } = s.target ?? {};
    // Tiros curtos e recuperações ficam só com pace e RPE.
    if (!heartRateApplies(s as Segment)) {
      if (hrZone != null) acc.zonaEmTrechoCurto.push(`${onde}, ${s.label ?? s.kind}`);
      continue;
    }
    acc.ativos++;
    if (hrZone == null) continue;
    acc.comZona++;
    if (hrMinBpm != null) acc.comBpm++;
    const faixa = rpe != null ? ZONAS_DO_RPE[rpe] : undefined;
    if (faixa && (hrZone < faixa[0] || hrZone > faixa[1])) {
      acc.zonaIncoerente.push(`${onde}, ${s.label ?? s.kind} em RPE ${rpe} e Z${hrZone}`);
    }
  }
}

/** Volume aproximado: trechos por distância usam o pace alvo; por tempo, o pace alvo ou o de conforto. */
export function estimar(segs: Seg[], paceConforto: number): { km: number; min: number } {
  let km = 0;
  let seg = 0;
  for (const s of segs) {
    if (s.kind === 'set') {
      const filho = estimar(s.children ?? [], paceConforto);
      km += filho.km * (s.repetitions ?? 1);
      seg += filho.min * 60 * (s.repetitions ?? 1);
      continue;
    }
    if (!s.end) continue;
    if (s.kind === 'rest') {
      if (s.end.by === 'durationSec') seg += s.end.value;
      continue;
    }
    const { paceSecPerKmMin: min, paceSecPerKmMax: max } = s.target ?? {};
    const pace = min && max ? (min + max) / 2 : (min ?? max ?? paceConforto);
    if (s.end.by === 'distanceM') {
      km += s.end.value / 1000;
      seg += (s.end.value / 1000) * pace;
    } else if (s.end.by === 'durationSec') {
      seg += s.end.value;
      km += s.end.value / pace;
    }
  }
  return { km, min: seg / 60 };
}

/** Quilômetros acima de RPE 4, com as repetições das séries. */
function kmForte(segs: Seg[], paceConforto: number): number {
  let km = 0;
  for (const s of segs) {
    if (s.kind === 'set') {
      km += kmForte(s.children ?? [], paceConforto) * (s.repetitions ?? 1);
      continue;
    }
    if (s.kind === 'rest' || !s.end || (s.target?.rpe ?? 0) <= 4) continue;
    km += estimar([s], paceConforto).km;
  }
  return km;
}

/** Todos os trechos de corrida, abrindo as séries. */
export function folhas(segs: Seg[]): Seg[] {
  return segs.flatMap((s) => (s.kind === 'set' ? folhas(s.children ?? []) : [s]));
}

export type Medicao = ReturnType<typeof medir>;

export function medir(log: Log, caso: Caso, hist: ReturnType<typeof historico>) {
  const onboarding = ONBOARDING[caso.perfil];
  const parsed = log.parsedResponse as {
    aiUsage?: { thinkingTokens?: number; estimatedCostUsd?: number | null };
    analysis?: Record<string, unknown>;
  } | null;
  const prompt = log.promptText;
  const promptSemFc = prompt.includes('Prescreva esforço por RPE');
  const doPrompt = (re: RegExp) => re.exec(prompt)?.[1] ?? null;
  const numero = (re: RegExp) => {
    const v = doPrompt(re);
    return v === null ? null : Number(v);
  };
  const fc = {
    modo: doPrompt(/Modo de prescrição determinado pelo backend: (\S+)\./) ?? '?',
    zonas: [...prompt.matchAll(/^Z([1-5]): (\d+)–(\d+) bpm$/gm)].map(
      ([, z, min, max]) => `Z${z} ${min}–${max}`,
    ),
    ativos: 0,
    comZona: 0,
    comBpm: 0,
    zonaEmTrechoCurto: [] as string[],
    zonaIncoerente: [] as string[],
    mencaoSemFc: [] as string[],
  };
  const volume = {
    base: numero(/Volume-base confiável para progressão: ([\d.]+) km/),
    teto: numero(/Volume máximo planejado desta semana: ([\d.]+) km/),
    fase: doPrompt(/Fase atual do macrociclo: (.+?)\.\n/),
    alvo: numero(/- Volume-alvo: ~([\d.]+) km/),
    longao: numero(/- (?:Longão|Prova): ~([\d.]+) km/),
    semanasParaProva: numero(/Faltam (\d+) semana\(s\) para a prova/),
    semanaDaProva: prompt.includes('SEMANA DA PROVA (é agora'),
  };
  // Prontidão para a distância (motor objetivo): também vale para metas sem tempo alvo.
  const prontidao = doPrompt(/- Resistência para [\d.]+ km: ([^\n]+)/);

  const treinos = log.weeklyGoal.workouts.map((w) => {
    const data = w.dateScheduled.toISOString().slice(0, 10);
    const diaSemana = new Date(`${data}T12:00:00Z`).getUTCDay();
    const segs = (w.segments as { segments?: Seg[] } | null)?.segments ?? [];
    const ativo = w.sportType === 'running' || w.sportType === 'walking';
    const vol = ativo ? estimar(segs, onboarding.comfortPaceSeconds) : { km: 0, min: 0 };
    const texto = JSON.stringify([w.title, w.description, w.aiReasoning?.justification, segs]);
    const onde = `${data} "${w.title}"`;
    if (promptSemFc && ativo && MENCAO_FC.test(texto)) fc.mencaoSemFc.push(onde);
    if (!promptSemFc && ativo) conferirFc(segs, onde, fc);
    const corrida = folhas(segs).filter((s) => ATIVOS.includes(s.kind));
    const trabalho = corrida.filter((s) => s.kind === 'work');
    const rpes = corrida.map((s) => s.target?.rpe).filter((r): r is number => r != null);
    return {
      data,
      dia: DIAS_PT[diaSemana],
      diaEn: DIAS[diaSemana],
      titulo: w.title,
      esporte: w.sportType,
      ativo,
      intensidade: w.intensity,
      tentativa: w.isGoalAttempt,
      km: vol.km,
      min: vol.min,
      rpeMax: rpes.length ? Math.max(...rpes) : null,
      rpeTrabalhoMax: Math.max(0, ...trabalho.map((s) => s.target?.rpe ?? 0)),
      kmForte: ativo ? kmForte(segs, onboarding.comfortPaceSeconds) : 0,
      trechos: corrida.map((s) => ({
        tipo: s.kind,
        por: s.end?.by ?? null,
        valor: s.end?.value ?? null,
        rpe: s.target?.rpe ?? null,
        paceMin: s.target?.paceSecPerKmMin ?? null,
        paceMax: s.target?.paceSecPerKmMax ?? null,
      })),
      estrutura: ativo ? resumirSegmentos(segs) : '',
      texto: [w.title, w.description, w.aiReasoning?.justification].filter(Boolean).join(' '),
      justificativa: w.aiReasoning?.justification ?? null,
    };
  });

  const corridas = treinos.filter((t) => t.ativo);
  const km = corridas.reduce((t, c) => t + c.km, 0);
  const goal = log.weeklyGoal.trainingPlan.userGoal;
  return {
    tipo: log.generationType,
    modelo: log.modelUsed,
    versaoPrompt: log.promptVersion,
    custoUsd: parsed?.aiUsage?.estimatedCostUsd ?? null,
    tokensRaciocinio: parsed?.aiUsage?.thinkingTokens ?? null,
    promptSemFc,
    fc,
    volume,
    prontidao,
    meta: goal?.parsedGoal ?? null,
    viabilidade: (goal?.feasibility ?? null) as Record<string, any> | null,
    analise: (parsed?.analysis ?? null) as {
      title?: string;
      fitnessInsights?: string;
      period?: string;
    } | null,
    historico: hist,
    plano: {
      corridas: corridas.length,
      km,
      min: corridas.reduce((t, c) => t + c.min, 0),
      longao: Math.max(0, ...corridas.map((c) => c.km)),
    },
    treinos,
  };
}

const ROTULO: Record<string, string> = {
  warmup: 'aquec.',
  cooldown: 'desaq.',
  recovery: 'rec.',
  rest: 'pausa',
};

export function resumirSegmentos(segs: Seg[]): string {
  return segs
    .map((s) => {
      if (s.kind === 'set') {
        return `${s.repetitions ?? 1}×(${resumirSegmentos(s.children ?? []).replace(/ · /g, ' + ')})`;
      }
      const t = s.target ?? {};
      const pace =
        t.paceSecPerKmMin || t.paceSecPerKmMax
          ? `${minSeg(t.paceSecPerKmMin ?? t.paceSecPerKmMax!)}–${minSeg(t.paceSecPerKmMax ?? t.paceSecPerKmMin!)}/km`
          : '';
      return [
        ROTULO[s.kind] ?? '',
        quantidade(s.end),
        pace,
        t.rpe != null ? `RPE ${t.rpe}` : '',
        t.hrZone != null
          ? `Z${t.hrZone}${t.hrMinBpm != null ? ` ${t.hrMinBpm}–${t.hrMaxBpm} bpm` : ' FC'}`
          : '',
      ]
        .filter(Boolean)
        .join(' ');
    })
    .join(' · ');
}

function quantidade(end?: { by: string; value: number }) {
  if (!end) return '';
  if (end.by === 'distanceM')
    return end.value >= 1000 ? `${+(end.value / 1000).toFixed(2)} km` : `${end.value} m`;
  if (end.by === 'durationSec')
    return end.value >= 120 ? `${+(end.value / 60).toFixed(1)} min` : `${end.value} s`;
  return `${end.value} reps`;
}

export const minSeg = (s: number) => {
  const t = Math.round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
export const hms = (s: number) =>
  s >= 3600
    ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}`
    : minSeg(s);
export const dataBr = (iso: string) => iso.split('-').reverse().join('/');
