import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { IntegrationModel } from './models/integration.model';
import { StravaService } from '../strava/strava.service';
export declare class IntegrationsService {
    private readonly prisma;
    private readonly configService;
    private readonly stravaService;
    constructor(prisma: PrismaService, configService: ConfigService, stravaService: StravaService);
    getIntegrations(userId: string): Promise<IntegrationModel[]>;
    connectIntegration(userId: string, id: string): Promise<IntegrationModel>;
    disconnectIntegration(userId: string, id: string): Promise<IntegrationModel>;
    getStravaAuthUrl(): string;
    handleStravaCallback(userId: string, code: string): Promise<IntegrationModel>;
    disconnectStrava(userId: string): Promise<void>;
    syncStravaActivities(userId: string): Promise<{
        synced: number;
    }>;
    getValidStravaToken(userId: string): Promise<string>;
    private refreshStravaToken;
    private toModel;
}
