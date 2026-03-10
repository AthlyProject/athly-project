// ========================================
// TYPES - REST API
// ========================================

// Enums
export type SportType = 'running' | 'cycling' | 'swimming' | 'strength' | 'yoga' | 'crossfit' | 'walking' | 'other'
export type WorkoutStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'skipped' | 'partial'
export type WeeklyGoalStatus = 'PLANNED' | 'GENERATED' | 'CANCELLED' | 'LOCKED'
export type IntegrationType = 'strava' | 'garmin' | 'polar' | 'apple_health' | 'google_fit'

// User
export interface User {
  id: string
  name: string
  email: string
  goals?: string[]
  availability?: number | null
}

// Auth
export interface AuthPayload {
  user: User
  accessToken: string
  refreshToken: string
}

// Workout Block
export interface WorkoutBlock {
  type: string
  duration?: number
  distance?: number
  targetPace?: string
  instructions?: string
}

// Workout
export interface Workout {
  id: string
  date: string
  sportType: SportType
  title: string
  description?: string
  blocks: WorkoutBlock[]
  status: WorkoutStatus
  intensity?: number
  trainingPlanId?: string
  weeklyGoalId?: string
  stravaActivityId?: string | null
}

// Weekly Goal (backend: API exposes id as uuid)
export interface WeeklyGoal {
  uuid: string
  trainingPlanId: string
  weekStartDate: string
  weekEndDate: string
  status?: WeeklyGoalStatus
  metrics?: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

// Week
export interface Week {
  number: number
  workouts: Workout[]
}

// Backend Training Plan (as returned by API — no weeks)
export interface BackendTrainingPlan {
  id: string
  startDate: string
  objective?: string
  status?: string
}

// Training Plan (frontend assembled — includes weeks)
export interface TrainingPlan {
  id: string
  startDate: string
  weeks: Week[]
}

// Workout Feedback
export interface WorkoutFeedback {
  workoutId: string
  completed: boolean
  effort: number
  fatigue: number
}

// Integration
export interface Integration {
  id: string
  name: string
  icon: string
  connected: boolean
  type: IntegrationType
  stravaAthleteId?: string | null
}

// Input types
export interface UpdateProfileInput {
  name?: string
  email?: string
  goals?: string[]
  availability?: number
}

export interface UpdateWorkoutInput {
  title?: string
  description?: string
  blocks?: WorkoutBlock[]
  intensity?: number
  status?: WorkoutStatus
  sportType?: SportType
  date?: string
}

export interface SubmitWorkoutFeedbackInput {
  completed: boolean
  effort: number
  fatigue: number
}
