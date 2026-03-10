"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../database/prisma.service");
const strava_service_1 = require("../strava/strava.service");
let IntegrationsService = class IntegrationsService {
    prisma;
    configService;
    stravaService;
    constructor(prisma, configService, stravaService) {
        this.prisma = prisma;
        this.configService = configService;
        this.stravaService = stravaService;
    }
    async getIntegrations(userId) {
        const integrations = await this.prisma.integration.findMany({ where: { userId } });
        return integrations.map(this.toModel);
    }
    async connectIntegration(userId, id) {
        const updated = await this.prisma.integration.updateMany({
            where: { userId, id },
            data: { connected: true },
        });
        if (!updated.count)
            throw new common_1.NotFoundException('Integration not found');
        const integration = await this.prisma.integration.findFirst({ where: { userId, id } });
        if (!integration)
            throw new common_1.NotFoundException('Integration not found');
        return this.toModel(integration);
    }
    async disconnectIntegration(userId, id) {
        const updated = await this.prisma.integration.updateMany({
            where: { userId, id },
            data: { connected: false },
        });
        if (!updated.count)
            throw new common_1.NotFoundException('Integration not found');
        const integration = await this.prisma.integration.findFirst({ where: { userId, id } });
        if (!integration)
            throw new common_1.NotFoundException('Integration not found');
        return this.toModel(integration);
    }
    getStravaAuthUrl() {
        const clientId = this.configService.get('STRAVA_CLIENT_ID');
        const redirectUri = this.configService.get('STRAVA_REDIRECT_URI');
        if (!clientId || !redirectUri) {
            throw new common_1.InternalServerErrorException('Strava OAuth is not configured.');
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
    async handleStravaCallback(userId, code) {
        const clientId = this.configService.get('STRAVA_CLIENT_ID');
        const clientSecret = this.configService.get('STRAVA_CLIENT_SECRET');
        if (!clientId || !clientSecret) {
            throw new common_1.InternalServerErrorException('Strava OAuth is not configured.');
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
            throw new common_1.UnauthorizedException('Failed to exchange Strava authorization code.');
        }
        const tokens = (await response.json());
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
        }
        else {
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
        this.stravaService.syncActivities(userId, tokens.access_token).catch((err) => console.error(`[Strava] Background sync failed for user ${userId}:`, err.message));
        return this.toModel(integration);
    }
    async disconnectStrava(userId) {
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
    async syncStravaActivities(userId) {
        const accessToken = await this.getValidStravaToken(userId);
        return this.stravaService.syncActivities(userId, accessToken);
    }
    async getValidStravaToken(userId) {
        const integration = await this.prisma.integration.findFirst({
            where: { userId, type: 'strava', connected: true },
        });
        if (!integration?.accessToken) {
            throw new common_1.UnauthorizedException('Strava is not connected. Please authorize via OAuth.');
        }
        const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
        if (integration.tokenExpiresAt && integration.tokenExpiresAt < fiveMinutesFromNow) {
            const refreshed = await this.refreshStravaToken(integration);
            return refreshed;
        }
        return integration.accessToken;
    }
    async refreshStravaToken(integration) {
        const clientId = this.configService.get('STRAVA_CLIENT_ID');
        const clientSecret = this.configService.get('STRAVA_CLIENT_SECRET');
        if (!integration.refreshToken) {
            throw new common_1.UnauthorizedException('No refresh token available. Please reconnect Strava.');
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
            throw new common_1.UnauthorizedException('Failed to refresh Strava token. Please reconnect.');
        }
        const tokens = (await response.json());
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
    toModel(integration) {
        return {
            id: integration.id,
            name: integration.name,
            icon: integration.icon,
            connected: integration.connected,
            type: integration.type,
            stravaAthleteId: integration.stravaAthleteId,
        };
    }
};
exports.IntegrationsService = IntegrationsService;
exports.IntegrationsService = IntegrationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        strava_service_1.StravaService])
], IntegrationsService);
//# sourceMappingURL=integrations.service.js.map