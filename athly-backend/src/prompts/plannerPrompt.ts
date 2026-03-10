import type { RunSummary } from '../types/planner.js';

/**
 * Builds a prompt for athletes with no running history in Strava.
 * Asks the AI to generate 5 assessment workouts to measure the athlete's current level
 * before creating a personalised plan.
 */
export function buildAssessmentPrompt(weekDates: string[]): string {
  return `<role>
You are an expert running coach onboarding a new athlete who has no running history recorded on Strava yet.
Your goal is to design 5 assessment workouts spread across the next week to safely measure their current fitness level before prescribing a personalised training plan.
Tone: welcoming, encouraging, and clear — this athlete is just starting their journey.
</role>

<context>
The athlete has no previous running data available. Before creating a personalised plan aimed at running 5 km in under 26 minutes, you must first assess:
1. Their aerobic base (easy-pace run)
2. Their lactate threshold (tempo effort)
3. Their speed ceiling (short intervals)
4. Their muscular endurance (longer easy run)
5. Their recovery capacity (light jog or walk-run)

The remaining 2 days of the week must be full rest days.
Week to plan: ${weekDates[0]} (Monday) through ${weekDates[6]} (Sunday).
</context>

<constraints>
- Generate EXACTLY 5 workout days and 2 rest days — 7 entries total.
- Keep all distances conservative (1–5 km) since there is no baseline data.
- Use RPE (1–10 scale) for effort guidance since there is no heart rate history.
- For rest days omit: distanceKm, targetPace, durationMinutes, startTime, endTime.
- type must be exactly one of: "easy" | "moderate" | "high" | "rest".
- trend must be "maintaining" (no history to determine otherwise).
- Set runsAnalyzed to 0, period to "No data", avgDistanceKm to 0, avgPace to "N/A", avgHeartRate to null, totalDistanceKm to 0.
- fitnessInsights must explain that no data was found and that these 5 sessions are an assessment baseline — after completing them and syncing to Strava, a personalised plan can be generated.
</constraints>

<output_schema>
Return ONLY this JSON — no markdown fences, no extra text:
{
  "analysis": {
    "runsAnalyzed": 0,
    "period": "No data",
    "avgDistanceKm": 0,
    "avgPace": "N/A",
    "avgHeartRate": null,
    "totalDistanceKm": 0,
    "trend": "maintaining",
    "fitnessInsights": "<explanation that no Strava running data was found, what these 5 assessment sessions measure, and that a personalised plan will be generated after completing them>"
  },
  "weekPlan": [
    {
      "date": "<YYYY-MM-DD>",
      "dayOfWeek": "<Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday>",
      "title": "<workout title>",
      "type": "<easy|moderate|high|rest>",
      "distanceKm": <number — omit on rest days>,
      "targetPace": "<M:SS /km — omit on rest days>",
      "durationMinutes": <number — omit on rest days>,
      "description": "<specific, actionable coaching instruction — include RPE target>",
      "startTime": "<HH:MM — omit on rest days>",
      "endTime": "<HH:MM — omit on rest days>"
    }
  ]
}
</output_schema>`;
}

export interface AiPlannerInput {
  runSummaries: RunSummary[];
  avgDistKm: number;
  avgPace: string;
  avgHR: number | null;
  maxDistKm: number;
  totalDistKm: number;
  weekDates: string[];
}

/** Target goal used to contextualise the coaching prompt. */
const GOAL = {
  distanceKm: 5,
  targetTimeMin: 26,
  targetPace: '5:12/km',
} as const;

/**
 * Classifies the athlete relative to the goal pace so the model can
 * calibrate its language and session intensity.
 */
function classifyAthlete(avgPace: string): string {
  const match = avgPace.match(/^(\d+):(\d{2})/);
  if (!match) return 'unknown';
  const totalSec = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  if (totalSec > 345)  (total'ec > 312) return 'Progressing (5:13–5:44/km) — increase interval i'tensity';
  return 'Goal within''
''
/**
 * Builds the structured coaching prompt sent to the Gemini model.
 * Returns ONLY a JSON string matching PlannerResults { analysis: RunAnalysis, weekPlan: WorkoutDay[] }.
 */
export function buildPlannerPrompt(input: AiPlannerInput): string {
  const { runSummaries, avgDistKm, avgPace, avgHR, maxDistKm, totalDistKm, weekDates } = input;
  const athleteClass = classifyAthlete(avgPace);
  const hrCtx = avgHR ? `${avgHR} bpm` : 'not available — prescribe effort by RPE (1–10 scale)';

  return `<role>
You are an expert running coach. Your athlete's goal is to run ${GOAL.distanceKm}km in under ${GOAL.targetTimeMin} minutes (target pace: ${GOAL.targetPace}).
Tone: direct, motivating, and data-driven — like a track and field coach.
Current athlete classification: ${athleteClass}.
</role>

<athlete_data>
Recent runs analyzed (last ${runSummaries.length} runs):
${JSON.stringify(runSummaries, null, 2)}

Summary stats:
- Average distance: ${avgDistKm.toFixed(2)} km
- Average pace: ${avgPace}
- Average heart rate: ${hrCtx}
- Longest recent run: ${maxDistKm.toFixed(2)} km
- Total distance analyzed: ${totalDistKm.toFixed(2)} km
- Week to plan: ${weekDates[0]} (Monday) through ${weekDates[6]} (Sunday)
</athlete_data>

<task>
1. Analyze the athlete's fitness level, pace trend, and training patterns.
2. Build a balanced 7-day plan (${weekDates[0]} to ${weekDates[6]}) that follows periodization principles and moves the athlete toward the sub-${GOAL.targetTimeMin}min ${GOAL.distanceKm}km goal.
3. Derive all distances and paces from the athlete's actual data — never invent numbers.
4. Return ONLY the JSON object described in <output_schema>. No markdown, no prose, no extra keys.
</task>

<reference_paces>
| Session type     | Target pace  |
|------------------|--------------|
| Intervals (400m) | 4:45–5:00/km |
| Tempo run        | 5:12–5:20/km |
| Long run         | 6:00–6:30/km |
| Recovery         | 6:30–7:00/km |
| Rest day         | —            |
</reference_paces>

<constraints>
- Never increase weekly volume by more than 10% above the athlete's recent average.
- Interval sessions must include a 10-min warm-up and 5-min cool-down (reflected in durationMinutes).
- If HR data is unavailable, prescribe effort by RPE in the description field.
- Rest days are non-negotiable — include at least one full rest day.
- weekPlan must contain EXACTLY 7 entries, one per day from ${weekDates[0]} to ${weekDates[6]}.
- For rest days omit: distanceKm, targetPace, durationMinutes, startTime, endTime.
- trend must be exactly one of: "improving (volume)" | "improving (intensity)" | "maintaining" | "declining".
- type must be exactly one of: "easy" | "moderate" | "high" | "rest".
</constraints>

<output_schema>
Return ONLY this JSON — no markdown fences, no extra text:
{
  "analysis": {
    "runsAnalyzed": <number>,
    "period": "<date of first run> — <date of last run>",
    "avgDistanceKm": <number>,
    "avgPace": "<M:SS /km>",
    "avgHeartRate": <number | null>,
    "totalDistanceKm": <number>,
    "trend": "<improving (volume) | improving (intensity) | maintaining | declining>",
    "fitnessInsights": "<2–3 sentences: current fitness diagnosis, key pattern observed, and one concrete focus area to reach sub-${GOAL.targetTimeMin}min>"
  },
  "weekPlan": [
    {
      "date": "<YYYY-MM-DD>",
      "dayOfWeek": "<Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday>",
      "title": "<workout title>",
      "type": "<easy|moderate|high|rest>",
      "distanceKm": <number — omit on rest days>,
      "targetPace": "<M:SS /km — omit on rest days>",
      "durationMinutes": <number — omit on rest days>,
      "description": "<specific, actionable coaching instruction for this session>",
      "startTime": "<HH:MM — omit on rest days>",
      "endTime": "<HH:MM — omit on rest days>"
    }
  ]
}
</output_schema>`;
}
