import { Injectable, HttpException } from '@nestjs/common';
import { IntegrationsService } from '../integrations/integrations.service';
import type { StravaActivity } from './types/planner.types';

const STRAVA_BASE = 'https://www.strava.com/api/v3';

@Injectable()
export class StravaService {
  constructor(private readonly integrationsService: IntegrationsService) {}

  async getRecentActivities(userId: string, count: number): Promise<StravaActivity[]> {
    let accessToken: string;
    try {
      accessToken = await this.integrationsService.getValidStravaToken(userId);
    } catch {
      // Strava not connected — return empty (triggers assessment plan)
      return [];
    }

    const url = `${STRAVA_BASE}/athlete/activities?per_page=${count}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 401) {
      const body = await response.json().catch(() => ({})) as { errors?: { code?: string }[] };
      const code = body?.errors?.[0]?.code;
      if (code === 'missing') return [];
      return [];
    }

    if (response.status === 429) {
      throw new HttpException('Strava rate limit exceeded. Please try again later.', 429);
    }

    if (!response.ok) {
      throw new HttpException(`Strava API error: ${response.statusText}`, response.status);
    }

    return response.json() as Promise<StravaActivity[]>;
  }
}
