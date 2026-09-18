import {
  BadRequestException,
  Optional,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CodedInternalServerErrorException,
  CodedNotFoundException,
} from '../../common/errors/coded-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { WeeklyPlanAutomationService } from '../ai-planner/weekly-plan-automation.service';
import { PlannerHealthContextService } from '../ai-planner/planner-health-context.service';
import { WorkoutPlanningContextDto } from '../ai-planner/dto/planner-health-context.dto';
import { mondayOf } from '../ai-planner/weekly-calendar';
import { PrismaService } from '../../database/prisma.service';
import { SubmitWorkoutFeedbackDto } from './dto/submit-workout-feedback.dto';
import { CompleteWorkoutDto } from './dto/complete-workout.dto';
import { Prisma, WorkoutStatus } from '@prisma/client';
import { WorkoutFeedbackModel, WorkoutModel } from './models/workout.model';
import { UpdateWorkoutDto } from './dto/workout-update.dto';
import { CreateWorkoutDto } from './dto/create-workout.dto';

const workoutCompletionSelect = {
  id: true,
  trainingPlanId: true,
  weeklyGoalId: true,
  dateScheduled: true,
  sportType: true,
  title: true,
  description: true,
  blocks: true,
  segments: true,
  status: true,
  intensity: true,
  stravaActivityId: true,
  appleHealthWorkoutUUID: true,
  actualDistanceMeters: true,
  actualDurationSeconds: true,
  isGoalAttempt: true,
} satisfies Prisma.WorkoutSelect;

@Injectable()
export class WorkoutsService {
  private readonly logger = new Logger(WorkoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly automation?: WeeklyPlanAutomationService,
    @Optional() private readonly healthContext?: PlannerHealthContextService,
  ) {}

  private async lockWeek(tx: Prisma.TransactionClient, userId: string, workoutId: string) {
    if (!this.automation) return;
    await tx.$queryRaw`SELECT g.id FROM weekly_goals g JOIN workouts w ON w.weekly_goal_id = g.id
      WHERE w.id = ${workoutId} AND w.user_id = ${userId} FOR UPDATE OF g`;
  }

  private async syncContext(userId: string, input?: WorkoutPlanningContextDto) {
    if (!input?.planningContext || !this.healthContext) return;
    try {
      await this.healthContext.sync(userId, input.planningContext);
    } catch (error) {
      // Completion remains authoritative; automation can use the previous snapshot.
      this.logger.warn(
        `Health context sync deferred for ${userId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async getTodayWorkout(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const workout = await this.prisma.workout.findFirst({
      where: {
        userId,
        dateScheduled: {
          gte: today,
          lt: tomorrow,
        },
      },
    });
    return workout ? this.mapWorkout(workout) : null;
  }

  async getWorkoutById(userId: string, id: string) {
    const workout = await this.prisma.workout.findFirst({
      where: { userId, id },
    });
    return workout ? this.mapWorkout(workout) : null;
  }

  async createWorkout(userId: string, input: CreateWorkoutDto): Promise<WorkoutModel> {
    const blocks = (input.blocks ?? []).map((block) => ({
      type: block.type,
      duration: block.duration ?? undefined,
      distance: block.distance ?? undefined,
      targetPace: block.targetPace ?? undefined,
      instructions: block.instructions ?? undefined,
    })) as unknown as Prisma.InputJsonValue;

    const workout = await this.prisma.workout.create({
      data: {
        trainingPlanId: input.trainingPlanId,
        userId,
        dateScheduled: new Date(input.date),
        sportType: input.sportType,
        title: input.title,
        description: input.description ?? null,
        blocks,
        status: input.status,
        intensity: input.intensity ?? null,
        weeklyGoalId: input.weeklyGoalId ?? null,
      },
    });

    return this.mapWorkout(workout);
  }

  async getWorkoutsByTrainingPlan(userId: string, trainingPlanId: string): Promise<WorkoutModel[]> {
    const workouts = await this.prisma.workout.findMany({
      where: { userId, trainingPlanId },
      orderBy: { dateScheduled: 'asc' },
    });
    return workouts.map((workout) => this.mapWorkout(workout));
  }

  async getWorkoutHistory(userId: string) {
    const workouts = await this.prisma.workout.findMany({
      where: { userId, status: { in: ['done', 'partial'] } },
      orderBy: { dateScheduled: 'desc' },
    });
    if (workouts.length > 0) {
      return workouts.map((workout) => ({
        ...this.mapWorkout(workout),
        status: WorkoutStatus.done,
      }));
    }

    const fallback = await this.prisma.workout.findMany({
      where: { userId },
      take: 2,
      orderBy: { dateScheduled: 'desc' },
    });
    return fallback.map((workout) => ({
      ...this.mapWorkout(workout),
      status: WorkoutStatus.done,
    }));
  }

  async submitWorkoutFeedback(
    userId: string,
    workoutId: string,
    input: SubmitWorkoutFeedbackDto,
  ): Promise<WorkoutFeedbackModel> {
    try {
      const workout = await this.prisma.workout.findFirst({
        where: { id: workoutId, userId },
      });
      if (!workout) {
        throw new CodedNotFoundException(ErrorCode.WORKOUT_NOT_FOUND, 'Workout not found');
      }

      const feedback = await this.prisma.workoutFeedback.create({
        data: {
          workoutId,
          userId,
          completed: input.completed,
          effort: input.effort,
          fatigue: input.fatigue,
        },
      });

      return {
        workoutId: feedback.workoutId,
        completed: feedback.completed,
        effort: feedback.effort,
        fatigue: feedback.fatigue,
      };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error(
        `submitWorkoutFeedback failed — workoutId=${workoutId} userId=${userId}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new CodedInternalServerErrorException(
        ErrorCode.WORKOUT_FEEDBACK_FAILED,
        `Falha ao salvar feedback: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async completeWorkout(userId: string, workoutId: string, input?: CompleteWorkoutDto) {
    try {
      await this.syncContext(userId, input);
      const data: Prisma.WorkoutUpdateManyMutationInput & {
        executionDetails?: Prisma.InputJsonValue;
      } = { status: 'done' };
      if (input?.appleHealthWorkoutUUID) {
        data.appleHealthWorkoutUUID = input.appleHealthWorkoutUUID;
      }
      if (typeof input?.actualDistanceMeters === 'number' && input.actualDistanceMeters > 0) {
        data.actualDistanceMeters = input.actualDistanceMeters;
      }
      if (typeof input?.actualDurationSeconds === 'number' && input.actualDurationSeconds > 0) {
        data.actualDurationSeconds = input.actualDurationSeconds;
      }
      if (input?.executionDetails) {
        data.executionDetails = input.executionDetails as unknown as Prisma.InputJsonValue;
      }
      const workout = await this.prisma.$transaction(async (tx) => {
        await this.lockWeek(tx, userId, workoutId);
        const updated = await tx.workout.updateMany({ where: { id: workoutId, userId }, data });
        if (!updated.count)
          throw new CodedNotFoundException(ErrorCode.WORKOUT_NOT_FOUND, 'Workout not found');
        const result = await tx.workout.findFirst({
          where: { id: workoutId, userId },
          select: workoutCompletionSelect,
        });
        if (!result)
          throw new CodedNotFoundException(ErrorCode.WORKOUT_NOT_FOUND, 'Workout not found');
        return result;
      });
      const nextWeekGeneration = await this.automation?.afterWorkout(userId, workout.weeklyGoalId);
      return { ...this.mapWorkout(workout), ...(nextWeekGeneration ? { nextWeekGeneration } : {}) };
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) throw err;
      // O índice único global em `apple_health_workout_uuid` impede que a mesma corrida do
      // Apple Health fique vinculada a dois treinos. Sem este mapeamento o choque virava um 500
      // opaco, sem indicar ao app que basta desvincular o treino anterior.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(
          'Esta corrida já está vinculada a outro treino. Desvincule-a antes de usá-la aqui.',
        );
      }
      this.logger.error(
        `completeWorkout failed — workoutId=${workoutId} userId=${userId}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new CodedInternalServerErrorException(
        ErrorCode.WORKOUT_COMPLETE_FAILED,
        'Falha ao completar treino. Tente novamente mais tarde.',
      );
    }
  }

  /**
   * Desfaz a conclusão de um treino. Zera tudo que veio da execução (corrida vinculada, métricas
   * reais, detalhes e feedback) e devolve o treino para `scheduled`, mantendo a prescrição
   * (`blocks`, `segments`, `intensity`, `isGoalAttempt`, `dateScheduled`) intacta.
   *
   * Limpar `appleHealthWorkoutUUID` é o que libera o índice único para uma nova vinculação.
   * As métricas semanais são calculadas sob demanda a partir de `status === 'done'`
   * (`weekly-metrics.util.ts`), então se corrigem sozinhas — só os snapshots históricos já
   * gravados em `weekly_goals` permanecem, de propósito.
   */
  async uncompleteWorkout(userId: string, workoutId: string): Promise<WorkoutModel> {
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await this.lockWeek(tx, userId, workoutId);
        const existing = await tx.workout.findFirst({
          where: { id: workoutId, userId },
          select: { id: true },
        });
        if (!existing) {
          throw new CodedNotFoundException(ErrorCode.WORKOUT_NOT_FOUND, 'Workout not found');
        }

        await tx.workoutFeedback.deleteMany({ where: { workoutId, userId } });

        return tx.workout.update({
          where: { id: workoutId },
          data: {
            status: 'scheduled',
            appleHealthWorkoutUUID: null,
            actualDistanceMeters: null,
            actualDurationSeconds: null,
            executionDetails: Prisma.DbNull,
          },
          select: workoutCompletionSelect,
        });
      });

      this.logger.log(`uncompleteWorkout — workoutId=${workoutId} userId=${userId}`);
      return this.mapWorkout(updated);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error(
        `uncompleteWorkout failed — workoutId=${workoutId} userId=${userId}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new InternalServerErrorException(
        'Falha ao desvincular a corrida. Tente novamente mais tarde.',
      );
    }
  }

  async skipWorkout(userId: string, workoutId: string, input?: WorkoutPlanningContextDto) {
    await this.syncContext(userId, input);
    const workout = await this.prisma.$transaction(async (tx) => {
      await this.lockWeek(tx, userId, workoutId);
      const updated = await tx.workout.updateMany({
        where: { id: workoutId, userId },
        data: { status: 'skipped' },
      });
      if (!updated.count)
        throw new CodedNotFoundException(ErrorCode.WORKOUT_NOT_FOUND, 'Workout not found');
      const result = await tx.workout.findFirst({ where: { id: workoutId, userId } });
      if (!result)
        throw new CodedNotFoundException(ErrorCode.WORKOUT_NOT_FOUND, 'Workout not found');
      return result;
    });
    const nextWeekGeneration = await this.automation?.afterWorkout(userId, workout.weeklyGoalId);
    return { ...this.mapWorkout(workout), ...(nextWeekGeneration ? { nextWeekGeneration } : {}) };
  }

  private mapWorkout(workout: {
    id: string;
    trainingPlanId?: string;
    weeklyGoalId?: string | null;
    dateScheduled: Date;
    sportType: WorkoutModel['sportType'];
    title: string;
    description: string | null;
    blocks: Prisma.JsonValue;
    segments?: Prisma.JsonValue;
    status: WorkoutModel['status'];
    intensity: number | null;
    isGoalAttempt?: boolean;
    actualDistanceMeters?: number | null;
    actualDurationSeconds?: number | null;
    stravaActivityId?: string | null;
    appleHealthWorkoutUUID?: string | null;
  }): WorkoutModel {
    return {
      id: workout.id,
      trainingPlanId: workout.trainingPlanId,
      weeklyGoalId: workout.weeklyGoalId ?? undefined,
      date: workout.dateScheduled.toISOString().split('T')[0],
      sportType: workout.sportType,
      title: workout.title,
      description: workout.description ?? undefined,
      blocks: (workout.blocks as unknown as WorkoutModel['blocks']) ?? [],
      segments: (workout.segments as unknown as WorkoutModel['segments']) ?? null,
      status: workout.status,
      intensity: workout.intensity ?? undefined,
      isGoalAttempt: workout.isGoalAttempt ?? false,
      actualDistanceMeters: workout.actualDistanceMeters ?? null,
      actualDurationSeconds: workout.actualDurationSeconds ?? null,
      stravaActivityId: workout.stravaActivityId ?? null,
      appleHealthWorkoutUUID: workout.appleHealthWorkoutUUID ?? null,
    };
  }

  async updateWorkout(
    userId: string,
    workoutId: string,
    input: UpdateWorkoutDto,
  ): Promise<WorkoutModel> {
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.lockWeek(tx, userId, workoutId);
      const workout = await tx.workout.findFirst({
        where: { id: workoutId, userId },
      });
      if (!workout) {
        throw new CodedNotFoundException(ErrorCode.WORKOUT_NOT_FOUND, 'Workout not found');
      }

      if (input.date !== undefined) {
        const date = new Date(input.date);
        const week = workout.weeklyGoalId
          ? await tx.weeklyGoal.findUnique({
              where: { id: workout.weeklyGoalId },
              select: { weekStartDate: true },
            })
          : null;
        const origin = week?.weekStartDate ?? workout.dateScheduled;
        if (Number.isNaN(date.getTime()) || +mondayOf(date) !== +mondayOf(origin)) {
          throw new BadRequestException('Só é possível reagendar treinos dentro da mesma semana.');
        }
      }

      const updateData: Prisma.WorkoutUpdateInput = {};

      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.intensity !== undefined) updateData.intensity = input.intensity;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.sportType !== undefined) updateData.sportType = input.sportType;
      if (input.date !== undefined) updateData.dateScheduled = new Date(input.date);

      if (input.blocks !== undefined) {
        updateData.blocks = input.blocks.map((block) => ({
          type: block.type,
          duration: block.duration ?? undefined,
          distance: block.distance ?? undefined,
          targetPace: block.targetPace ?? undefined,
          instructions: block.instructions ?? undefined,
        })) as unknown as Prisma.InputJsonValue;
      }

      if (input.segments !== undefined) {
        updateData.segments = input.segments as unknown as Prisma.InputJsonValue;
      }

      return tx.workout.update({
        where: { id: workoutId },
        data: updateData,
      });
    });
    const nextWeekGeneration =
      input.status && ['done', 'partial', 'skipped'].includes(input.status)
        ? await this.automation?.afterWorkout(userId, updated.weeklyGoalId)
        : undefined;
    return { ...this.mapWorkout(updated), ...(nextWeekGeneration ? { nextWeekGeneration } : {}) };
  }
}
