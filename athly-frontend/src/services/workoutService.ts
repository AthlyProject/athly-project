import type { Workout, TrainingPlan, WeeklyGoal, WorkoutFeedback, UpdateWorkoutInput, SubmitWorkoutFeedbackInput } from '@/types'
import { api } from './api'

export async function getTodayWorkout(): Promise<Workout | null> {
  try {
    return await api.workouts.workoutsControllerTodayWorkout()
  } catch (error) {
    console.error('Failed to get today workout:', error)
    return null
  }
}

export async function getWorkoutById(id: string): Promise<Workout | null> {
  try {
    return await api.workouts.workoutsControllerWorkout({ id })
  } catch (error) {
    console.error('Failed to get workout:', error)
    return null
  }
}

export async function getCurrentTrainingPlan(): Promise<TrainingPlan | null> {
  try {
    const plan = await api.trainingPlans.trainingPlansControllerGetMyTrainingPlan()
    if (!plan) return null

    const [weeklyGoals, workouts] = await Promise.all([
      api.weeklyGoals.weeklyGoalsControllerGetWeeklyGoalsByTrainingPlan({ trainingPlanId: plan.id }),
      api.workouts.workoutsControllerWorkoutsByTrainingPlan({ trainingPlanId: plan.id }),
    ])

    // Group workouts by weeklyGoalId and build Week[]
    const weeks = weeklyGoals.map((wg, index) => {
      const weekWorkouts = workouts.filter((w) => w.weeklyGoalId === wg.id)
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
    const plan = await api.trainingPlans.trainingPlansControllerGetMyTrainingPlan()
    if (!plan) return null

    const [weeklyGoals, workouts] = await Promise.all([
      api.weeklyGoals.weeklyGoalsControllerGetWeeklyGoalsByTrainingPlan({ trainingPlanId: plan.id }),
      api.workouts.workoutsControllerWorkoutsByTrainingPlan({ trainingPlanId: plan.id }),
    ])

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
  return api.workouts.workoutsControllerSubmitWorkoutFeedback({
    workoutId,
    submitWorkoutFeedbackInput: input
  })
}

export async function completeWorkout(workoutId: string): Promise<Workout> {
  return api.workouts.workoutsControllerCompleteWorkout({ workoutId })
}

export async function skipWorkout(workoutId: string): Promise<Workout> {
  return api.workouts.workoutsControllerSkipWorkout({ workoutId })
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
  return api.workouts.workoutsControllerUpdateWorkout({
    workoutId,
    updateWorkoutInput: updateInput
  })
}

export async function planNextWeek(params?: { numberOfRuns?: number; weekStartDate?: string }) {
  return api.aiPlanner.aiPlannerControllerPlanNextWeek({
    planNextWeekInput: params ?? {}
  })
}
