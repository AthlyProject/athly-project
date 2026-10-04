import { Injectable } from '@nestjs/common';
import { SportType, TrainingPlanStatus, WorkoutStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CodedNotFoundException } from '../../common/errors/coded-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { addCalendarDays, localCalendar } from '../ai-planner/weekly-calendar';
import { encodeWorkoutFit, fitSerialNumber } from './fit/fit-file';
import { MAX_WORKOUT_NAME_LENGTH } from './fit/fit.constants';
import { buildFitPlan, fitPlanRevision, FitWorkoutPlan } from './fit/workout-fit-plan';
import { ConnectIqManifestModel } from './models/connect-iq.model';

export const MANIFEST_VERSION = 1;
/** Janela sincronizada: hoje + 6 dias. */
export const MANIFEST_DAYS = 7;
/** Os relógios guardam poucos treinos (~25 em vários modelos) e a cota é dividida com o usuário. */
export const MAX_MANIFEST_WORKOUTS = 7;
const CANDIDATE_LIMIT = 14;
/** Fuso usado quando o relógio não manda a data local e o app nunca sincronizou o fuso. */
const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';
const DAY_MS = 24 * 60 * 60_000;

interface ManifestEntry {
  workout: { id: string; dateScheduled: Date };
  plan: FitWorkoutPlan;
}

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

/** Dois treinos com o mesmo nome confundem a lista nativa do relógio: o segundo ganha " 2". */
const renamed = (plan: FitWorkoutPlan, occurrence: number): FitWorkoutPlan => {
  const suffix = ` ${occurrence}`;
  const base = Array.from(plan.name)
    .slice(0, MAX_WORKOUT_NAME_LENGTH - suffix.length)
    .join('')
    .trimEnd();
  const name = `${base}${suffix}`;
  return { ...plan, name, rev: fitPlanRevision(name, plan.steps) };
};

@Injectable()
export class ConnectIqSyncService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista enxuta (cabe no limite de JSON do relógio) dos treinos que devem estar no relógio. */
  async manifest(
    userId: string,
    today?: string,
    now = new Date(),
  ): Promise<ConnectIqManifestModel> {
    const day = await this.resolveToday(userId, today, now);
    const entries = await this.entries(userId, day);
    return {
      v: MANIFEST_VERSION,
      today: isoDate(day),
      workouts: entries.map(({ workout, plan }) => ({
        id: workout.id,
        rev: plan.rev,
        date: isoDate(workout.dateScheduled),
        name: plan.name,
        steps: plan.steps.length,
      })),
    };
  }

  /** FIT de um treino do manifesto; mesma regra de elegibilidade, então bate com o `rev`. */
  async workoutFit(
    userId: string,
    workoutId: string,
    today?: string,
    now = new Date(),
  ): Promise<Uint8Array> {
    const day = await this.resolveToday(userId, today, now);
    const entry = (await this.entries(userId, day)).find(({ workout }) => workout.id === workoutId);
    if (!entry) {
      throw new CodedNotFoundException(
        ErrorCode.CIQ_WORKOUT_NOT_AVAILABLE,
        'Treino indisponível para o relógio.',
      );
    }
    return encodeWorkoutFit(entry.plan, {
      serialNumber: fitSerialNumber(entry.workout.id),
      timeCreated: now,
    });
  }

  /**
   * "Hoje" do atleta. O relógio manda a própria data local; sem ela (ou se vier absurda), usa o
   * fuso salvo pelo app.
   */
  private async resolveToday(userId: string, today: string | undefined, now: Date): Promise<Date> {
    if (today && /^\d{4}-\d{2}-\d{2}$/.test(today)) {
      const candidate = new Date(`${today}T00:00:00.000Z`);
      const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      if (
        !Number.isNaN(candidate.getTime()) &&
        Math.abs(candidate.getTime() - utcToday) <= DAY_MS
      ) {
        return candidate;
      }
    }
    const context = await this.prisma.plannerHealthContext.findUnique({
      where: { userId },
      select: { timeZone: true },
    });
    try {
      return localCalendar(now, context?.timeZone ?? DEFAULT_TIME_ZONE).date;
    } catch {
      return localCalendar(now, DEFAULT_TIME_ZONE).date;
    }
  }

  private async entries(userId: string, today: Date): Promise<ManifestEntry[]> {
    const workouts = await this.prisma.workout.findMany({
      where: {
        userId,
        status: WorkoutStatus.scheduled,
        sportType: SportType.running,
        dateScheduled: { gte: today, lte: addCalendarDays(today, MANIFEST_DAYS - 1) },
        trainingPlan: { status: TrainingPlanStatus.ACTIVE },
      },
      orderBy: [{ dateScheduled: 'asc' }, { createdAt: 'asc' }],
      take: CANDIDATE_LIMIT,
      select: { id: true, title: true, dateScheduled: true, sportType: true, segments: true },
    });

    const occurrences = new Map<string, number>();
    const entries: ManifestEntry[] = [];
    for (const workout of workouts) {
      const result = buildFitPlan(workout);
      if (!result.ok) continue;
      const occurrence = (occurrences.get(result.plan.name) ?? 0) + 1;
      occurrences.set(result.plan.name, occurrence);
      entries.push({
        workout,
        plan: occurrence === 1 ? result.plan : renamed(result.plan, occurrence),
      });
      if (entries.length === MAX_MANIFEST_WORKOUTS) break;
    }
    return entries;
  }
}
