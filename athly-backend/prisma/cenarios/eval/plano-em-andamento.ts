/**
 * Plano em andamento: semeia no banco local as semanas já treinadas de um plano de meia (treinos
 * prescritos, execução e feedback) e monta, a partir da mesma descrição, o Health que o app
 * mandaria. No app real essa situação leva semanas de uso; aqui ela é montada direto, para testar
 * a geração de uma semana do meio ou do fim do plano.
 *
 * O plano tem 12 semanas de preparação e a da prova. A fase, o volume-alvo e o esqueleto das
 * semanas futuras vêm do `buildMacrocycle` do backend, calculado no início do plano como a
 * primeira geração faria. Os longões seguem uma progressão clássica (12 → 18 km), não o
 * esqueleto: é o que um atleta que treina para uma meia corre.
 *
 *   disciplinado — fez tudo o que foi prescrito e um teste de 10 km em 49:30 três semanas antes
 *                  da prova (VDOT ~40,5; a meta de 2h pede 36,5). Garmin com FC e FC de repouso.
 *   irregular    — fez ~60% dos treinos, pulou longões (maior corrida 15 km) e o melhor esforço
 *                  é um 10 km em 53:50 (VDOT ~36,7, no limite da meta). iPhone, sem FC.
 */
import { createHash } from 'node:crypto';
import type { PlannedWeek } from '../../../src/modules/ai-planner/periodization';
import { buildMacrocycle } from '../../../src/modules/ai-planner/periodization';
import { parseTargetDistanceMeters } from '../../../src/modules/ai-planner/goal-feasibility';
import { calculateVdot } from '../../../src/modules/effort-zones/vdot-calculator';
import { flattenToLegacyBlocks } from '../../../src/modules/workouts/utils/flatten-to-legacy';
import {
  SEGMENT_SCHEMA_VERSION,
  type Segment,
} from '../../../src/modules/workouts/types/segment.types';
import { prisma } from '../base';
import { civil, segundaDaSemana, somarDias } from './casos';
import type { Corrida, Health, SessaoDetalhada } from './health';

export const SEMANAS_DE_PREPARACAO = 12;
export type Persona = 'disciplinado' | 'irregular';
type Tipo = 'leve' | 'qualidade' | 'longao';

/** Dias de treino das duas personas (deslocamento a partir da segunda): ter, qui, sáb, dom. */
const DIAS = [1, 3, 5, 6];
// Mesma leitura do app (HealthRunWindow no iOS): as corridas das últimas 9 semanas, no mínimo as
// 20 mais recentes e no máximo 60; sessões detalhadas com o limite do plano ativo.
const JANELA_DIAS = 63;
const MINIMO_CORRIDAS = 20;
const MAXIMO_CORRIDAS = 60;
const SESSOES_DETALHADAS = 7;

interface Especial {
  semana: number;
  dia: number;
  titulo: string;
  km: number;
  pace: number;
  rpe: number;
  esforco: number;
  fc?: number;
}

interface DescricaoPersona {
  volumeInicialKm: number;
  longaoInicialKm: number;
  /** Longão prescrito em cada semana de preparação. */
  longoes: number[];
  /** Por semana, uma letra por dia de treino (ter, qui, sáb, dom): d feito, p parcial, s pulado. */
  execucao: string[];
  /** Paces (s/km) no início do plano: rodagem, longão e o trecho forte dos treinos de qualidade. */
  pace: { leve: number; longao: number; forte: number };
  /** Quanto o pace melhora por semana (s/km). */
  ganhoPorSemana: number;
  esforco: Record<Tipo, number>;
  fadiga: number;
  fonte: string;
  splits: 'route' | 'synthetic';
  fc: (Record<Tipo, number> & { repouso: number }) | null;
  especiais: Especial[];
  /** Corridas fora do plano (só no Health). */
  avulsas: { semana: number; dia: number; km: number; pace: number }[];
}

const PERSONAS: Record<Persona, DescricaoPersona> = {
  disciplinado: {
    volumeInicialKm: 28,
    longaoInicialKm: 12,
    longoes: [12, 13, 14, 12, 15, 16, 17, 14, 18, 16, 13, 10],
    execucao: Array.from({ length: SEMANAS_DE_PREPARACAO }, () => 'dddd'),
    pace: { leve: 370, longao: 362, forte: 312 },
    ganhoPorSemana: 1.5,
    esforco: { leve: 3, qualidade: 6, longao: 5 },
    fadiga: 3,
    fonte: 'com.garmin.connect.mobile',
    splits: 'route',
    fc: { leve: 138, qualidade: 154, longao: 145, repouso: 50 },
    especiais: [
      {
        semana: 9,
        dia: 3,
        titulo: 'Teste de 10 km',
        km: 10,
        pace: 297,
        rpe: 9,
        esforco: 9,
        fc: 176,
      },
    ],
    avulsas: [],
  },
  irregular: {
    volumeInicialKm: 22,
    longaoInicialKm: 10,
    longoes: [10, 11, 12, 10, 13, 14, 15, 12, 16, 16, 13, 10],
    execucao: [
      'ddsd',
      'dsdd',
      'sddp',
      'ddss',
      'dssd',
      'sddp',
      'dsdd',
      'ddsd',
      'sdsp',
      'dsds',
      'ddsd',
      'sdds',
    ],
    pace: { leve: 405, longao: 395, forte: 335 },
    ganhoPorSemana: 0.3,
    esforco: { leve: 5, qualidade: 8, longao: 7 },
    fadiga: 6,
    fonte: 'com.apple.health',
    splits: 'synthetic',
    fc: null,
    especiais: [
      { semana: 10, dia: 3, titulo: 'Ritmo de prova', km: 10, pace: 323, rpe: 7, esforco: 8 },
    ],
    avulsas: [
      { semana: 9, dia: 0, km: 5, pace: 400 },
      { semana: 11, dia: 2, km: 6, pace: 410 },
    ],
  },
};

const QUALIDADE: Record<PlannedWeek['phase'], { titulo: string; rpe: number; folga: number }> = {
  // folga: quanto o trecho forte fica mais lento que o pace de limiar (s/km).
  base: { titulo: 'Rodagem com acelerações', rpe: 4, folga: 40 },
  build: { titulo: 'Tempo run', rpe: 7, folga: 0 },
  peak: { titulo: 'Ritmo de prova', rpe: 6, folga: 25 },
  taper: { titulo: 'Toque no ritmo de prova', rpe: 6, folga: 25 },
  race: { titulo: 'Ritmo de prova', rpe: 6, folga: 25 },
};

interface Prescricao {
  data: Date;
  tipo: Tipo;
  titulo: string;
  km: number;
  rpe: number;
  /** Pace do trecho principal (s/km). */
  paceTrabalho: number;
  especial?: Especial;
}

const meio = (km: number) => Math.round(km * 2) / 2;
const hash = (texto: string) => createHash('sha256').update(texto).digest('hex');

/** UUID estável (formato v4) para o mesmo treino em toda execução do eval. */
function uuid(semente: string) {
  const h = hash(semente);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${'89ab'[parseInt(h[16], 16) % 4]}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function prescricoes(
  p: DescricaoPersona,
  semana: number,
  inicio: Date,
  fase: PlannedWeek,
): Prescricao[] {
  const segunda = somarDias(inicio, 7 * semana);
  const ganho = p.ganhoPorSemana * semana;
  const longao = p.longoes[semana];
  const resto = Math.max(fase.targetVolumeKm - longao, 9);
  const qualidadeKm = meio(resto * 0.36);
  const tercaKm = meio(resto * 0.34);
  const q = QUALIDADE[fase.phase];
  const lista: Prescricao[] = [
    {
      data: somarDias(segunda, 1),
      tipo: 'leve',
      titulo: 'Rodagem leve',
      km: tercaKm,
      rpe: 3,
      paceTrabalho: p.pace.leve - ganho,
    },
    {
      data: somarDias(segunda, 3),
      tipo: 'qualidade',
      titulo: q.titulo,
      km: qualidadeKm,
      rpe: q.rpe,
      paceTrabalho: p.pace.forte - ganho + q.folga,
    },
    {
      data: somarDias(segunda, 5),
      tipo: 'leve',
      titulo: 'Rodagem regenerativa',
      km: meio(resto - qualidadeKm - tercaKm),
      rpe: 2,
      paceTrabalho: p.pace.leve - ganho + 10,
    },
    {
      data: somarDias(segunda, 6),
      tipo: 'longao',
      titulo: 'Longão',
      km: longao,
      rpe: 4,
      paceTrabalho: p.pace.longao - ganho,
    },
  ];
  for (const e of p.especiais.filter((x) => x.semana === semana)) {
    const i = DIAS.indexOf(e.dia);
    lista[i] = {
      ...lista[i],
      titulo: e.titulo,
      km: e.km,
      rpe: e.rpe,
      paceTrabalho: e.pace,
      especial: e,
    };
  }
  return lista;
}

/** Aquecimento, trecho principal e volta à calma, como o planner gera. */
function segmentos(pr: Prescricao, id: string): Segment[] {
  if (pr.especial) {
    return [
      {
        id: `${id}-w`,
        kind: 'work',
        end: { by: 'distanceM', value: pr.km * 1000 },
        target: {
          rpe: pr.rpe,
          paceSecPerKmMin: pr.paceTrabalho - 5,
          paceSecPerKmMax: pr.paceTrabalho + 10,
        },
      },
    ];
  }
  const volta = pr.km >= 5 ? 1000 : 500;
  return [
    { id: `${id}-a`, kind: 'warmup', end: { by: 'distanceM', value: 1000 }, target: { rpe: 3 } },
    {
      id: `${id}-w`,
      kind: 'work',
      end: { by: 'distanceM', value: Math.round(pr.km * 1000 - 1000 - volta) },
      target: {
        rpe: pr.rpe,
        paceSecPerKmMin: Math.round(pr.paceTrabalho - 10),
        paceSecPerKmMax: Math.round(pr.paceTrabalho + 15),
      },
    },
    { id: `${id}-c`, kind: 'cooldown', end: { by: 'distanceM', value: volta }, target: { rpe: 2 } },
  ];
}

/** Splits por km de uma corrida feita: aquecimento e volta à calma no pace leve. */
function splits(
  km: number,
  paceTrabalho: number,
  paceLeve: number,
  qualidade: boolean,
  fade: number,
  fc: number | undefined,
): SessaoDetalhada['segments'] {
  const inteiros = Math.floor(km);
  const distancias = [
    ...Array<number>(inteiros).fill(1),
    ...(km - inteiros > 0.05 ? [km - inteiros] : []),
  ];
  return distancias.map((d, i) => {
    const progresso = distancias.length > 1 ? i / (distancias.length - 1) : 0.5;
    const ponta = qualidade && (i === 0 || i === distancias.length - 1);
    const pace = (ponta ? paceLeve : paceTrabalho) * (1 + fade * (progresso - 0.5));
    return {
      label: 'easy',
      distanceKm: Math.round(d * 1000) / 1000,
      durationSeconds: Math.round(pace * d),
      avgPaceSecondsPerKm: Math.round(pace),
      ...(fc ? { avgHR: Math.round(fc + 10 * (progresso - 0.5)) } : {}),
    };
  });
}

function emIso(data: Date, hora: number, minuto = 0) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate(), hora, minuto).toISOString();
}

export interface ResumoPlano {
  inicio: string;
  semanasFeitas: number;
  prescritos: number;
  feitos: number;
  parciais: number;
  pulados: number;
  avulsas: number;
  kmUltimas4: number;
  maiorRecenteKm: number;
  melhorEsforco: { km: number; segundos: number; vdot: number } | null;
  fonte: string;
  comFc: boolean;
  /** Semana atual no esqueleto do backend (fase, alvo e longão de referência). */
  semanaAtual: PlannedWeek | null;
}

/**
 * Semeia o plano da conta (que já tem a meta ativa do onboarding) até a semana anterior à
 * atual e devolve o Health que o app mandaria para gerar a semana atual.
 */
export async function semearPlano(
  persona: Persona,
  userId: string,
  semanasAteProva: number,
  hoje = new Date(),
): Promise<{ health: Health; resumo: ResumoPlano }> {
  const p = PERSONAS[persona];
  const goal = await prisma.userGoal.findFirstOrThrow({
    where: { userId, active: true },
    orderBy: { createdAt: 'desc' },
  });
  const parsed = goal.parsedGoal as {
    summary?: string;
    targetDistance?: string;
    eventDate?: string;
    experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
  };
  const semanaAtual = SEMANAS_DE_PREPARACAO - semanasAteProva;
  const segundaAtual = segundaDaSemana(hoje);
  const inicio = somarDias(segundaAtual, -7 * semanaAtual);
  const macro = buildMacrocycle({
    startMondayISO: civil(inicio),
    eventDate: parsed.eventDate!,
    targetDistanceMeters: parseTargetDistanceMeters(parsed.targetDistance) ?? 21097.5,
    currentWeeklyVolumeKm: p.volumeInicialKm,
    experienceLevel: parsed.experienceLevel ?? null,
    recentLongestRunKm: p.longaoInicialKm,
  });
  if (macro.length !== SEMANAS_DE_PREPARACAO + 1) {
    throw new Error(
      `Macrociclo com ${macro.length} semanas; o eval espera ${SEMANAS_DE_PREPARACAO + 1}.`,
    );
  }

  const plano = await prisma.trainingPlan.create({
    data: {
      userId,
      startDate: civil(inicio),
      objective: parsed.summary ?? 'Meia maratona',
      status: 'ACTIVE',
      sports: ['running'],
      autoGenerate: true,
      userGoalId: goal.id,
      targetDate: new Date(parsed.eventDate!),
      createdAt: somarDias(inicio, -1),
    },
  });

  const corridas: (Corrida & { qualidade: boolean; paceTrabalho: number; paceLeve: number })[] = [];
  const resumo: ResumoPlano = {
    inicio: civil(inicio),
    semanasFeitas: semanaAtual,
    prescritos: 0,
    feitos: 0,
    parciais: 0,
    pulados: 0,
    avulsas: 0,
    kmUltimas4: 0,
    maiorRecenteKm: 0,
    melhorEsforco: null,
    fonte: p.fonte,
    comFc: p.fc !== null,
    semanaAtual: macro[semanaAtual] ?? null,
  };
  const quatroSemanasAntes = somarDias(segundaAtual, -28);

  for (let semana = 0; semana < semanaAtual; semana++) {
    const fase = macro[semana];
    const segunda = somarDias(inicio, 7 * semana);
    const domingo = somarDias(segunda, 6);
    const lista = prescricoes(p, semana, inicio, fase);
    let kmSemana = 0;
    let tempoSemana = 0;
    const semanaDb = await prisma.weeklyGoal.create({
      data: {
        trainingPlanId: plano.id,
        weekStartDate: new Date(civil(segunda)),
        weekEndDate: new Date(civil(domingo)),
        status: 'GENERATED',
        closedAt: new Date(domingo.getFullYear(), domingo.getMonth(), domingo.getDate(), 21),
        closureReason: 'last_workout',
        createdAt: new Date(segunda.getFullYear(), segunda.getMonth(), segunda.getDate() - 1, 20),
        metrics: {},
      },
    });
    for (const [i, pr] of lista.entries()) {
      const letra = p.execucao[semana][i];
      const semente = `${persona}-${semana}-${i}`;
      const id = uuid(`treino-${semente}`);
      const feito = letra !== 's';
      const fracao =
        letra === 'p'
          ? 0.7
          : pr.especial
            ? 1
            : 1 + ((parseInt(hash(semente).slice(0, 2), 16) % 5) - 2) / 100;
      const km = Math.round(pr.km * fracao * 100) / 100;
      const paceLeve = p.pace.leve - p.ganhoPorSemana * semana;
      const qualidade = pr.tipo === 'qualidade' && !pr.especial;
      // Pace médio da corrida: no treino de qualidade, 2 km leves em volta do trecho forte.
      const paceMedio =
        (qualidade && km > 2 ? (2 * paceLeve + (km - 2) * pr.paceTrabalho) / km : pr.paceTrabalho) +
        (letra === 'p' ? 10 : 0);
      const segundos = Math.round(km * paceMedio);
      const fc = p.fc ? (pr.especial?.fc ?? p.fc[pr.tipo]) : undefined;
      const hkId = feito ? uuid(`hk-${semente}`) : null;
      resumo.prescritos++;
      if (letra === 'd') resumo.feitos++;
      else if (letra === 'p') resumo.parciais++;
      else resumo.pulados++;
      const segs = segmentos(pr, id);
      await prisma.workout.create({
        data: {
          id,
          trainingPlanId: plano.id,
          weeklyGoalId: semanaDb.id,
          userId,
          dateScheduled: new Date(civil(pr.data)),
          sportType: 'running',
          title: pr.titulo,
          description: `${pr.titulo}: ${pr.km} km.`,
          blocks: flattenToLegacyBlocks(segs) as object[],
          segments: {
            schemaVersion: SEGMENT_SCHEMA_VERSION,
            sport: 'running',
            segments: segs,
          } as object,
          status: letra === 'd' ? 'done' : letra === 'p' ? 'partial' : 'skipped',
          intensity: pr.rpe,
          actualDistanceMeters: feito ? km * 1000 : null,
          actualDurationSeconds: feito ? segundos : null,
          appleHealthWorkoutUUID: hkId,
          feedback: feito
            ? {
                create: {
                  userId,
                  completed: true,
                  effort: pr.especial?.esforco ?? p.esforco[pr.tipo],
                  fatigue: fase.phase === 'taper' ? Math.max(1, p.fadiga - 1) : p.fadiga,
                },
              }
            : undefined,
        },
      });
      if (!feito) continue;
      kmSemana += km;
      tempoSemana += segundos;
      const inicioCorrida = emIso(
        pr.data,
        pr.tipo === 'longao' ? 6 : 7,
        pr.tipo === 'longao' ? 30 : 0,
      );
      corridas.push({
        startDate: inicioCorrida,
        endDate: new Date(new Date(inicioCorrida).getTime() + segundos * 1000).toISOString(),
        distanceMeters: Math.round(km * 1000),
        durationSeconds: segundos,
        averagePaceSecondsPerKm: Math.round(paceMedio),
        ...(fc ? { avgHR: fc, maxHR: fc + 12 } : {}),
        appleHealthWorkoutUUID: hkId!,
        sourceBundleIdentifier: p.fonte,
        wasUserEntered: false,
        qualidade,
        paceTrabalho: pr.paceTrabalho,
        paceLeve,
      });
      if (pr.data >= quatroSemanasAntes) {
        resumo.kmUltimas4 += km;
        resumo.maiorRecenteKm = Math.max(resumo.maiorRecenteKm, km);
      }
    }
    for (const [i, a] of p.avulsas.filter((x) => x.semana === semana).entries()) {
      const data = somarDias(segunda, a.dia);
      const segundos = Math.round(a.km * a.pace);
      const inicioCorrida = emIso(data, 18);
      resumo.avulsas++;
      kmSemana += a.km;
      tempoSemana += segundos;
      corridas.push({
        startDate: inicioCorrida,
        endDate: new Date(new Date(inicioCorrida).getTime() + segundos * 1000).toISOString(),
        distanceMeters: a.km * 1000,
        durationSeconds: segundos,
        averagePaceSecondsPerKm: a.pace,
        appleHealthWorkoutUUID: uuid(`avulsa-${persona}-${semana}-${i}`),
        sourceBundleIdentifier: p.fonte,
        wasUserEntered: false,
        qualidade: false,
        paceTrabalho: a.pace,
        paceLeve: a.pace,
      });
      if (data >= quatroSemanasAntes) resumo.kmUltimas4 += a.km;
    }
    // Métricas da semana como a geração grava (a análise da IA): o pace médio entra na tendência.
    const pace = kmSemana ? tempoSemana / kmSemana : 0;
    await prisma.weeklyGoal.update({
      where: { id: semanaDb.id },
      data: {
        metrics: {
          title: `Semana ${semana + 1}`,
          period: `${civil(segunda)} — ${civil(domingo)}`,
          avgPace: pace
            ? `${Math.floor(pace / 60)}:${String(Math.round(pace % 60)).padStart(2, '0')} /km`
            : 'N/A',
          totalDistanceKm: Math.round(kmSemana * 10) / 10,
          trend: 'stable',
          ...fase,
        },
      },
    });
  }

  // A semana atual e as seguintes ficam como esqueleto (PLANNED), como a primeira geração deixou.
  for (const fase of macro.slice(semanaAtual)) {
    await prisma.weeklyGoal.create({
      data: {
        trainingPlanId: plano.id,
        weekStartDate: new Date(fase.weekStartDate),
        weekEndDate: new Date(fase.weekEndDate),
        status: 'PLANNED',
        metrics: fase as unknown as object,
      },
    });
  }

  corridas.sort((a, b) => b.startDate.localeCompare(a.startDate));
  const inicioJanela = new Date(hoje.getTime() - JANELA_DIAS * 86_400_000);
  const naJanela = corridas.filter((c) => new Date(c.startDate) >= inicioJanela);
  const enviadas = (
    naJanela.length >= MINIMO_CORRIDAS ? naJanela : corridas.slice(0, MINIMO_CORRIDAS)
  ).slice(0, MAXIMO_CORRIDAS);
  // Como o app: com tudo lido, um ano; com a janela inteira, o início dela; senão, a mais antiga.
  const lidasDesde =
    enviadas.length === corridas.length
      ? new Date(hoje.getTime() - 365 * 86_400_000)
      : enviadas.length === naJanela.length && naJanela.length >= MINIMO_CORRIDAS
        ? inicioJanela
        : new Date(enviadas[enviadas.length - 1].startDate);
  for (const c of enviadas.filter((x) => x.distanceMeters >= 1500)) {
    const vdot = calculateVdot(c.distanceMeters, c.durationSeconds);
    if (!resumo.melhorEsforco || vdot > resumo.melhorEsforco.vdot) {
      resumo.melhorEsforco = {
        km: c.distanceMeters / 1000,
        segundos: c.durationSeconds,
        vdot: Math.round(vdot * 10) / 10,
      };
    }
  }
  const detalhadas: SessaoDetalhada[] = enviadas.slice(0, SESSOES_DETALHADAS).map((c) => ({
    startDate: c.startDate,
    appleHealthWorkoutUUID: c.appleHealthWorkoutUUID,
    distanceMeters: c.distanceMeters,
    durationSeconds: c.durationSeconds,
    averagePaceSecondsPerKm: c.averagePaceSecondsPerKm,
    ...(c.avgHR ? { avgHR: c.avgHR, maxHR: c.maxHR } : {}),
    segments:
      p.splits === 'route'
        ? splits(c.distanceMeters / 1000, c.paceTrabalho, c.paceLeve, c.qualidade, 0.03, c.avgHR)
        : splits(
            c.distanceMeters / 1000,
            c.averagePaceSecondsPerKm,
            c.averagePaceSecondsPerKm,
            false,
            0,
            undefined,
          ),
    splitsSource: p.splits,
  }));
  const runs: Corrida[] = enviadas.map(
    ({ qualidade: _q, paceTrabalho: _t, paceLeve: _l, ...corrida }) => corrida,
  );
  const ontem = somarDias(hoje, -1);
  return {
    health: {
      entrada: {
        runs,
        detailedSessions: detalhadas,
        weekStartDate: civil(segundaAtual),
        runsReadFrom: lidasDesde.toISOString(),
      },
      fcRepouso: p.fc
        ? {
            restingHeartRate: p.fc.repouso,
            measuredAt: emIso(ontem, 6),
            capturedAt: new Date().toISOString(),
          }
        : null,
    },
    resumo: { ...resumo, kmUltimas4: Math.round(resumo.kmUltimas4 * 10) / 10 },
  };
}
