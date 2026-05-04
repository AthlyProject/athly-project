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
}

export interface ExecutionAnalysis {
  meanRepPace?: string;
  fastestRep?: string;
  slowestRep?: string;
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
  ): Promise<AnalyzedSession[]> {
    if (sessions.length === 0) return [];

    const workoutIds = sessions
      .map((s) => s.athlyWorkoutId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    const uuids = sessions.map((s) => s.appleHealthWorkoutUUID);

    const linkedByWorkoutId = new Map<string, Awaited<ReturnType<PrismaService['workout']['findMany']>>[number]>();
    const linkedByUuid = new Map<string, Awaited<ReturnType<PrismaService['workout']['findMany']>>[number]>();

    if (workoutIds.length > 0 || uuids.length > 0) {
      const workouts = await this.prisma.workout.findMany({
        where: {
          userId,
          OR: [
            { id: { in: workoutIds } },
            { appleHealthWorkoutUUID: { in: uuids } },
          ],
        },
        include: { feedback: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });

      for (const w of workouts) {
        linkedByWorkoutId.set(w.id, w);
        if (w.appleHealthWorkoutUUID) linkedByUuid.set(w.appleHealthWorkoutUUID, w);
      }
    }

    const sessionDates = sessions.map((s) => new Date(s.startDate));
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

    return sessions.map((session) => {
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
    const viaUuid = byUuid.get(session.appleHealthWorkoutUUID);
    if (viaUuid) return viaUuid;

    const dayKey = session.startDate.split('T')[0];
    const sameDay = byDay.get(dayKey);
    if (sameDay && sameDay.length > 0) {
      return (
        sameDay.find((w) => !w.appleHealthWorkoutUUID) ?? sameDay[0]
      );
    }
    return null;
  }

  private summarizePrescribed(workout: any): PrescribedWorkoutSummary {
    const blocks = Array.isArray(workout.blocks) ? workout.blocks : [];
    const mainBlock = blocks.find((b: any) => b?.type === 'main') ?? blocks[0];
    const mainDescription: string = mainBlock?.instructions ?? workout.description ?? '';
    const totalDistanceKm = blocks.reduce(
      (sum: number, b: any) => sum + (typeof b?.distanceKm === 'number' ? b.distanceKm : 0),
      0,
    );
    const targetPaceRange = this.parsePaceRange(mainBlock?.targetPace);
    const { expectedRepCount, expectedRepDistanceKm } = this.parseRepStructure(mainDescription);
    const expectedMainDurationMin =
      typeof mainBlock?.durationMinutes === 'number' && mainBlock.durationMinutes > 0
        ? mainBlock.durationMinutes
        : this.parseDurationPrescription(mainDescription);

    return {
      id: workout.id,
      dateScheduled: workout.dateScheduled.toISOString().split('T')[0],
      title: workout.title,
      intensity: workout.intensity ?? null,
      mainBlockDescription: mainDescription.slice(0, 240),
      targetPaceRange,
      expectedRepCount,
      expectedRepDistanceKm,
      expectedMainDurationMin,
      totalDistanceKm: totalDistanceKm > 0 ? Number(totalDistanceKm.toFixed(2)) : undefined,
    };
  }

  private analyzeExecution(
    session: DetailedSessionDto,
    prescribed: PrescribedWorkoutSummary | null,
    feedback?: { effort: number; fatigue: number; completed: boolean },
  ): ExecutionAnalysis {
    const observations: string[] = [];
    const reps = session.segments.filter((s) => s.label === SegmentLabel.rep);
    const recoveries = session.segments.filter((s) => s.label === SegmentLabel.rec);

    if (reps.length === 0) {
      if (prescribed?.expectedRepCount && prescribed.expectedRepCount > 0) {
        observations.push(
          `Nenhum tiro detectado na corrida, embora o treino previsse ${prescribed.expectedRepCount} repetições.`,
        );
      }

      let targetAdherence: ExecutionAnalysis['targetAdherence'] = 'unknown';
      let deviationFromTargetSecPerKm: number | undefined;
      const sessionPaceSec = session.averagePaceSecondsPerKm;
      if (
        prescribed?.targetPaceRange &&
        typeof sessionPaceSec === 'number' &&
        sessionPaceSec > 0
      ) {
        const { minSecPerKm, maxSecPerKm } = prescribed.targetPaceRange;
        if (sessionPaceSec >= minSecPerKm && sessionPaceSec <= maxSecPerKm) {
          targetAdherence = 'within';
          deviationFromTargetSecPerKm = 0;
        } else if (sessionPaceSec < minSecPerKm) {
          targetAdherence = 'overshot';
          deviationFromTargetSecPerKm = Math.round(sessionPaceSec - minSecPerKm);
          observations.push(
            `Treino executado ${Math.abs(deviationFromTargetSecPerKm)}s/km mais rápido que o prescrito (overshot).`,
          );
        } else {
          targetAdherence = 'undershot';
          deviationFromTargetSecPerKm = Math.round(sessionPaceSec - maxSecPerKm);
          observations.push(
            `Treino executado ${deviationFromTargetSecPerKm}s/km mais lento que o prescrito (undershot).`,
          );
        }
      }

      // Variance/strategy a partir de splits "easy" reais (Phase A do iOS entrega isso).
      const easyPaces = session.segments
        .filter((s) => s.label === SegmentLabel.easy)
        .map((s) => s.avgPaceSecondsPerKm)
        .filter((p): p is number => typeof p === 'number' && p > 0);
      let pacingStrategy: ExecutionAnalysis['pacingStrategy'] = 'n/a';
      let paceVarianceSeconds: number | undefined;
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
            `Variação grande entre splits (~${paceVarianceSeconds}s/km entre o mais rápido e o mais lento).`,
          );
        } else if (delta > 5) {
          pacingStrategy = 'fade';
          observations.push('Pacing degradou na segunda metade do treino (+5s/km ou mais).');
        } else if (delta < -5) {
          pacingStrategy = 'negative';
        } else {
          pacingStrategy = 'even';
        }
      }

      this.addContextualObservations(observations, prescribed, feedback, session, targetAdherence);

      return {
        pacingStrategy,
        targetAdherence,
        deviationFromTargetSecPerKm,
        paceVarianceSeconds,
        observations,
      };
    }

    const repPaces = reps
      .map((r) => r.avgPaceSecondsPerKm)
      .filter((p): p is number => typeof p === 'number' && p > 0);
    const meanPaceSec = repPaces.length > 0 ? repPaces.reduce((s, p) => s + p, 0) / repPaces.length : 0;

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
      observations.push('Variação grande entre tiros (>25s/km entre o mais rápido e o mais lento).');
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
      fastestRep:
        fastestIdx >= 0 && fastest < Infinity
          ? `${formatPace(fastest)} (rep${fastestIdx + 1})`
          : undefined,
      slowestRep:
        slowestIdx >= 0 && slowest > 0 ? `${formatPace(slowest)} (rep${slowestIdx + 1})` : undefined,
      pacingStrategy,
      paceVarianceSeconds: variance !== undefined ? Math.round(variance) : undefined,
      targetAdherence,
      deviationFromTargetSecPerKm,
      avgHrRecoveryBpm,
      observations,
    };
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
    const match = description.match(/(\d+)\s*(?:x|×|repet(?:i[çc][õo]es)?)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(m|km)/i);
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
