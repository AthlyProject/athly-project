import { TrainingPlansService } from './training-plans.service';
import { CreateTrainingPlanInput } from './dto/create-training-plan.dto';
import { UpdateTrainingPlanInput } from './dto/update-training-plan.dto';
import { UserModel } from '../users/models/user.model';
import { TrainingPlanModel } from './models/training-plan.model';
export declare class TrainingPlansController {
    private readonly trainingPlansService;
    constructor(trainingPlansService: TrainingPlansService);
    getMyTrainingPlan(user: UserModel): Promise<TrainingPlanModel | null>;
    getTrainingPlanById(user: UserModel, id: string): Promise<TrainingPlanModel | null>;
    createTrainingPlan(user: UserModel, input: CreateTrainingPlanInput): Promise<TrainingPlanModel>;
    updateTrainingPlan(user: UserModel, id: string, input: UpdateTrainingPlanInput): Promise<TrainingPlanModel>;
    deleteTrainingPlan(user: UserModel, id: string): Promise<void>;
}
