import { z } from 'zod';
import { PlannerService } from '../services/plannerService.js';
import { saveWeekPlan } from '../db/weekPlanRepository.js';

const PlanNextWeekInputSchema = z.object({
  numberOfRuns: z
    .number()
    .int()
    .positive()
    .optional()
    .default(5)
    .describe('Number of recent runs to analyze (default: 5)'),
  weekStartDate: z
    .string()
    .optional()
    .describe("Start date for the plan (ISO format, e.g. '2026-03-09'). Defaults to next Monday."),
});

type PlanNextWeekInput = z.infer<typeof PlanNextWeekInputSchema>;

export const planNextWeekTool = {
  name: 'plan-next-week',
  description:
    'Analyzes recent Strava runs using Google Gemini AI and generates a personalized 7-day training plan. The plan is saved to MongoDB and returned as JSON.',
  inputSchema: PlanNextWeekInputSchema,
  execute: async ({ numberOfRuns, weekStartDate }: PlanNextWeekInput) => {
    const token = process.env.STRAVA_ACCESS_TOKEN;

    if (!token || token === 'YOUR_STRAVA_ACCESS_TOKEN_HERE') {
      return {
        content: [
          {
            type: 'text' as const,
            text: '❌ Configuration Error: STRAVA_ACCESS_TOKEN is missing or not set.',
          },
        ],
        isError: true,
      };
    }

    try {
      const result = await PlannerService.planNextWeek(token, numberOfRuns, weekStartDate);

      const isAssessment = result.analysis.runsAnalyzed === 0;
      if (isAssessment) {
        console.error('No Strava running data — returning AI-generated assessment plan.');
      }

      let savedId: string | undefined;
      try {
        savedId = await saveWeekPlan({
          analysis: result.analysis,
          weekPlan: result.weekPlan,
          created_at: new Date(),
        });
        console.error(`Week plan saved to MongoDB with id: ${savedId}`);
      } catch (dbError) {
        const msg = dbError instanceof Error ? dbError.message : String(dbError);
        console.error(`Warning: could not save plan to MongoDB — ${msg}`);
      }

      const response = {
        ...result,
        ...(savedId ? { saved_id: savedId } : {}),
        ...(isAssessment ? { is_assessment: true } : {}),
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(response, null, 2) }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      console.error('Error in plan-next-week tool:', errorMessage);
      return {
        content: [{ type: 'text' as const, text: `❌ API Error: ${errorMessage}` }],
        isError: true,
      };
    }
  },
};
