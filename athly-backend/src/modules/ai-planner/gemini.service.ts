import { Injectable, InternalServerErrorException, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AiPlannerInput, PlannerResults } from './types/planner.types';
import { buildPlannerPrompt, buildAssessmentPrompt } from './prompts/planner-prompt';

@Injectable()
export class GeminiService {
  private readonly modelName = 'gemini-2.5-flash';

  constructor(private readonly configService: ConfigService) {}

  private getModel() {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('GEMINI_API_KEY is not configured.');
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: { responseMimeType: 'application/json' },
    });
  }

  async generatePlan(input: AiPlannerInput): Promise<PlannerResults> {
    const model = this.getModel();
    const prompt = buildPlannerPrompt(input);

    let responseText: string;
    try {
      const result = await model.generateContent(prompt);
      responseText = result.response.text();
    } catch (err) {
      throw new BadGatewayException(
        `Gemini AI request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return this.parseAndValidate(responseText);
  }

  async generateAssessmentPlan(weekDates: string[], trainingDays: number): Promise<PlannerResults> {
    const model = this.getModel();
    const prompt = buildAssessmentPrompt(weekDates, trainingDays);

    let responseText: string;
    try {
      const result = await model.generateContent(prompt);
      responseText = result.response.text();
    } catch (err) {
      throw new BadGatewayException(
        `Gemini AI request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return this.parseAndValidate(responseText);
  }

  private parseAndValidate(responseText: string): PlannerResults {
    let parsed: PlannerResults;
    try {
      parsed = JSON.parse(responseText) as PlannerResults;
    } catch {
      throw new BadGatewayException('Gemini AI returned an invalid JSON response.');
    }

    if (!parsed.analysis || !Array.isArray(parsed.weekPlan)) {
      throw new BadGatewayException(
        "Gemini AI response is missing required fields: 'analysis' or 'weekPlan'.",
      );
    }

    if (parsed.weekPlan.length !== 7) {
      throw new BadGatewayException(
        `Gemini AI returned ${parsed.weekPlan.length} workout days instead of 7.`,
      );
    }

    return parsed;
  }
}
