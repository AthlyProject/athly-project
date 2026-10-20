/**
 * Candidatos a "melhor esforço" para o VDOT: o total de cada corrida e os sub-esforços limpos das
 * sessões detalhadas. Compartilhado pela geração do plano e pela análise da meta, para as duas
 * chegarem ao mesmo VDOT com o mesmo Health.
 */
import type { RunDataForZones } from '../effort-zones/types/effort-zone.types';
import {
  SegmentLabel,
  type DetailedSessionDto,
  type HealthRunItemDto,
} from './dto/plan-from-health.dto';

// Piso de distância para um esforço entrar como candidato a "melhor esforço" do VDOT.
// Esforços curtos demais rodam em regime supramáximo e distorcem a estimativa.
const MIN_EFFORT_METERS = 1500;
// Tiros são corridos QUEBRADOS por recuperação; um esforço contínuo no mesmo pace não é
// sustentável. Penaliza ~5% a duração-equivalente do bloco de tiros para não superestimar
// o VDOT ao tratá-lo como se fosse uma corrida contínua. Knob de calibração — validar
// contra tabelas de Daniels antes de mexer.
const REP_EFFORT_PENALTY = 1.05;

/** Corridas inteiras mais os sub-esforços das sessões detalhadas. */
export function zoneCandidates(
  runs: HealthRunItemDto[],
  sessions: DetailedSessionDto[],
): RunDataForZones[] {
  return [
    ...runs.map((r) => ({
      distanceMeters: r.distanceMeters,
      durationSeconds: r.durationSeconds,
      averageHeartRate: r.avgHR ?? null,
      maxHeartRate: r.maxHR ?? null,
    })),
    ...effortCandidatesFromSessions(sessions),
  ];
}

/**
 * Candidatos de esforço LIMPO para o cálculo de VDOT a partir de sessões detalhadas.
 * O pace médio de corrida inteira subestima o atleta — e uma janela contínua que inclua
 * as recuperações entre tiros também (era o bug: tiros sub-5'00 saíam diluídos pelos
 * trotes e o VDOT vinha baixo). Em vez disso, por sessão extraímos:
 *   (1) candidato de qualidade: os tiros (`rep`) concatenados, SEM as recuperações;
 *   (2) candidato sustentado: a melhor janela contínua (>= MIN_EFFORT_METERS) de blocos
 *       de esforço estável (`tempo`/`easy`), excluindo tiros e recuperações.
 * findBestEffort escolhe depois o de VDOT mais alto entre todos os candidatos. Sessões
 * `synthetic` (Garmin/Nike só com totais via Apple Health) não têm splits reais e são
 * ignoradas — caem no piso dos totais de input.runs.
 */
export function effortCandidatesFromSessions(sessions: DetailedSessionDto[]): RunDataForZones[] {
  const candidates: RunDataForZones[] = [];
  for (const session of sessions) {
    if (session.splitsSource === 'synthetic') continue;
    const segs = session.segments ?? [];

    // (1) Qualidade: soma só dos tiros (rep), recuperações fora. Captura a velocidade
    // real dos tiros sem a diluição dos trotes.
    const reps = segs.filter(
      (s) => s.label === SegmentLabel.rep && s.distanceKm > 0 && s.durationSeconds > 0,
    );
    const repDistM = reps.reduce((sum, s) => sum + s.distanceKm * 1000, 0);
    const repDurSec = reps.reduce((sum, s) => sum + s.durationSeconds, 0);
    if (repDistM >= MIN_EFFORT_METERS && repDurSec > 0) {
      candidates.push({
        distanceMeters: repDistM,
        durationSeconds: repDurSec * REP_EFFORT_PENALTY,
        averageHeartRate: null,
        maxHeartRate: null,
      });
    }

    // (2) Sustentado: melhor janela contínua de tempo/easy (sem rep/rec). Cobre tempo
    // runs e o trecho mais rápido de corridas steady/progressivas.
    const steady = segs.filter(
      (s) =>
        (s.label === SegmentLabel.tempo || s.label === SegmentLabel.easy) &&
        s.distanceKm > 0 &&
        s.durationSeconds > 0,
    );
    const best = bestContinuousWindow(steady);
    if (best) {
      candidates.push({
        distanceMeters: best.distM,
        durationSeconds: best.durSec,
        averageHeartRate: null,
        maxHeartRate: null,
      });
    }
  }
  return candidates;
}

/**
 * Melhor (mais rápida) janela contígua de >= MIN_EFFORT_METERS a partir de uma lista de
 * splits de esforço estável já filtrada. Janela mínima a partir de cada início: janelas
 * maiores só diluiriam o pace.
 */
function bestContinuousWindow(
  segs: Array<{ distanceKm: number; durationSeconds: number }>,
): { distM: number; durSec: number } | null {
  let best: { distM: number; durSec: number } | null = null;
  for (let i = 0; i < segs.length; i++) {
    let distM = 0;
    let durSec = 0;
    for (let j = i; j < segs.length; j++) {
      distM += segs[j].distanceKm * 1000;
      durSec += segs[j].durationSeconds;
      if (distM >= MIN_EFFORT_METERS) {
        const pace = durSec / (distM / 1000);
        const bestPace = best ? best.durSec / (best.distM / 1000) : Infinity;
        if (pace < bestPace) best = { distM, durSec };
        break;
      }
    }
  }
  return best;
}
