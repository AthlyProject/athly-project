/**
 * O Health que o app manda ao backend. Nos perfis do iOS ele sai do MockHealthKitService real
 * (compilado com `health/main.swift`), então o eval envia o mesmo que o simulador; nas contas de
 * plano em andamento, de `plano-em-andamento.ts`.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { SAIDA, type Cenario } from '../base';

export type Corrida = {
  startDate: string;
  endDate?: string;
  distanceMeters: number;
  durationSeconds: number;
  averagePaceSecondsPerKm: number;
  avgHR?: number;
  maxHR?: number;
  appleHealthWorkoutUUID?: string;
  sourceBundleIdentifier?: string;
  wasUserEntered?: boolean;
};

export type SessaoDetalhada = {
  startDate: string;
  appleHealthWorkoutUUID?: string;
  distanceMeters: number;
  durationSeconds: number;
  averagePaceSecondsPerKm?: number;
  avgHR?: number;
  maxHR?: number;
  segments: {
    label: string;
    distanceKm: number;
    durationSeconds: number;
    avgPaceSecondsPerKm?: number;
    avgHR?: number;
  }[];
  splitsSource?: string;
};

/** Corpo de POST /ai-planner/plan-from-health/async. */
export type EntradaApp = {
  runs: Corrida[];
  detailedSessions?: SessaoDetalhada[];
  weekStartDate?: string;
  /** Desde quando o app leu todas as corridas (leitura por janela). */
  runsReadFrom?: string;
};

/** Corpo de PUT /users/me/heart-rate-health; null quando o perfil não tem FC de repouso. */
export type FcRepouso = { restingHeartRate: number; measuredAt: string; capturedAt: string } | null;

export type Health = { entrada: EntradaApp; fcRepouso: FcRepouso };

const IOS = join(__dirname, '..', '..', '..', '..', 'athly-ios', 'AthlyRunner');
/** Arquivos do app que o MockHealthKitService precisa para compilar fora do simulador. */
const ARQUIVOS_IOS = [
  'Services/MockHealthKitService.swift',
  'Models/HealthKitRunItem.swift',
  'Models/APIModels.swift',
  'Utils/LocalizedFormatting.swift',
  'Services/StreakCalculator.swift',
  'Services/HealthRunWindow.swift',
];

export function healthDoIos(perfis: Cenario[]): Partial<Record<Cenario, Health>> {
  if (!perfis.length) return {};
  const binario = join(SAIDA, '.bin', 'cenarios-health');
  mkdirSync(join(SAIDA, '.bin'), { recursive: true });
  const fontes = [
    join(__dirname, '..', 'health', 'main.swift'),
    ...ARQUIVOS_IOS.map((f) => join(IOS, f)),
  ];
  try {
    execFileSync('swiftc', ['-O', '-o', binario, ...fontes], { stdio: 'pipe' });
  } catch (error) {
    const stderr = (error as { stderr?: Buffer }).stderr?.toString() ?? '';
    throw new Error(`Falha ao compilar o Health simulado do iOS:\n${stderr.slice(0, 2000)}`);
  }
  const entradas: Partial<Record<Cenario, Health>> = {};
  for (const perfil of perfis) {
    const saida = execFileSync(binario, {
      env: { ...process.env, ATHLY_HEALTH_SCENARIO: perfil },
    });
    const { request, heartRateHealth } = JSON.parse(saida.toString()) as {
      request: EntradaApp;
      heartRateHealth?: FcRepouso;
    };
    entradas[perfil] = { entrada: request, fcRepouso: heartRateHealth ?? null };
  }
  return entradas;
}

/** Resumo do histórico enviado: volume e maior corrida das 4 semanas antes de `ate`. */
export function historico(entrada: EntradaApp, ate = new Date()) {
  const limite = ate.getTime() - 28 * 86_400_000;
  const recentes = entrada.runs.filter((r) => {
    const t = new Date(r.startDate).getTime();
    return t >= limite && t < ate.getTime();
  });
  const km = (rs: Corrida[]) => rs.reduce((t, r) => t + r.distanceMeters, 0) / 1000;
  const tempo = entrada.runs.reduce((t, r) => t + r.durationSeconds, 0);
  return {
    corridas: entrada.runs.length,
    kmSemana: km(recentes) / 4,
    maiorKm: Math.max(0, ...recentes.map((r) => Math.round(r.distanceMeters / 100) / 10)),
    paceMedio: entrada.runs.length ? tempo / km(entrada.runs) : null,
    comFc: entrada.runs.some((r) => r.avgHR != null),
    splits: [...new Set((entrada.detailedSessions ?? []).map((s) => s.splitsSource ?? '?'))],
  };
}
