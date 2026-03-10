import { WeeklyGoalsService } from './weekly-goals.service';
import { CreateWeeklyGoalInput } from './dto/create-weekly-goal.input';
import { UpdateWeeklyGoalInput } from './dto/update-weekly-goal.input';
import { UserModel } from '../users/models/user.model';
import { WeeklyGoalModel } from './models/weekly-goal.model';
export declare class WeeklyGoalsController {
    private readonly weeklyGoalsService;
    constructor(weeklyGoalsService: WeeklyGoalsService);
    getWeeklyGoalsByTrainingPlan(user: UserModel, trainingPlanId: string): Promise<WeeklyGoalModel[]>;
    getWeeklyGoalById(user: UserModel, uuid: string): Promise<WeeklyGoalModel | null>;
    createWeeklyGoal(user: UserModel, input: CreateWeeklyGoalInput): Promise<WeeklyGoalModel>;
    updateWeeklyGoal(user: UserModel, uuid: string, input: UpdateWeeklyGoalInput): Promise<WeeklyGoalModel>;
    deleteWeeklyGoal(user: UserModel, uuid: string): Promise<void>;
}
