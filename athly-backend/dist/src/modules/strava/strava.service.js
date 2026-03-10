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
exports.StravaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../database/prisma.service");
const strava_mapper_1 = require("./strava.mapper");
const STRAVA_BASE = 'https://www.strava.com/api/v3';
let StravaService = class StravaService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async syncActivities(userId, accessToken) {
        const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
        const activities = await this.fetchActivities(accessToken, thirtyDaysAgo);
        if (!activities.length)
            return { synced: 0 };
        const trainingPlan = await this.prisma.trainingPlan.findUnique({ where: { userId } });
        if (!trainingPlan)
            return { synced: 0 };
        let synced = 0;
        for (const activity of activities) {
            const stravaActivityId = activity.id.toString();
            const exists = await this.prisma.workout.findUnique({ where: { stravaActivityId } });
            if (exists)
                continue;
            const block = (0, strava_mapper_1.buildStravaWorkoutBlock)(activity);
            await this.prisma.workout.create({
                data: {
                    trainingPlanId: trainingPlan.id,
                    userId,
                    stravaActivityId,
                    dateScheduled: new Date(activity.start_date),
                    sportType: (0, strava_mapper_1.mapStravaSportType)(activity),
                    title: activity.name,
                    description: `Synced from Strava — ${(activity.distance / 1000).toFixed(2)}km`,
                    blocks: [block],
                    status: client_1.WorkoutStatus.done,
                    intensity: (0, strava_mapper_1.deriveIntensity)(activity),
                },
            });
            synced++;
        }
        return { synced };
    }
    async getRecentRunActivities(accessToken, count) {
        const activities = await this.fetchActivities(accessToken, undefined, count);
        return activities.filter((a) => a.type === 'Run' || a.sport_type === 'Run' || a.sport_type === 'TrailRun');
    }
    async fetchActivities(accessToken, afterUnix, perPage = 60) {
        const params = new URLSearchParams({ per_page: perPage.toString() });
        if (afterUnix)
            params.set('after', afterUnix.toString());
        const response = await fetch(`${STRAVA_BASE}/athlete/activities?${params}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            const code = body?.errors?.[0]?.code;
            if (code === 'missing')
                return [];
            throw new common_1.HttpException(`Strava API error: ${response.statusText}`, response.status);
        }
        return response.json();
    }
};
exports.StravaService = StravaService;
exports.StravaService = StravaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StravaService);
//# sourceMappingURL=strava.service.js.map