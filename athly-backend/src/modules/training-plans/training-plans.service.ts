import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, SportType } from '@prisma/client';
import { CreateTrainingPlanInput } from './dto/create-training-plan.dto';
import { UpdateTrainingPlanInput } from './dto/update-training-plan.dto';
import { TrainingPlanModel } from './models/training-plan.model';

@Injectable()
export class TrainingPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyTrainingPlan(userId: string): Promise<TrainingPlanModel | null> {
    const plan = await this.prisma.trainingPlan.findUnique({
      where: { userId },
    });
    return plan ? this.mapTrainingPlan(plan) : null;
  }

  async getTrainingPlanById(userId: string, id: string): Promise<TrainingPlanModel> {
    const plan = await this.prisma.trainingPlan.findFirst({
      where: { id, userId },
    });

    if (!plan) {
      throw new NotFoundException('Training plan not found');
    }

    return this.mapTrainingPlan(plan);
  }

  async createTrainingPlan(
    userId: string,
    input: CreateTrainingPlanInput,
  ): Promise<TrainingPlanModel> {
    const existing = await this.prisma.trainingPlan.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new ConflictException('User already has a training plan. Use update or delete first.');
    }

    const plan = await this.prisma.trainingPlan.create({
      data: {
        userId,
        startDate: input.startDate,
        objective: input.objective,
        status: input.status,
        targetDate: input.targetDate ? new Date(input.targetDate) : undefined,
        sports: input.sports,
        autoGenerate: input.autoGenerate ?? false,
      },
    });

    return this.mapTrainingPlan(plan);
  }

  async updateTrainingPlan(
    userId: string,
    id: string,
    input: UpdateTrainingPlanInput,
  ): Promise<TrainingPlanModel> {
    const existing = await this.prisma.trainingPlan.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('Training plan not found');
    }

    const updateData: Prisma.TrainingPlanUpdateInput = {};
    if (input.startDate !== undefined) {
      updateData.startDate = input.startDate;
    }
    if (input.objective !== undefined) {
      updateData.objective = input.objective;
    }
    if (input.targetDate !== undefined) {
      updateData.targetDate = input.targetDate ? new Date(input.targetDate) : null;
    }
    if (input.sports !== undefined) {
      updateData.sports = input.sports;
    }
    if (input.autoGenerate !== undefined) {
      updateData.autoGenerate = input.autoGenerate;
    }

    const plan = await this.prisma.trainingPlan.update({
      where: { id },
      data: updateData,
    });

    return this.mapTrainingPlan(plan);
  }

  async deleteTrainingPlan(userId: string, id: string): Promise<void> {
    const existing = await this.prisma.trainingPlan.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('Training plan not found');
    }

    await this.prisma.trainingPlan.delete({
      where: { id },
    });
  }

  private mapTrainingPlan(plan: {
    id: string;
    startDate: string;
    objective: string;
    targetDate: Date | null;
    sports: SportType[];
    autoGenerate: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): TrainingPlanModel {
    return {
      id: plan.id,
      startDate: plan.startDate,
      objective: plan.objective,
      targetDate: plan.targetDate,
      sports: plan.sports,
      autoGenerate: plan.autoGenerate,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}
