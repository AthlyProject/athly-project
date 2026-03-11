import type {
  UserModel,
  AuthPayload as GeneratedAuthPayload,
  WorkoutModel,
  WorkoutBlock as GeneratedWorkoutBlock,
  TrainingPlanModel as GeneratedTrainingPlanModel,
  WeeklyGoalModel as GeneratedWeeklyGoalModel,
  WorkoutFeedbackModel,
  IntegrationModel,
  UpdateProfileInput as GeneratedUpdateProfileInput,
  WorkoutModelSportTypeEnum,
  WorkoutModelStatusEnum,
  UpdateWorkoutInput as GeneratedUpdateWorkoutInput,
  WorkoutBlockInput as GeneratedWorkoutBlockInput,
} from '@/client'

// ========================================
// RE-EXPORTED MODELS FROM CLIENT
// ========================================

export type User = UserModel
export type AuthPayload = GeneratedAuthPayload
export type Workout = WorkoutModel
export type WorkoutBlock = GeneratedWorkoutBlock
export type WeeklyGoal = GeneratedWeeklyGoalModel
export type WorkoutFeedback = WorkoutFeedbackModel
export type Integration = IntegrationModel
export type UpdateProfileInput = GeneratedUpdateProfileInput
export type UpdateWorkoutInput = GeneratedUpdateWorkoutInput
export type WorkoutBlockInput = GeneratedWorkoutBlockInput
export type BackendTrainingPlan = GeneratedTrainingPlanModel

// ========================================
// FRONTEND SPECIFIC TYPES
// ========================================

export type SportType = WorkoutModelSportTypeEnum
export type WorkoutStatus = WorkoutModelStatusEnum

// WeeklyGoalStatus from backend might be specific, aliasing for now
export type WeeklyGoalStatus = 'PLANNED' | 'GENERATED' | 'CANCELLED' | 'LOCKED'

// Frontend assembled Training Plan (includes UI mapping)
export interface Week {
  number: number
  workouts: Workout[]
}

export interface TrainingPlan {
  id: string
  startDate: string
  weeks: Week[]
}

// Input types
export interface SubmitWorkoutFeedbackInput {
  completed: boolean
  effort: number
  fatigue: number
}
