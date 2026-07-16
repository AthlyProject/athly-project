import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SubmitWorkoutFeedbackDto } from './dto/submit-workout-feedback.dto';
import { CompleteWorkoutDto } from './dto/complete-workout.dto';
import { Prisma, WorkoutStatus } from '@prisma/client';
import { WorkoutFeedbackModel, WorkoutModel } from './models/workout.model';
import { UpdateWorkoutDto } from './dto/workout-update.dto';
import { CreateWorkoutDto } from './dto/create-workout.dto';

const workoutCompletionSelect = {
  id: true,
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

  constructor(private readonly prisma: PrismaService) {}

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
        throw new NotFoundException('Workout not found');
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
      throw new InternalServerErrorException(
        `Falha ao salvar feedback: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async completeWorkout(userId: string, workoutId: string, input?: CompleteWorkoutDto) {
    try {
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
      this.logger.log(
        `completeWorkout — workoutId=${workoutId} userId=${userId} input=${JSON.stringify(input ?? null)}`,
      );
      const updated = await this.prisma.workout.updateMany({
        where: { id: workoutId, userId },
        data,
      });
      if (!updated.count) {
        throw new NotFoundException('Workout not found');
      }
      const workout = await this.prisma.workout.findFirst({
        where: { id: workoutId, userId },
        select: workoutCompletionSelect,
      });
      if (!workout) {
        throw new NotFoundException('Workout not found');
      }
      return this.mapWorkout(workout);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error(
        `completeWorkout failed — workoutId=${workoutId} userId=${userId}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new InternalServerErrorException(
        'Falha ao completar treino. Tente novamente mais tarde.',
      );
    }
  }

  async skipWorkout(userId: string, workoutId: string) {
    const updated = await this.prisma.workout.updateMany({
      where: { id: workoutId, userId },
      data: { status: 'skipped' },
    });
    if (!updated.count) {
      throw new NotFoundException('Workout not found');
    }
    const workout = await this.prisma.workout.findFirst({
      where: { id: workoutId, userId },
    });
    if (!workout) {
      throw new NotFoundException('Workout not found');
    }
    return this.mapWorkout(workout);
  }

  private mapWorkout(workout: {
    id: string;
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

  async updateWorkout(workoutId: string, input: UpdateWorkoutDto): Promise<WorkoutModel> {
    const workout = await this.prisma.workout.findFirst({
      where: { id: workoutId },
    });
    if (!workout) {
      throw new NotFoundException('Workout not found');
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

    const updated = await this.prisma.workout.update({
      where: { id: workoutId },
      data: updateData,
    });

    return this.mapWorkout(updated);
  }
}
