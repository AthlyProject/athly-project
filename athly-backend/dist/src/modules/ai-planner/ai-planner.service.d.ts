import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { StravaService } from './strava.service';
import { GeminiService } from './gemini.service';
import { PlanNextWeekInput } from './dto/plan-next-week.input';
export declare class AiPlannerService {
    private readonly prisma;
    private readonly stravaService;
    private readonly geminiService;
    constructor(prisma: PrismaService, stravaService: StravaService, geminiService: GeminiService);
    planNextWeek(userId: string, input: PlanNextWeekInput): Promise<{
        trainingPlan: {
            id: string;
            status: import("@prisma/client").$Enums.TrainingPlanStatus;
        };
        weeklyGoal: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            trainingPlanId: string;
            status: import("@prisma/client").$Enums.WeeklyGoalStatus;
            weekStartDate: Date;
            weekEndDate: Date;
            metrics: Prisma.JsonValue;
        };
        workouts: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            trainingPlanId: string;
            weeklyGoalId: string | null;
            dateScheduled: Date;
            sportType: import("@prisma/client").$Enums.SportType;
            title: string;
            description: string | null;
            blocks: Prisma.JsonValue;
            status: import("@prisma/client").$Enums.WorkoutStatus;
            intensity: number | null;
            stravaActivityId: string | null;
        }[];
        analysis: import("./types/planner.types").RunAnalysis;
        isAssessment: boolean;
    }>;
    private resolveTrainingPlan;
    private checkWeekOverlap;
    private buildAiInput;
    private formatPace;
    private getNextMonday;
    private getWeekDates;
}
