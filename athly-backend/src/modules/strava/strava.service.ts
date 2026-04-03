import { Injectable, HttpException } from '@nestjs/common';
import { Prisma, WorkoutStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  StravaRawActivity,
  mapStravaSportType,
  deriveIntensity,
  buildStravaWorkoutBlock,
} from './strava.mapper';

const STRAVA_BASE = 'https://www.strava.com/api/v3';

@Injectable()
export class StravaService {
  constructor(private readonly prisma: PrismaService) {}

  async syncActivities(userId: string, accessToken: string): Promise<{ synced: number }> {
    const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const activities = await this.fetchActivities(accessToken, thirtyDaysAgo);

    if (!activities.length) return { synced: 0 };

    const trainingPlan = await this.prisma.trainingPlan.findUnique({ where: { userId } });
    if (!trainingPlan) return { synced: 0 };

    let synced = 0;
    for (const activity of activities) {
      const stravaActivityId = activity.id.toString();

      const exists = await this.prisma.workout.findUnique({ where: { stravaActivityId } });
      if (exists) continue;

      const block = buildStravaWorkoutBlock(activity);
      await this.prisma.workout.create({
        data: {
          trainingPlanId: trainingPlan.id,
          userId,
          stravaActivityId,
          dateScheduled: new Date(activity.start_date),
          sportType: mapStravaSportType(activity),
          title: activity.name,
          description: `Synced from Strava — ${(activity.distance / 1000).toFixed(2)}km`,
          blocks: [block] as unknown as Prisma.InputJsonValue,
          status: WorkoutStatus.done,
          intensity: deriveIntensity(activity),
        },
      });
      synced++;
    }

    return { synced };
  }

  async getRecentRunActivities(accessToken: string, count: number): Promise<StravaRawActivity[]> {
    const activities = await this.fetchActivities(accessToken, undefined, count);
    return activities.filter(
      (a) => a.type === 'Run' || a.sport_type === 'Run' || a.sport_type === 'TrailRun',
    );
  }

  private async fetchActivities(
    accessToken: string,
    afterUnix?: number,
    perPage = 60,
  ): Promise<StravaRawActivity[]> {
    const params = new URLSearchParams({ per_page: perPage.toString() });
    if (afterUnix) params.set('after', afterUnix.toString());

    const response = await fetch(`${STRAVA_BASE}/athlete/activities?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { errors?: { code?: string }[] };
      const code = body?.errors?.[0]?.code;
      if (code === 'missing') return [];
      throw new HttpException(`Strava API error: ${response.statusText}`, response.status);
    }

    return response.json() as Promise<StravaRawActivity[]>;
  }
}
