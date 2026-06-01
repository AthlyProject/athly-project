import type {
  UserModel,
  AuthPayload as GeneratedAuthPayload,
  WorkoutModel,
  WorkoutBlock as GeneratedWorkoutBlock,
  TrainingPlanModel as GeneratedTrainingPlanModel,
  WeeklyGoalModel as GeneratedWeeklyGoalModel,
  WorkoutFeedbackModel,
  UpdateProfileDto as GeneratedUpdateProfileDto,
  WorkoutModelSportTypeEnum,
  WorkoutModelStatusEnum,
  UpdateWorkoutDto as GeneratedUpdateWorkoutDto,
  WorkoutBlockDto as GeneratedWorkoutBlockDto,
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
export type UpdateProfileInput = GeneratedUpdateProfileDto
export type UpdateWorkoutInput = GeneratedUpdateWorkoutDto
export type WorkoutBlockInput = GeneratedWorkoutBlockDto
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
