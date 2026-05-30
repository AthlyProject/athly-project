import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateRunDto } from './dto/create-run.dto';
import { RunHistoryModel, SaveRunResponseModel } from './models/run.model';

@Injectable()
export class RunsService {
  constructor(private readonly prisma: PrismaService) {}

  async createRun(userId: string, input: CreateRunDto): Promise<SaveRunResponseModel> {
    const startDate = new Date(input.dateScheduled);
    const endDate = new Date(startDate.getTime() + input.duration * 1000);

    const run = await this.prisma.runSession.create({
      data: {
        userId,
        sportType: input.sportType,
        startDate,
        endDate,
        durationSeconds: input.duration,
        distanceMeters: input.distance,
        avgPaceSecondsPerKm: input.averagePace,
        elevationGainMeters: input.elevationGain,
        calories: input.calories,
        route: input.routePoints as unknown as Prisma.InputJsonValue,
        splits: input.splits as unknown as Prisma.InputJsonValue,
      },
    });

    return { id: run.id };
  }

  async getHistory(userId: string): Promise<RunHistoryModel[]> {
    const runs = await this.prisma.runSession.findMany({
      where: { userId },
      orderBy: { startDate: 'desc' },
    });

    return runs.map((r) => ({
      id: r.id,
      sportType: r.sportType,
      dateScheduled: r.startDate.toISOString(),
      status: 'done',
      distanceMeters: r.distanceMeters,
      durationSeconds: r.durationSeconds,
      averagePace: r.avgPaceSecondsPerKm,
      elevationGain: r.elevationGainMeters,
      calories: r.calories,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
