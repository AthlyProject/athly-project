import { PrismaService } from '../../database/prisma.service';
import { CreateTrainingPlanInput } from './dto/create-training-plan.dto';
import { UpdateTrainingPlanInput } from './dto/update-training-plan.dto';
import { TrainingPlanModel } from './models/training-plan.model';
export declare class TrainingPlansService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getMyTrainingPlan(userId: string): Promise<TrainingPlanModel | null>;
    getTrainingPlanById(userId: string, id: string): Promise<TrainingPlanModel>;
    createTrainingPlan(userId: string, input: CreateTrainingPlanInput): Promise<TrainingPlanModel>;
    updateTrainingPlan(userId: string, id: string, input: UpdateTrainingPlanInput): Promise<TrainingPlanModel>;
    deleteTrainingPlan(userId: string, id: string): Promise<void>;
    private mapTrainingPlan;
}
