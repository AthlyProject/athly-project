import { Injectable, InternalServerErrorException, BadGatewayException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type {
  AiPlannerInput,
  PlannerGuardrails,
  PlannerResults,
  PreviousWeekAnalysis,
  WorkoutDay,
} from './types/planner.types';
import type { FormattedZones } from '../effort-zones/types/effort-zone.types';
import {
  buildPlannerPrompt,
  buildAssessmentPrompt,
  type UserProfileContext,
  type LongitudinalWeek,
  type DeterministicPlannerContext,
} from './prompts/planner-prompt';
import { buildGoalParserPrompt, type ParsedGoal } from './prompts/goal-parser-prompt';
import type { AnalyzedSession } from './workout-execution-analyzer.service';
import type { PlannedWeek } from './periodization';
import { validateSegmentTree, isStructurallyCompleteRun } from '../workouts/utils/validate-segments';

export interface PlannerExecution {
  prompt: string;
  rawResponse: string;
  parsed: PlannerResults;
  modelUsed: string;
}

const runTargetSchema = {
  type: SchemaType.OBJECT,
  properties: {
    paceSecPerKmMin: { type: SchemaType.INTEGER },
    paceSecPerKmMax: { type: SchemaType.INTEGER },
    hrZone: { type: SchemaType.INTEGER },
    rpe: { type: SchemaType.INTEGER },
  },
};

const endSchema = {
  type: SchemaType.OBJECT,
  properties: {
    by: {
      type: SchemaType.STRING,
      format: 'enum',
      enum: ['distanceM', 'durationSec', 'reps'],
    },
    value: { type: SchemaType.NUMBER },
  },
  required: ['by', 'value'],
};

const childSegmentSchema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    kind: {
      type: SchemaType.STRING,
      format: 'enum',
      enum: ['warmup', 'work', 'recovery', 'cooldown', 'rest'],
    },
    label: { type: SchemaType.STRING },
    end: endSchema,
    target: runTargetSchema,
  },
  required: ['id', 'kind', 'end'],
};

const segmentSchema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    kind: {
      type: SchemaType.STRING,
      format: 'enum',
      enum: ['warmup', 'work', 'recovery', 'cooldown', 'rest', 'set'],
    },
    label: { type: SchemaType.STRING },
    end: endSchema,
    target: runTargetSchema,
    repetitions: { type: SchemaType.INTEGER },
    children: { type: SchemaType.ARRAY, items: childSegmentSchema },
  },
  required: ['id', 'kind'],
};

const plannerResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    analysis: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING },
        runsAnalyzed: { type: SchemaType.INTEGER },
        period: { type: SchemaType.STRING },
        avgDistanceKm: { type: SchemaType.NUMBER },
        avgPace: { type: SchemaType.STRING },
        avgHeartRate: { type: SchemaType.NUMBER, nullable: true },
        totalDistanceKm: { type: SchemaType.NUMBER },
        trend: {
          type: SchemaType.STRING,
          format: 'enum',
          enum: ['improving (volume)', 'improving (intensity)', 'maintaining', 'declining'],
        },
        fitnessInsights: { type: SchemaType.STRING },
      },
      required: [
        'title',
        'runsAnalyzed',
        'period',
        'avgDistanceKm',
        'avgPace',
        'avgHeartRate',
        'totalDistanceKm',
        'trend',
        'fitnessInsights',
      ],
    },
    weekPlan: {
      type: SchemaType.ARRAY,
      minItems: 7,
      maxItems: 7,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          date: { type: SchemaType.STRING },
          dayOfWeek: { type: SchemaType.STRING },
          title: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          sportType: {
            type: SchemaType.STRING,
            format: 'enum',
            enum: ['running', 'walking', 'other'],
          },
          intensity: { type: SchemaType.INTEGER },
          reasoning: { type: SchemaType.STRING },
          isGoalAttempt: { type: SchemaType.BOOLEAN },
          segments: { type: SchemaType.ARRAY, items: segmentSchema },
        },
        required: ['date', 'dayOfWeek', 'title', 'description', 'sportType', 'intensity', 'segments'],
      },
    },
  },
  required: ['analysis', 'weekPlan'],
};

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly defaultPlannerModelName = 'gemini-3-flash-preview';
  private readonly defaultGoalParserModelName = 'gemini-2.5-flash';
  // Quantas vezes regerar quando a IA devolve treino degenerado (bloco único).
  private readonly MAX_STRUCTURE_ATTEMPTS = 3;

  constructor(private readonly configService: ConfigService) {}

  private getModel(modelName: string, usePlannerSchema = true) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('GEMINI_API_KEY is not configured.');
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
      model: modelName,
      // maxOutputTokens generoso: o "thinking" do 2.5-flash consome do orçamento de saída;
      // um teto baixo trunca o JSON do plano (7 dias + segments aninhados) e degenera os treinos.
      generationConfig: {
        responseMimeType: 'application/json',
        ...(usePlannerSchema ? { responseSchema: plannerResponseSchema as any } : {}),
        maxOutputTokens: 32768,
        temperature: 0.4,
      },
    });
  }

  private plannerModelName(): string {
    return this.configService.get<string>('GEMINI_PLANNER_MODEL') || this.defaultPlannerModelName;
  }

  private goalParserModelName(): string {
    return this.configService.get<string>('GEMINI_GOAL_PARSER_MODEL') || this.defaultGoalParserModelName;
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
    guardrails?: PlannerGuardrails,
    deterministicContext?: DeterministicPlannerContext | null,
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
      deterministicContext,
    );

    return this.runWithStructureGate(prompt, guardrails, this.plannerModelName());
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

    return this.runWithStructureGate(prompt, undefined, this.plannerModelName());
  }

  async parseGoal(goalText: string): Promise<ParsedGoal> {
    const model = this.getModel(this.goalParserModelName(), false);
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
  private async runWithStructureGate(
    basePrompt: string,
    guardrails: PlannerGuardrails | undefined,
    modelName: string,
  ): Promise<PlannerExecution> {
    const model = this.getModel(modelName);
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

      const degenerate = [
        ...this.assessStructure(parsed.weekPlan),
        ...this.assessPlanQuality(parsed, guardrails),
      ];
      if (degenerate.length === 0) {
        this.finalizeSegments(parsed.weekPlan);
        this.applyAnalysisOverride(parsed, guardrails);
        return { prompt, rawResponse, parsed, modelUsed: modelName };
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

  private assessPlanQuality(
    parsed: PlannerResults,
    guardrails: PlannerGuardrails | undefined,
  ): string[] {
    if (!guardrails) return [];
    const defects: string[] = [];

    const dates = parsed.weekPlan.map((d) => d.date);
    const expectedDates = new Set(guardrails.weekDates);
    for (const expected of guardrails.weekDates) {
      if (!dates.includes(expected)) defects.push(`weekPlan is missing date ${expected}`);
    }
    for (const date of dates) {
      if (!expectedDates.has(date)) defects.push(`weekPlan contains date outside target week: ${date}`);
    }

    const available = new Set(guardrails.availableDays.map((d) => d.toLowerCase()));
    for (const day of parsed.weekPlan) {
      if (!['running', 'walking', 'other'].includes(String(day.sportType))) {
        defects.push(`${day.date} has invalid sportType "${String(day.sportType)}"`);
      }
      if (day.sportType !== 'other' && !available.has(isoDayKey(day.date))) {
        defects.push(`${day.date} schedules training outside available days`);
      }
    }

    if (
      !['improving (volume)', 'improving (intensity)', 'maintaining', 'declining'].includes(
        parsed.analysis?.trend,
      )
    ) {
      defects.push(`analysis.trend "${String(parsed.analysis?.trend)}" is invalid`);
    }

    const goalAttempts = parsed.weekPlan.filter((d) => d.isGoalAttempt === true);
    if (goalAttempts.length > 1) defects.push('more than one isGoalAttempt=true');
    if (goalAttempts.length > 0 && guardrails.goalAttemptAllowed === false) {
      defects.push('isGoalAttempt=true even though backend feasibility is false');
    }

    if (guardrails.weeklyVolumeMaxKm && guardrails.weeklyVolumeMaxKm > 0) {
      const estimatedKm = this.estimatePlannedVolumeKm(
        parsed.weekPlan,
        guardrails.defaultPaceSecPerKm ?? 390,
      );
      if (estimatedKm > guardrails.weeklyVolumeMaxKm * 1.05) {
        defects.push(
          `planned volume ${estimatedKm.toFixed(2)}km exceeds max ${guardrails.weeklyVolumeMaxKm.toFixed(2)}km`,
        );
      }
    }

    return defects;
  }

  private applyAnalysisOverride(
    parsed: PlannerResults,
    guardrails: PlannerGuardrails | undefined,
  ): void {
    if (!guardrails?.analysisOverride) return;
    parsed.analysis = {
      ...parsed.analysis,
      ...guardrails.analysisOverride,
    };
  }

  private estimatePlannedVolumeKm(weekPlan: WorkoutDay[], defaultPaceSecPerKm: number): number {
    let totalM = 0;
    for (const day of weekPlan) {
      if (day.sportType === 'other') continue;
      totalM += this.estimateSegmentsMeters(day.segments ?? [], defaultPaceSecPerKm);
    }
    return totalM / 1000;
  }

  private estimateSegmentsMeters(segments: unknown[], defaultPaceSecPerKm: number): number {
    let totalM = 0;
    for (const raw of segments) {
      const seg = raw as any;
      const mult = seg?.kind === 'set' && typeof seg.repetitions === 'number' ? seg.repetitions : 1;
      if (seg?.kind === 'set' && Array.isArray(seg.children)) {
        totalM += mult * this.estimateSegmentsMeters(seg.children, defaultPaceSecPerKm);
        continue;
      }
      const end = seg?.end;
      if (!end || typeof end.value !== 'number') continue;
      if (end.by === 'distanceM') {
        totalM += end.value;
      } else if (end.by === 'durationSec') {
        const pace = targetMidPace(seg?.target) ?? defaultPaceSecPerKm;
        totalM += (end.value / pace) * 1000;
      }
    }
    return totalM;
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

function isoDayKey(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][day];
}

function targetMidPace(target: unknown): number | null {
  if (!target || typeof target !== 'object') return null;
  const t = target as { paceSecPerKmMin?: number; paceSecPerKmMax?: number };
  const min = typeof t.paceSecPerKmMin === 'number' && t.paceSecPerKmMin > 0 ? t.paceSecPerKmMin : null;
  const max = typeof t.paceSecPerKmMax === 'number' && t.paceSecPerKmMax > 0 ? t.paceSecPerKmMax : null;
  if (min !== null && max !== null) return (min + max) / 2;
  return min ?? max;
}
