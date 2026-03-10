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
exports.WorkoutsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
const client_1 = require("@prisma/client");
let WorkoutsService = class WorkoutsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getTodayWorkout(userId) {
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
    async getWorkoutById(userId, id) {
        const workout = await this.prisma.workout.findFirst({
            where: { userId, id },
        });
        return workout ? this.mapWorkout(workout) : null;
    }
    async createWorkout(userId, input) {
        const blocks = (input.blocks ?? []).map((block) => ({
            type: block.type,
            duration: block.duration ?? undefined,
            distance: block.distance ?? undefined,
            targetPace: block.targetPace ?? undefined,
            instructions: block.instructions ?? undefined,
        }));
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
    async getWorkoutsByTrainingPlan(userId, trainingPlanId) {
        const workouts = await this.prisma.workout.findMany({
            where: { userId, trainingPlanId },
            orderBy: { dateScheduled: 'asc' },
        });
        return workouts.map((workout) => this.mapWorkout(workout));
    }
    async getWorkoutHistory(userId) {
        const workouts = await this.prisma.workout.findMany({
            where: { userId, status: { in: ['done', 'partial'] } },
            orderBy: { dateScheduled: 'desc' },
        });
        if (workouts.length > 0) {
            return workouts.map((workout) => ({
                ...this.mapWorkout(workout),
                status: client_1.WorkoutStatus.done,
            }));
        }
        const fallback = await this.prisma.workout.findMany({
            where: { userId },
            take: 2,
            orderBy: { dateScheduled: 'desc' },
        });
        return fallback.map((workout) => ({
            ...this.mapWorkout(workout),
            status: client_1.WorkoutStatus.done,
        }));
    }
    async submitWorkoutFeedback(userId, workoutId, input) {
        const workout = await this.prisma.workout.findFirst({
            where: { id: workoutId, userId },
        });
        if (!workout) {
            throw new common_1.NotFoundException('Workout not found');
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
    }
    async completeWorkout(userId, workoutId) {
        const updated = await this.prisma.workout.updateMany({
            where: { id: workoutId, userId },
            data: { status: 'done' },
        });
        if (!updated.count) {
            throw new common_1.NotFoundException('Workout not found');
        }
        const workout = await this.prisma.workout.findFirst({
            where: { id: workoutId, userId },
        });
        if (!workout) {
            throw new common_1.NotFoundException('Workout not found');
        }
        return this.mapWorkout(workout);
    }
    async skipWorkout(userId, workoutId) {
        const updated = await this.prisma.workout.updateMany({
            where: { id: workoutId, userId },
            data: { status: 'skipped' },
        });
        if (!updated.count) {
            throw new common_1.NotFoundException('Workout not found');
        }
        const workout = await this.prisma.workout.findFirst({
            where: { id: workoutId, userId },
        });
        if (!workout) {
            throw new common_1.NotFoundException('Workout not found');
        }
        return this.mapWorkout(workout);
    }
    mapWorkout(workout) {
        return {
            id: workout.id,
            date: workout.dateScheduled.toISOString().split('T')[0],
            sportType: workout.sportType,
            title: workout.title,
            description: workout.description ?? undefined,
            blocks: workout.blocks ?? [],
            status: workout.status,
            intensity: workout.intensity ?? undefined,
            stravaActivityId: workout.stravaActivityId ?? null,
        };
    }
    async updateWorkout(workoutId, input) {
        console.log('chegou aqui');
        const workout = await this.prisma.workout.findFirst({
            where: { id: workoutId },
        });
        console.log('workout', workout);
        if (!workout) {
            throw new common_1.NotFoundException('Workout not found');
        }
        const updateData = {};
        if (input.title !== undefined)
            updateData.title = input.title;
        if (input.description !== undefined)
            updateData.description = input.description;
        if (input.intensity !== undefined)
            updateData.intensity = input.intensity;
        if (input.status !== undefined)
            updateData.status = input.status;
        if (input.sportType !== undefined)
            updateData.sportType = input.sportType;
        if (input.date !== undefined)
            updateData.dateScheduled = new Date(input.date);
        if (input.blocks !== undefined) {
            updateData.blocks = input.blocks.map((block) => ({
                type: block.type,
                duration: block.duration ?? undefined,
                distance: block.distance ?? undefined,
                targetPace: block.targetPace ?? undefined,
                instructions: block.instructions ?? undefined,
            }));
        }
        const updated = await this.prisma.workout.update({
            where: { id: workoutId },
            data: updateData,
        });
        return this.mapWorkout(updated);
    }
};
exports.WorkoutsService = WorkoutsService;
exports.WorkoutsService = WorkoutsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WorkoutsService);
//# sourceMappingURL=workouts.service.js.map