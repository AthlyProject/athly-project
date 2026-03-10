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
exports.AiPlannerService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../database/prisma.service");
const strava_service_1 = require("./strava.service");
const gemini_service_1 = require("./gemini.service");
let AiPlannerService = class AiPlannerService {
    prisma;
    stravaService;
    geminiService;
    constructor(prisma, stravaService, geminiService) {
        this.prisma = prisma;
        this.stravaService = stravaService;
        this.geminiService = geminiService;
    }
    async planNextWeek(userId, input) {
        const startMonday = input.weekStartDate ? new Date(input.weekStartDate) : this.getNextMonday();
        const weekDates = this.getWeekDates(startMonday);
        const weekStartDate = new Date(weekDates[0]);
        const weekEndDate = new Date(weekDates[6]);
        const trainingPlan = await this.resolveTrainingPlan(userId, weekDates[0]);
        await this.checkWeekOverlap(trainingPlan.id, weekStartDate, weekEndDate);
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { availability: true },
        });
        const trainingDays = user?.availability ?? 5;
        const activities = await this.stravaService.getRecentActivities(userId, 30);
        const runs = activities
            .filter((a) => a.type === 'Run' || a.sport_type === 'Run' || a.sport_type === 'TrailRun')
            .slice(0, trainingDays);
        let plannerResult;
        let isAssessment = false;
        if (runs.length === 0) {
            isAssessment = true;
            plannerResult = await this.geminiService.generateAssessmentPlan(weekDates, trainingDays);
        }
        else {
            const aiInput = this.buildAiInput(runs, weekDates, trainingDays);
            plannerResult = await this.geminiService.generatePlan(aiInput);
        }
        const { weeklyGoal, workouts } = await this.prisma.$transaction(async (tx) => {
            const weeklyGoal = await tx.weeklyGoal.create({
                data: {
                    trainingPlanId: trainingPlan.id,
                    weekStartDate,
                    weekEndDate,
                    status: client_1.WeeklyGoalStatus.GENERATED,
                    metrics: plannerResult.analysis,
                },
            });
            const workouts = await Promise.all(plannerResult.weekPlan.map((day) => tx.workout.create({
                data: {
                    trainingPlanId: trainingPlan.id,
                    weeklyGoalId: weeklyGoal.id,
                    userId,
                    dateScheduled: new Date(day.date),
                    sportType: day.sportType,
                    title: day.title,
                    description: day.description,
                    blocks: day.blocks,
                    status: client_1.WorkoutStatus.scheduled,
                    intensity: day.intensity,
                },
            })));
            return { weeklyGoal, workouts };
        });
        return {
            trainingPlan: { id: trainingPlan.id, status: trainingPlan.status },
            weeklyGoal: {
                id: weeklyGoal.id,
                trainingPlanId: weeklyGoal.trainingPlanId,
                weekStartDate: weeklyGoal.weekStartDate,
                weekEndDate: weeklyGoal.weekEndDate,
                status: weeklyGoal.status,
                metrics: weeklyGoal.metrics,
                createdAt: weeklyGoal.createdAt,
                updatedAt: weeklyGoal.updatedAt,
            },
            workouts: workouts.map((w) => ({
                id: w.id,
                date: w.dateScheduled.toISOString().split('T')[0],
                sportType: w.sportType,
                title: w.title,
                description: w.description ?? undefined,
                blocks: w.blocks,
                status: w.status,
                intensity: w.intensity ?? undefined,
                stravaActivityId: w.stravaActivityId ?? null,
            })),
            analysis: plannerResult.analysis,
            isAssessment,
        };
    }
    async resolveTrainingPlan(userId, weekStartDate) {
        const existing = await this.prisma.trainingPlan.findUnique({ where: { userId } });
        if (existing) {
            if (existing.status === client_1.TrainingPlanStatus.CANCELLED ||
                existing.status === client_1.TrainingPlanStatus.COMPLETED) {
                throw new common_1.ConflictException(`Training plan is ${existing.status.toLowerCase()}. Delete it and create a new one before generating a plan.`);
            }
            if (existing.status === client_1.TrainingPlanStatus.LOCKED) {
                throw new common_1.ConflictException('Training plan is locked and cannot be modified.');
            }
            return existing;
        }
        return this.prisma.trainingPlan.create({
            data: {
                userId,
                startDate: weekStartDate,
                objective: 'AI-generated running plan — run 5km in under 26 minutes',
                status: client_1.TrainingPlanStatus.ACTIVE,
                sports: [client_1.SportType.running],
                autoGenerate: true,
            },
        });
    }
    async checkWeekOverlap(trainingPlanId, weekStartDate, weekEndDate) {
        const existing = await this.prisma.weeklyGoal.findFirst({
            where: {
                trainingPlanId,
                weekStartDate: { lte: weekEndDate },
                weekEndDate: { gte: weekStartDate },
            },
        });
        if (!existing)
            return;
        if (existing.status === client_1.WeeklyGoalStatus.GENERATED ||
            existing.status === client_1.WeeklyGoalStatus.LOCKED) {
            throw new common_1.ConflictException('A plan for this week already exists. Delete the existing weekly goal and its workouts before regenerating.');
        }
        await this.prisma.workout.deleteMany({ where: { weeklyGoalId: existing.id } });
        await this.prisma.weeklyGoal.delete({ where: { id: existing.id } });
    }
    buildAiInput(runs, weekDates, trainingDays) {
        const totalDist = runs.reduce((sum, r) => sum + (r.distance ?? 0), 0);
        const avgDistKm = totalDist / runs.length / 1000;
        const avgSpeed = runs.reduce((sum, r) => sum + (r.average_speed ?? 0), 0) / runs.length;
        const hrRuns = runs.filter((r) => r.average_heartrate);
        const avgHR = hrRuns.length > 0
            ? Math.round(hrRuns.reduce((sum, r) => sum + r.average_heartrate, 0) / hrRuns.length)
            : null;
        const maxDistKm = Math.max(...runs.map((r) => r.distance ?? 0)) / 1000;
        const totalDistKm = totalDist / 1000;
        const runSummaries = runs.map((r, i) => ({
            index: i + 1,
            name: r.name,
            date: new Date(r.start_date).toLocaleDateString(),
            distanceKm: parseFloat(((r.distance ?? 0) / 1000).toFixed(2)),
            durationMin: r.moving_time ? Math.round(r.moving_time / 60) : null,
            avgPace: this.formatPace(r.average_speed ?? 0),
            avgHR: r.average_heartrate ? Math.round(r.average_heartrate) : null,
            elevationGain: r.total_elevation_gain ?? null,
        }));
        return {
            runSummaries,
            avgDistKm,
            avgPace: this.formatPace(avgSpeed),
            avgHR,
            maxDistKm,
            totalDistKm,
            weekDates,
            trainingDays,
        };
    }
    formatPace(speedMs) {
        if (!speedMs || speedMs <= 0)
            return 'N/A';
        const paceSecondsPerKm = 1000 / speedMs;
        const minutes = Math.floor(paceSecondsPerKm / 60);
        const seconds = Math.round(paceSecondsPerKm % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    getNextMonday() {
        const now = new Date();
        const day = now.getDay();
        const daysUntilMonday = day === 0 ? 1 : 8 - day;
        const monday = new Date(now);
        monday.setDate(now.getDate() + daysUntilMonday);
        monday.setHours(0, 0, 0, 0);
        return monday;
    }
    getWeekDates(monday) {
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            return d.toISOString().split('T')[0];
        });
    }
};
exports.AiPlannerService = AiPlannerService;
exports.AiPlannerService = AiPlannerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        strava_service_1.StravaService,
        gemini_service_1.GeminiService])
], AiPlannerService);
//# sourceMappingURL=ai-planner.service.js.map