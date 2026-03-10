import { ConfigService } from '@nestjs/config';
import type { AiPlannerInput, PlannerResults } from './types/planner.types';
export declare class GeminiService {
    private readonly configService;
    private readonly modelName;
    constructor(configService: ConfigService);
    private getModel;
    generatePlan(input: AiPlannerInput): Promise<PlannerResults>;
    generateAssessmentPlan(weekDates: string[], trainingDays: number): Promise<PlannerResults>;
    private parseAndValidate;
}
