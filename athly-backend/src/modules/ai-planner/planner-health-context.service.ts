import { localCalendar } from './weekly-calendar';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PlannerHealthContextDto } from './dto/planner-health-context.dto';
import { DetailedSessionDto, PlanFromHealthDto } from './dto/plan-from-health.dto';

@Injectable()
export class PlannerHealthContextService {
  constructor(private readonly prisma: PrismaService) {}

  async sync(userId: string, input: PlannerHealthContextDto) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: input.timeZone }).format();
    } catch {
      throw new BadRequestException('Fuso horário inválido.');
    }
    const capturedAt = new Date(input.capturedAt);
    if (Number.isNaN(capturedAt.getTime()) || capturedAt.getTime() > Date.now() + 5 * 60_000) {
      throw new BadRequestException('Data de sincronização inválida.');
    }
    const payload = {
      runs: [...input.runs]
        .sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate))
        .slice(0, 20),
      detailedSessions: [...(input.detailedSessions ?? [])]
        .sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate))
        .slice(0, 7),
    } as unknown as Prisma.InputJsonValue;
    // Concurrent/out-of-order uploads cannot replace a more recent snapshot.
    await this.prisma.plannerHealthContext.upsert({
      where: { userId },
      // A nonempty, idempotent update lets Prisma use PostgreSQL ON CONFLICT.
      update: { userId },
      create: { userId, payload, timeZone: input.timeZone, capturedAt },
    });
    await this.prisma.plannerHealthContext.updateMany({
      where: { userId, capturedAt: { lte: capturedAt } },
      data: { payload, capturedAt, timeZone: input.timeZone },
    });
    return { synced: true };
  }

  /** Same planner DTO, enriched with executions already saved by completion/import. */
  async generationInput(
    tx: Prisma.TransactionClient,
    userId: string,
    trainingPlanId: string,
    weekStartDate: Date,
    payload: Prisma.JsonValue,
    timeZone = 'UTC',
    historyBeforeDate = weekStartDate,
  ): Promise<PlanFromHealthDto> {
    const context = payload as unknown as PlanFromHealthDto;
    const workouts = await tx.workout.findMany({
      where: {
        userId,
        trainingPlanId,
        status: { in: ['done', 'partial'] },
        dateScheduled: { lt: historyBeforeDate },
      },
      orderBy: { dateScheduled: 'desc' },
      take: 20,
    });
    const sessions = new Map<string, DetailedSessionDto>();
    for (const session of context.detailedSessions ?? []) {
      sessions.set(
        session.appleHealthWorkoutUUID?.toLowerCase() || new Date(session.startDate).toISOString(),
        session,
      );
    }
    const runs = [...(context.runs ?? [])];
    for (const workout of workouts) {
      const detail = workout.executionDetails as unknown as DetailedSessionDto | null;
      if (detail?.startDate && Array.isArray(detail.segments)) {
        sessions.set(
          detail.appleHealthWorkoutUUID?.toLowerCase() || new Date(detail.startDate).toISOString(),
          { ...detail, athlyWorkoutId: workout.id },
        );
      }
      const startDate = detail?.startDate ?? workout.dateScheduled.toISOString();
      if (
        workout.actualDistanceMeters &&
        workout.actualDurationSeconds &&
        !runs.some(
          (r) =>
            (r.appleHealthWorkoutUUID &&
              r.appleHealthWorkoutUUID.toLowerCase() ===
                workout.appleHealthWorkoutUUID?.toLowerCase()) ||
            (detail
              ? +new Date(r.startDate) === +new Date(startDate)
              : r.startDate.slice(0, 10) === startDate.slice(0, 10) &&
                Math.abs(r.distanceMeters - workout.actualDistanceMeters!) < 100 &&
                Math.abs(r.durationSeconds - workout.actualDurationSeconds!) < 60),
        )
      ) {
        runs.push({
          appleHealthWorkoutUUID: workout.appleHealthWorkoutUUID ?? undefined,
          startDate,
          distanceMeters: workout.actualDistanceMeters,
          durationSeconds: workout.actualDurationSeconds,
        });
      }
    }
    // An old snapshot must not resurrect an association removed by uncompleteWorkout.
    const linked = await tx.workout.findMany({
      where: {
        userId,
        id: {
          in: [...sessions.values()].flatMap((s) => (s.athlyWorkoutId ? [s.athlyWorkoutId] : [])),
        },
        status: { in: ['done', 'partial'] },
      },
      select: { id: true },
    });
    const validLinks = new Set(linked.map((w) => w.id));
    return {
      weekStartDate: weekStartDate.toISOString().slice(0, 10),
      runs: runs
        .filter((r) => localCalendar(new Date(r.startDate), timeZone).date < historyBeforeDate)
        .sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate))
        .slice(0, 20),
      detailedSessions: [...sessions.values()]
        .filter((s) => localCalendar(new Date(s.startDate), timeZone).date < historyBeforeDate)
        .sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate))
        .slice(0, 7)
        .map((s) => ({
          ...s,
          athlyWorkoutId:
            s.athlyWorkoutId && validLinks.has(s.athlyWorkoutId) ? s.athlyWorkoutId : undefined,
        })),
    };
  }
}
