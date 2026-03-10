import { AiPlannerService } from './ai-planner.service';
import { PlanNextWeekInput } from './dto/plan-next-week.input';
import { UserModel } from '../users/models/user.model';
export declare class AiPlannerController {
    private readonly aiPlannerService;
    constructor(aiPlannerService: AiPlannerService);
    planNextWeek(user: UserModel, input: PlanNextWeekInput): Promise<{
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
            metrics: import("@prisma/client/runtime/client").JsonValue;
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
            blocks: import("@prisma/client/runtime/client").JsonValue;
            status: import("@prisma/client").$Enums.WorkoutStatus;
            intensity: number | null;
            stravaActivityId: string | null;
        }[];
        analysis: import("./types/planner.types").RunAnalysis;
        isAssessment: boolean;
    }>;
}
