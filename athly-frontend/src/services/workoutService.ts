import type { Workout, TrainingPlan, WeeklyGoal, WorkoutFeedback, UpdateWorkoutInput, SubmitWorkoutFeedbackInput } from '@/types'
import { api } from './api'

export async function getTodayWorkout(): Promise<Workout | null> {
  try {
    const workout = await api.getTodayWorkout()
    return workout
  } catch (error) {
    console.error('Failed to get today workout:', error)
    return null
  }
}

export async function getWorkoutById(id: string): Promise<Workout | null> {
  try {
    const workout = await api.getWorkout(id)
    return workout
  } catch (error) {
    console.error('Failed to get workout:', error)
    return null
  }
}

export async function getCurrentTrainingPlan(): Promise<TrainingPlan | null> {
  try {
    const plan = await api.getTrainingPlanMe()
    if (!plan) return null

    const [weeklyGoals, workouts] = await Promise.all([
      api.getWeeklyGoalsByPlan(plan.id),
      api.getWorkoutsByTrainingPlan(plan.id),
    ])

    // Group workouts by weeklyGoalId and build Week[]
    // Backend WeeklyGoal returns `id` in JSON; frontend type uses `uuid`
    const weeks = weeklyGoals.map((wg, index) => {
      const goalId = (wg as unknown as { id: string }).id ?? wg.uuid
      const weekWorkouts = workouts.filter((w) => w.weeklyGoalId === goalId)
      return {
        number: index + 1,
        workouts: weekWorkouts,
      }
    })

    // Also include workouts not linked to any weekly goal in the first week
    const linkedIds = new Set(workouts.filter((w) => w.weeklyGoalId).map((w) => w.weeklyGoalId))
    const unlinked = workouts.filter((w) => !linkedIds.has(w.weeklyGoalId))
    if (unlinked.length > 0) {
      if (weeks.length > 0) {
        weeks[0].workouts = [...weeks[0].workouts, ...unlinked]
      } else {
        weeks.push({ number: 1, workouts: unlinked })
      }
    }

    return {
      id: plan.id,
      startDate: plan.startDate,
      weeks,
    }
  } catch (error) {
    console.error('Failed to get training plan:', error)
    return null
  }
}

export async function getCalendarData(): Promise<{ weeklyGoals: WeeklyGoal[]; workouts: Workout[] } | null> {
  try {
    const plan = await api.getTrainingPlanMe()
    if (!plan) return null

    const [rawWeeklyGoals, workouts] = await Promise.all([
      api.getWeeklyGoalsByPlan(plan.id),
      api.getWorkoutsByTrainingPlan(plan.id),
    ])

    // Map backend `id` to frontend `uuid` field
    const weeklyGoals: WeeklyGoal[] = rawWeeklyGoals.map((wg) => {
      const raw = wg as unknown as { id: string; weekStartDate: string; weekEndDate: string }
      return {
        uuid: raw.id,
        trainingPlanId: plan.id,
        weekStartDate: raw.weekStartDate,
        weekEndDate: raw.weekEndDate,
        status: wg.status,
        metrics: wg.metrics,
      }
    })

    return { weeklyGoals, workouts }
  } catch (error) {
    console.error('Failed to get calendar data:', error)
    return null
  }
}

export async function submitWorkoutFeedback(
  workoutId: string,
  feedback: Omit<WorkoutFeedback, 'workoutId'>
): Promise<WorkoutFeedback> {
  const input: SubmitWorkoutFeedbackInput = {
    completed: feedback.completed,
    effort: feedback.effort,
    fatigue: feedback.fatigue,
  }
  const result = await api.submitWorkoutFeedback(workoutId, input)
  return result
}

export async function completeWorkout(workoutId: string): Promise<Workout> {
  const workout = await api.completeWorkout(workoutId)
  return workout
}

export async function skipWorkout(workoutId: string): Promise<Workout> {
  const workout = await api.skipWorkout(workoutId)
  return workout
}

export async function updateWorkout(
  workoutId: string,
  input: {
    title: string
    sportType: Workout['sportType']
    description?: string
    blocks: Workout['blocks']
  }
): Promise<Workout> {
  const updateInput: UpdateWorkoutInput = {
    title: input.title,
    sportType: input.sportType,
    description: input.description,
    blocks: input.blocks,
  }
  const workout = await api.updateWorkout(workoutId, updateInput)
  return workout
}
