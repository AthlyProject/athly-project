import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { IntegrationModel } from './models/integration.model';
import { StravaService } from '../strava/strava.service';

interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number };
}

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly stravaService: StravaService,
  ) {}

  async getIntegrations(userId: string): Promise<IntegrationModel[]> {
    const integrations = await this.prisma.integration.findMany({ where: { userId } });
    return integrations.map(this.toModel);
  }

  async connectIntegration(userId: string, id: string) {
    const updated = await this.prisma.integration.updateMany({
      where: { userId, id },
      data: { connected: true },
    });
    if (!updated.count) throw new NotFoundException('Integration not found');
    const integration = await this.prisma.integration.findFirst({ where: { userId, id } });
    if (!integration) throw new NotFoundException('Integration not found');
    return this.toModel(integration);
  }

  async disconnectIntegration(userId: string, id: string) {
    const updated = await this.prisma.integration.updateMany({
      where: { userId, id },
      data: { connected: false },
    });
    if (!updated.count) throw new NotFoundException('Integration not found');
    const integration = await this.prisma.integration.findFirst({ where: { userId, id } });
    if (!integration) throw new NotFoundException('Integration not found');
    return this.toModel(integration);
  }

  // ─── Strava OAuth ────────────────────────────────────────────────────────────

  getStravaAuthUrl(): string {
    const clientId = this.configService.get<string>('STRAVA_CLIENT_ID');
    const redirectUri = this.configService.get<string>('STRAVA_REDIRECT_URI');
    if (!clientId || !redirectUri) {
      throw new InternalServerErrorException('Strava OAuth is not configured.');
    }
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      approval_prompt: 'auto',
      scope: 'activity:read_all',
    });
    return `https://www.strava.com/oauth/authorize?${params}`;
  }

  async handleStravaCallback(userId: string, code: string): Promise<IntegrationModel> {
    const clientId = this.configService.get<string>('STRAVA_CLIENT_ID');
    const clientSecret = this.configService.get<string>('STRAVA_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new InternalServerErrorException('Strava OAuth is not configured.');
    }

    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      throw new UnauthorizedException('Failed to exchange Strava authorization code.');
    }

    const tokens = (await response.json()) as StravaTokenResponse;

    // Upsert Integration record
    const existing = await this.prisma.integration.findFirst({
      where: { userId, type: 'strava' },
    });

    let integration;
    if (existing) {
      integration = await this.prisma.integration.update({
        where: { id: existing.id },
        data: {
          connected: true,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: new Date(tokens.expires_at * 1000),
          stravaAthleteId: tokens.athlete?.id?.toString() ?? null,
          scope: 'activity:read_all',
        },
      });
    } else {
      integration = await this.prisma.integration.create({
        data: {
          userId,
          type: 'strava',
          name: 'Strava',
          icon: '🏃',
          connected: true,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: new Date(tokens.expires_at * 1000),
          stravaAthleteId: tokens.athlete?.id?.toString() ?? null,
          scope: 'activity:read_all',
        },
      });
    }

    // Fire-and-forget sync after connecting
    this.stravaService
      .syncActivities(userId, tokens.access_token)
      .catch((err: Error) =>
        console.error(`[Strava] Background sync failed for user ${userId}:`, err.message),
      );

    return this.toModel(integration);
  }

  async disconnectStrava(userId: string): Promise<void> {
    await this.prisma.integration.updateMany({
      where: { userId, type: 'strava' },
      data: {
        connected: false,
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
        stravaAthleteId: null,
        scope: null,
      },
    });
  }

  async syncStravaActivities(userId: string): Promise<{ synced: number }> {
    const accessToken = await this.getValidStravaToken(userId);
    return this.stravaService.syncActivities(userId, accessToken);
  }

  async getValidStravaToken(userId: string): Promise<string> {
    const integration = await this.prisma.integration.findFirst({
      where: { userId, type: 'strava', connected: true },
    });

    if (!integration?.accessToken) {
      throw new UnauthorizedException('Strava is not connected. Please authorize via OAuth.');
    }

    // Refresh if expires within 5 minutes
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    if (integration.tokenExpiresAt && integration.tokenExpiresAt < fiveMinutesFromNow) {
      const refreshed = await this.refreshStravaToken(
        integration as {
          id: string;
          refreshToken: string | null;
        },
      );
      return refreshed;
    }

    return integration.accessToken;
  }

  private async refreshStravaToken(integration: {
    id: string;
    refreshToken: string | null;
  }): Promise<string> {
    const clientId = this.configService.get<string>('STRAVA_CLIENT_ID');
    const clientSecret = this.configService.get<string>('STRAVA_CLIENT_SECRET');

    if (!integration.refreshToken) {
      throw new UnauthorizedException('No refresh token available. Please reconnect Strava.');
    }

    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: integration.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new UnauthorizedException('Failed to refresh Strava token. Please reconnect.');
    }

    const tokens = (await response.json()) as StravaTokenResponse;
    await this.prisma.integration.update({
      where: { id: integration.id },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(tokens.expires_at * 1000),
      },
    });

    return tokens.access_token;
  }

  private toModel(integration: {
    id: string;
    name: string;
    icon: string;
    connected: boolean;
    type: IntegrationModel['type'];
    stravaAthleteId?: string | null;
  }): IntegrationModel {
    return {
      id: integration.id,
      name: integration.name,
      icon: integration.icon,
      connected: integration.connected,
      type: integration.type,
      stravaAthleteId: integration.stravaAthleteId,
    };
  }
}
