import { Injectable, InternalServerErrorException, BadGatewayException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenAI,
  type GenerateContentResponse,
} from '@google/genai';
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
  usage: AiPlannerUsage;
}

export interface AiPlannerUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  estimatedCostUsd: number | null;
  pricing: {
    inputUsdPer1M: number | null;
    outputUsdPer1M: number | null;
    source: 'ai.google.dev/pricing';
  };
  attempts: number;
  tokenSource: 'usageMetadata' | 'estimatedFromText' | 'mixed';
}

const runTargetSchema = {
  type: 'object',
  properties: {
    paceSecPerKmMin: { type: 'integer' },
    paceSecPerKmMax: { type: 'integer' },
    hrZone: { type: 'integer' },
    rpe: { type: 'integer' },
  },
};

const endSchema = {
  type: 'object',
  properties: {
    by: {
      type: 'string',
      enum: ['distanceM', 'durationSec', 'reps'],
    },
    value: { type: 'number' },
  },
  required: ['by', 'value'],
};

const childSegmentSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    kind: {
      type: 'string',
      enum: ['warmup', 'work', 'recovery', 'cooldown', 'rest'],
    },
    label: { type: 'string' },
    end: endSchema,
    target: runTargetSchema,
  },
  required: ['id', 'kind', 'label', 'end'],
};

const nonSetSegmentSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    kind: {
      type: 'string',
      enum: ['warmup', 'work', 'recovery', 'cooldown', 'rest'],
    },
    label: { type: 'string' },
    end: endSchema,
    target: runTargetSchema,
  },
  required: ['id', 'kind', 'label', 'end'],
};

const setSegmentSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    kind: {
      type: 'string',
      enum: ['set'],
    },
    label: { type: 'string' },
    repetitions: { type: 'integer', minimum: 1 },
    children: { type: 'array', items: childSegmentSchema },
  },
  required: ['id', 'kind', 'label', 'repetitions', 'children'],
};

const segmentSchema = {
  anyOf: [nonSetSegmentSchema, setSegmentSchema],
};

export const plannerResponseSchema = {
  type: 'object',
  properties: {
    analysis: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        runsAnalyzed: { type: 'integer' },
        period: { type: 'string' },
        avgDistanceKm: { type: 'number' },
        avgPace: { type: 'string' },
        avgHeartRate: { type: 'number', nullable: true },
        totalDistanceKm: { type: 'number' },
        trend: {
          type: 'string',
          enum: ['improving (volume)', 'improving (intensity)', 'maintaining', 'declining'],
        },
        fitnessInsights: { type: 'string' },
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
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          dayOfWeek: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          sportType: {
            type: 'string',
            enum: ['running', 'walking', 'other'],
          },
          intensity: { type: 'integer' },
          reasoning: { type: 'string' },
          isGoalAttempt: { type: 'boolean' },
          segments: { type: 'array', items: segmentSchema },
        },
        required: ['date', 'dayOfWeek', 'title', 'description', 'sportType', 'intensity', 'segments'],
      },
    },
  },
  required: ['analysis', 'weekPlan'],
};

export const goalParserResponseSchema = {
  type: 'object',
  properties: {
    isRunningRelated: { type: 'boolean' },
    targetDistance: { type: 'string', nullable: true },
    targetTime: { type: 'string', nullable: true },
    eventDate: { type: 'string', nullable: true },
    eventName: { type: 'string', nullable: true },
    experienceLevel: {
      type: 'string',
      enum: ['beginner', 'intermediate', 'advanced'],
      nullable: true,
    },
    summary: { type: 'string' },
    rejectionReason: { type: 'string', nullable: true },
  },
  required: [
    'isRunningRelated',
    'targetDistance',
    'targetTime',
    'eventDate',
    'eventName',
    'experienceLevel',
    'summary',
    'rejectionReason',
  ],
};

const GEMINI_PRICING_USD_PER_1M: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
  'gemini-3.1-flash-lite': { input: 0.25, output: 1.5 },
  'gemini-3-flash-preview': { input: 0.5, output: 3 },
  'gemini-3.5-flash': { input: 1.5, output: 9 },
  'gemini-3.1-pro-preview': { input: 2, output: 12 },
};

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly defaultPlannerModelName = 'gemini-3-flash-preview';
  private readonly defaultGoalParserModelName = 'gemini-3.1-flash-lite';
  // Quantas vezes regerar quando a IA devolve treino degenerado (bloco único).
  private readonly MAX_STRUCTURE_ATTEMPTS = 3;

  constructor(private readonly configService: ConfigService) {}

  private getClient(): GoogleGenAI {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('GEMINI_API_KEY is not configured.');
    }
    return new GoogleGenAI({ apiKey });
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
    const modelName = this.goalParserModelName();
    const prompt = buildGoalParserPrompt(goalText);

    let responseText: string;
    try {
      const result = await this.generateJson(prompt, modelName, goalParserResponseSchema);
      responseText = result.rawResponse;
      this.logger.log(this.formatUsageLog('goal_parser', result.usage));
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
    let best: { rawResponse: string; parsed: PlannerResults; degenerate: string[] } | null = null;
    let prompt = basePrompt;
    let aggregateUsage = this.emptyUsage(modelName);

    for (let attempt = 1; attempt <= this.MAX_STRUCTURE_ATTEMPTS; attempt++) {
      let rawResponse: string;
      try {
        const result = await this.generateJson(prompt, modelName, plannerResponseSchema);
        rawResponse = result.rawResponse;
        aggregateUsage = this.mergeUsage(aggregateUsage, result.usage);
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
        if (attempt === this.MAX_STRUCTURE_ATTEMPTS && !best) {
          this.logger.log(this.formatUsageLog('weekly_plan_failed', aggregateUsage));
          throw err;
        }
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
        this.logger.log(this.formatUsageLog('weekly_plan', aggregateUsage));
        return { prompt, rawResponse, parsed, modelUsed: modelName, usage: aggregateUsage };
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
    this.logger.log(this.formatUsageLog('weekly_plan_failed', aggregateUsage));
    throw new BadGatewayException(
      `O plano gerado veio com treinos sem estrutura completa após ${this.MAX_STRUCTURE_ATTEMPTS} tentativas. Tente gerar novamente.`,
    );
  }

  private async generateJson(
    prompt: string,
    modelName: string,
    responseJsonSchema: unknown,
  ): Promise<{ rawResponse: string; usage: AiPlannerUsage }> {
    const response = await this.getClient().models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema,
        temperature: 0.25,
      },
    });

    const rawResponse = response.text;
    if (!rawResponse) {
      throw new BadGatewayException('Gemini AI returned an empty response.');
    }

    return {
      rawResponse,
      usage: this.buildUsage(modelName, response, prompt, rawResponse),
    };
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
      // Volume is a coaching quality guardrail, not a reason to make week creation fail
      // for moderate model drift. The prompt still asks for the exact cap; this gate only
      // rejects clearly excessive plans and asks the model to regenerate.
      if (estimatedKm > guardrails.weeklyVolumeMaxKm * 1.25) {
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

  private buildUsage(
    modelName: string,
    response: GenerateContentResponse,
    prompt: string,
    rawResponse: string,
  ): AiPlannerUsage {
    const metadata = response.usageMetadata;
    const hasMetadata =
      typeof metadata?.promptTokenCount === 'number' ||
      typeof metadata?.candidatesTokenCount === 'number' ||
      typeof metadata?.totalTokenCount === 'number';

    const inputTokens = hasMetadata
      ? Math.max(0, metadata?.promptTokenCount ?? 0)
      : estimateTextTokens(prompt);
    const outputTokens = hasMetadata
      ? Math.max(0, metadata?.candidatesTokenCount ?? 0)
      : estimateTextTokens(rawResponse);
    const thinkingTokens = hasMetadata ? Math.max(0, metadata?.thoughtsTokenCount ?? 0) : 0;
    const totalTokens = hasMetadata
      ? Math.max(0, metadata?.totalTokenCount ?? inputTokens + outputTokens + thinkingTokens)
      : inputTokens + outputTokens;

    return this.withCost({
      model: modelName,
      inputTokens,
      outputTokens,
      thinkingTokens,
      totalTokens,
      estimatedCostUsd: null,
      pricing: {
        inputUsdPer1M: null,
        outputUsdPer1M: null,
        source: 'ai.google.dev/pricing',
      },
      attempts: 1,
      tokenSource: hasMetadata ? 'usageMetadata' : 'estimatedFromText',
    });
  }

  private emptyUsage(modelName: string): AiPlannerUsage {
    return this.withCost({
      model: modelName,
      inputTokens: 0,
      outputTokens: 0,
      thinkingTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: null,
      pricing: {
        inputUsdPer1M: null,
        outputUsdPer1M: null,
        source: 'ai.google.dev/pricing',
      },
      attempts: 0,
      tokenSource: 'usageMetadata',
    });
  }

  private mergeUsage(a: AiPlannerUsage, b: AiPlannerUsage): AiPlannerUsage {
    const tokenSource =
      a.tokenSource === b.tokenSource ? a.tokenSource : a.attempts === 0 ? b.tokenSource : 'mixed';
    return this.withCost({
      model: a.model,
      inputTokens: a.inputTokens + b.inputTokens,
      outputTokens: a.outputTokens + b.outputTokens,
      thinkingTokens: a.thinkingTokens + b.thinkingTokens,
      totalTokens: a.totalTokens + b.totalTokens,
      estimatedCostUsd: null,
      pricing: a.pricing,
      attempts: a.attempts + b.attempts,
      tokenSource,
    });
  }

  private withCost(usage: AiPlannerUsage): AiPlannerUsage {
    const pricing = pricingForModel(usage.model, usage.inputTokens);
    const estimatedCostUsd = pricing
      ? (usage.inputTokens / 1_000_000) * pricing.input +
        ((usage.outputTokens + usage.thinkingTokens) / 1_000_000) * pricing.output
      : null;

    return {
      ...usage,
      estimatedCostUsd: estimatedCostUsd === null ? null : roundUsd(estimatedCostUsd),
      pricing: {
        inputUsdPer1M: pricing?.input ?? null,
        outputUsdPer1M: pricing?.output ?? null,
        source: 'ai.google.dev/pricing',
      },
    };
  }

  private formatUsageLog(label: string, usage: AiPlannerUsage): string {
    const cost = usage.estimatedCostUsd === null ? 'unknown' : `$${usage.estimatedCostUsd.toFixed(6)}`;
    return `Gemini ${label} usage: model=${usage.model}, attempts=${usage.attempts}, inputTokens=${usage.inputTokens}, outputTokens=${usage.outputTokens}, thinkingTokens=${usage.thinkingTokens}, totalTokens=${usage.totalTokens}, estimatedCostUsd=${cost}, tokenSource=${usage.tokenSource}`;
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

function pricingForModel(modelName: string, inputTokens = 0): { input: number; output: number } | null {
  const normalized = modelName.replace(/^models\//, '').toLowerCase();
  if (normalized === 'gemini-3.1-pro-preview' && inputTokens > 200_000) {
    return { input: 4, output: 18 };
  }
  return GEMINI_PRICING_USD_PER_1M[normalized] ?? null;
}

function estimateTextTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
