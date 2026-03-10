import { PrismaService } from '../../database/prisma.service';
import { StravaService } from './strava.service';
import { GeminiService } from './gemini.service';
import { PlanNextWeekInput } from './dto/plan-next-week.dto';
export declare class AiPlannerService {
    private readonly prisma;
    private readonly stravaService;
    private readonly geminiService;
    constructor(prisma: PrismaService, stravaService: StravaService, geminiService: GeminiService);
    planNextWeek(userId: string, input: PlanNextWeekInput): Promise<{
        trainingPlan: {
            id: string;
            status: any;
        };
        weeklyGoal: {
            id: string;
            trainingPlanId: string;
            weekStartDate: Date;
            weekEndDate: Date;
            status: any;
            metrics: any;
            createdAt: Date;
            updatedAt: Date;
        };
        workouts: {
            id: string;
            date: string;
            sportType: any;
            title: string;
            description: string | undefined;
            blocks: any;
            status: any;
            intensity: number | undefined;
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
