import { PrismaService } from '../../database/prisma.service';
import { CreateWeeklyGoalInput } from './dto/create-weekly-goal.dto';
import { UpdateWeeklyGoalInput } from './dto/update-weekly-goal.dto';
import { WeeklyGoalModel } from './models/weekly-goal.model';
export declare class WeeklyGoalsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createWeeklyGoal(userId: string, input: CreateWeeklyGoalInput): Promise<WeeklyGoalModel>;
    getWeeklyGoalsByTrainingPlan(userId: string, trainingPlanId: string): Promise<WeeklyGoalModel[]>;
    getWeeklyGoalById(userId: string, id: string): Promise<WeeklyGoalModel>;
    updateWeeklyGoal(userId: string, id: string, input: UpdateWeeklyGoalInput): Promise<WeeklyGoalModel>;
    deleteWeeklyGoal(userId: string, id: string): Promise<void>;
    private mapWeeklyGoal;
}
