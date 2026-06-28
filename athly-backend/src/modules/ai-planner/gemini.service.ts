import { Injectable, InternalServerErrorException, BadGatewayException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AiPlannerInput, PlannerResults, PreviousWeekAnalysis, WorkoutDay } from './types/planner.types';
import type { FormattedZones } from '../effort-zones/types/effort-zone.types';
import {
  buildPlannerPrompt,
  buildAssessmentPrompt,
  type UserProfileContext,
  type LongitudinalWeek,
} from './prompts/planner-prompt';
import { buildGoalParserPrompt, type ParsedGoal } from './prompts/goal-parser-prompt';
import type { AnalyzedSession } from './workout-execution-analyzer.service';
import type { PlannedWeek } from './periodization';
import { validateSegmentTree, isStructurallyCompleteRun } from '../workouts/utils/validate-segments';

export interface PlannerExecution {
  prompt: string;
  rawResponse: string;
  parsed: PlannerResults;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly modelName = 'gemini-2.5-flash';
  // Quantas vezes regerar quando a IA devolve treino degenerado (bloco único).
  private readonly MAX_STRUCTURE_ATTEMPTS = 3;

  constructor(private readonly configService: ConfigService) {}

  private getModel() {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('GEMINI_API_KEY is not configured.');
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
      model: this.modelName,
      // maxOutputTokens generoso: o "thinking" do 2.5-flash consome do orçamento de saída;
      // um teto baixo trunca o JSON do plano (7 dias + segments aninhados) e degenera os treinos.
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 32768 },
    });
  }

  async generatePlan(
    input: AiPlannerInput,
    effortZones: FormattedZones,
    previousWeekAnalysis?: PreviousWeekAnalysis | null,
    goal?: ParsedGoal | null,
    userProfile?: UserProfileContext | null,
    analyzedSessions?: AnalyzedSession[],
    longitudinalWeeks?: LongitudinalWeek[],
    plannedWeek?: PlannedWeek | null,
    contextNote?: string | null,
  ): Promise<PlannerExecution> {
    const prompt = buildPlannerPrompt(
      input,
      effortZones,
      previousWeekAnalysis,
      goal,
      userProfile,
      analyzedSessions,
      longitudinalWeeks,
      plannedWeek,
      contextNote,
    );

    return this.runWithStructureGate(prompt);
  }

  async generateAssessmentPlan(
    weekDates: string[],
    trainingDays: number,
    availableDays: string[],
    effortZones: FormattedZones,
    goal?: ParsedGoal | null,
    userProfile?: UserProfileContext | null,
    analyzedSessions?: AnalyzedSession[],
  ): Promise<PlannerExecution> {
    const prompt = buildAssessmentPrompt(
      weekDates,
      trainingDays,
      availableDays,
      effortZones,
      goal,
      userProfile,
      analyzedSessions,
    );

    return this.runWithStructureGate(prompt);
  }

  async parseGoal(goalText: string): Promise<ParsedGoal> {
    const model = this.getModel();
    const prompt = buildGoalParserPrompt(goalText);

    let responseText: string;
    try {
      const result = await model.generateContent(prompt);
      responseText = result.response.text();
    } catch (err) {
      throw new BadGatewayException(
        `Gemini AI request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    let parsed: ParsedGoal;
    try {
      parsed = JSON.parse(responseText) as ParsedGoal;
    } catch {
      throw new BadGatewayException('Gemini AI returned an invalid JSON response for goal parsing.');
    }

    if (typeof parsed.isRunningRelated !== 'boolean' || !parsed.summary) {
      throw new BadGatewayException('Gemini AI goal parsing response is missing required fields.');
    }

    return parsed;
  }

  /**
   * Generates a plan and enforces the structural quality gate: if any running day
   * comes back degenerate (no warmup/main/cooldown — i.e. would collapse to a single
   * "main" block), regenerate with a corrective note appended, up to
   * MAX_STRUCTURE_ATTEMPTS. Only a structurally-complete plan is returned; otherwise
   * it throws so the caller never persists a broken week.
   */
  private async runWithStructureGate(basePrompt: string): Promise<PlannerExecution> {
    const model = this.getModel();
    let best: { rawResponse: string; parsed: PlannerResults; degenerate: string[] } | null = null;
    let prompt = basePrompt;

    for (let attempt = 1; attempt <= this.MAX_STRUCTURE_ATTEMPTS; attempt++) {
      let rawResponse: string;
      try {
        const result = await model.generateContent(prompt);
        rawResponse = result.response.text();
      } catch (err) {
        throw new BadGatewayException(
          `Gemini AI request failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      let parsed: PlannerResults;
      try {
        parsed = this.parseResponse(rawResponse);
      } catch (err) {
        // Malformed JSON / wrong shape — retry if attempts remain, else surface.
        this.logger.warn(
          `Plan generation attempt ${attempt}/${this.MAX_STRUCTURE_ATTEMPTS} failed to parse: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        if (attempt === this.MAX_STRUCTURE_ATTEMPTS && !best) throw err;
        prompt = `${basePrompt}\n${this.buildCorrectiveNote([])}`;
        continue;
      }

      const degenerate = this.assessStructure(parsed.weekPlan);
      if (degenerate.length === 0) {
        this.finalizeSegments(parsed.weekPlan);
        return { prompt, rawResponse, parsed };
      }

      this.logger.warn(
        `Plan generation attempt ${attempt}/${this.MAX_STRUCTURE_ATTEMPTS} returned ${degenerate.length} degenerate day(s): ${degenerate.join('; ')}`,
      );
      if (!best || degenerate.length < best.degenerate.length) {
        best = { rawResponse, parsed, degenerate };
      }
      prompt = `${basePrompt}\n${this.buildCorrectiveNote(degenerate)}`;
    }

    this.logger.error(
      `Gemini returned structurally incomplete workouts after ${this.MAX_STRUCTURE_ATTEMPTS} attempts: ${
        best?.degenerate.join('; ') ?? 'unknown'
      }`,
    );
    throw new BadGatewayException(
      `O plano gerado veio com treinos sem estrutura completa após ${this.MAX_STRUCTURE_ATTEMPTS} tentativas. Tente gerar novamente.`,
    );
  }

  /** JSON parse + shape validation (analysis + exactly 7 days). Does NOT mutate segments. */
  private parseResponse(responseText: string): PlannerResults {
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

  /**
   * Lists the running days that are structurally incomplete (would collapse to a
   * single "main" block). Rest days (sportType "other") are not gated. Pure — no mutation.
   */
  private assessStructure(weekPlan: WorkoutDay[]): string[] {
    const degenerate: string[] = [];
    for (const day of weekPlan) {
      if (day.sportType === 'other') continue;
      const result = isStructurallyCompleteRun(day.segments);
      if (!result.ok) degenerate.push(`${day.date} "${day.title}" (${result.reason})`);
    }
    return degenerate;
  }

  /**
   * Defensive final pass on an accepted plan: warns on missing reasoning and zeroes
   * any still-invalid tree (only reachable for non-gated "other" days) so the iOS
   * legacy `blocks` renderer can take over for that single day.
   */
  private finalizeSegments(weekPlan: WorkoutDay[]): void {
    for (const day of weekPlan) {
      if (day.sportType !== 'other' && !day.reasoning) {
        this.logger.warn(`Workout "${day.title}" on ${day.date} is missing reasoning field`);
      }
      const result = validateSegmentTree(day.segments);
      if (!result.ok) {
        this.logger.warn(
          `Workout "${day.title}" on ${day.date} returned an invalid segments tree (${result.reason}); falling back to legacy blocks for this day.`,
        );
        day.segments = [];
      }
    }
  }

  private buildCorrectiveNote(degenerateDays: string[]): string {
    const detail = degenerateDays.length
      ? `A tentativa anterior retornou ${degenerateDays.length} dia(s) de corrida SEM estrutura completa: ${degenerateDays.join('; ')}.`
      : 'A tentativa anterior não retornou um JSON válido no formato esperado.';
    return `<correcao_obrigatoria>
${detail}
REGERE o plano INTEIRO retornando JSON válido e garantindo que TODO dia de corrida (sportType "running") tenha, na árvore "segments":
- pelo menos 1 segmento "warmup",
- um bloco principal "work" OU um "set" (com children work+recovery para tiros),
- e pelo menos 1 segmento "cooldown".
NUNCA retorne um dia de corrida com um único segmento. Siga <segment_schema> e <segment_recipes>.
</correcao_obrigatoria>`;
  }
}
