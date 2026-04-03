import { createHash } from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { PlannerResults } from '../types/planner.js';
import {
  buildPlannerPrompt,
  buildAssessmentPrompt,
  type AiPlannerInput,
} from '../prompts/plannerPrompt.js';
import { getCached, setCached, ONE_HOUR_SECONDS } from './cacheService.js';

export type { AiPlannerInput };

const GEMINI_MODEL = 'gemini-3-flash-preview';
const CACHE_KEY_PREFIX = 'planner:';

/**
 * Builds a deterministic SHA-256 cache key from the prompt input.
 * Same Strava data → same key, regardless of call time.
 */
function buildCacheKey(input: AiPlannerInput): string {
  const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return `${CACHE_KEY_PREFIX}${hash}`;
}

/**
 * Calls the Gemini AI model to analyze running data and generate a week plan.
 * Results are cached in Redis for 1 hour to avoid redundant AI calls.
 */
export async function generateAiPlan(input: AiPlannerInput): Promise<PlannerResults> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey || geminiApiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    throw new Error('GEMINI_API_KEY is missing or not set. Please add it to your .env file.');
  }

  // --- Cache read ---
  const cacheKey = buildCacheKey(input);
  const cached = await getCached<PlannerResults>(cacheKey);
  if (cached) {
    console.error(`[Cache] HIT — returning cached AI plan (key: ${cacheKey.substring(0, 24)}...)`);
    return cached;
  }
  console.error(`[Cache] MISS — calling Gemini AI...`);

  // --- Gemini call ---
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  const prompt = buildPlannerPrompt(input);

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  let aiResult: PlannerResults;
  try {
    aiResult = JSON.parse(responseText) as PlannerResults;
  } catch (parseError) {
    console.error('Failed to parse Gemini AI response as JSON:', responseText);
    throw new Error(
      `AI returned an invalid JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
    );
  }

  if (!aiResult.analysis || !Array.isArray(aiResult.weekPlan)) {
    throw new Error("AI response is missing required fields: 'analysis' or 'weekPlan'.");
  }

  // --- Cache write (1 hour TTL) ---
  await setCached(cacheKey, aiResult, ONE_HOUR_SECONDS);

  return aiResult;
}

/**
 * Calls the Gemini AI model to generate 5 assessment workouts for athletes
 * with no Strava running history.
 */
export async function generateAssessmentPlan(weekDates: string[]): Promise<PlannerResults> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey || geminiApiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    throw new Error('GEMINI_API_KEY is missing or not set. Please add it to your .env file.');
  }

  const cacheKey = `${CACHE_KEY_PREFIX}assessment:${weekDates[0]}`;
  const cached = await getCached<PlannerResults>(cacheKey);
  if (cached) {
    return cached;
  }

  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { responseMimeType: 'application/json' },
  });

  const prompt = buildAssessmentPrompt(weekDates);
  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  let aiResult: PlannerResults;
  try {
    aiResult = JSON.parse(responseText) as PlannerResults;
  } catch (parseError) {
    throw new Error(
      `AI returned an invalid JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
    );
  }

  if (!aiResult.analysis || !Array.isArray(aiResult.weekPlan)) {
    throw new Error("AI response is missing required fields: 'analysis' or 'weekPlan'.");
  }

  await setCached(cacheKey, aiResult, ONE_HOUR_SECONDS);

  return aiResult;
}
