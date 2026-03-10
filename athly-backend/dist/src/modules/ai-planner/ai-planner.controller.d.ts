import { AiPlannerService } from './ai-planner.service';
import { PlanNextWeekInput } from './dto/plan-next-week.input';
import { UserModel } from '../users/models/user.model';
import { AiPlannerResultModel } from './models/ai-planner-result.model';
export declare class AiPlannerController {
    private readonly aiPlannerService;
    constructor(aiPlannerService: AiPlannerService);
    planNextWeek(user: UserModel, input: PlanNextWeekInput): Promise<AiPlannerResultModel>;
}
