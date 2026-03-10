/**
 * REST API Client for IAFit
 * Handles all HTTP requests to the backend
 */

import type {
  AuthPayload,
  User,
  Workout,
  BackendTrainingPlan,
  WeeklyGoal,
  WorkoutFeedback,
  Integration,
  UpdateProfileInput,
  UpdateWorkoutInput,
  SubmitWorkoutFeedbackInput,
} from '../types'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

class ApiClient {
  private accessToken: string | null = null

  setToken(token: string) {
    this.accessToken = token
  }

  clearToken() {
    this.accessToken = null
  }

  getToken() {
    return this.accessToken
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Merge any existing headers
    if (options.headers) {
      const existingHeaders = new Headers(options.headers)
      existingHeaders.forEach((value, key) => {
        headers[key] = value
      })
    }

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }))
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  // ===== AUTH =====
  async login(email: string, password: string): Promise<AuthPayload> {
    const data = await this.request<AuthPayload>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    this.setToken(data.accessToken)
    return data
  }

  // ===== USERS =====
  async getMe(): Promise<User> {
    return this.request<User>('/users/me')
  }

  async updateProfile(data: UpdateProfileInput): Promise<User> {
    return this.request<User>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // ===== WORKOUTS =====
  async getTodayWorkout(): Promise<Workout | null> {
    return this.request<Workout | null>('/workouts/today')
  }

  async getWorkout(id: string): Promise<Workout | null> {
    return this.request<Workout | null>(`/workouts/${id}`)
  }

  async getWorkoutHistory(): Promise<Workout[]> {
    return this.request<Workout[]>('/workouts/history')
  }

  async getTrainingPlanMe(): Promise<BackendTrainingPlan | null> {
    return this.request<BackendTrainingPlan | null>('/training-plans/me')
  }

  async getWeeklyGoalsByPlan(planId: string): Promise<WeeklyGoal[]> {
    return this.request<WeeklyGoal[]>(`/weekly-goals/training-plan/${planId}`)
  }

  async getWorkoutsByTrainingPlan(planId: string): Promise<Workout[]> {
    return this.request<Workout[]>(`/workouts/training-plan/${planId}`)
  }

  async updateWorkout(workoutId: string, data: UpdateWorkoutInput): Promise<Workout> {
    return this.request<Workout>(`/workouts/${workoutId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async submitWorkoutFeedback(
    workoutId: string,
    data: SubmitWorkoutFeedbackInput
  ): Promise<WorkoutFeedback> {
    return this.request<WorkoutFeedback>(`/workouts/${workoutId}/feedback`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async completeWorkout(workoutId: string): Promise<Workout> {
    return this.request<Workout>(`/workouts/${workoutId}/complete`, {
      method: 'PATCH',
    })
  }

  async skipWorkout(workoutId: string): Promise<Workout> {
    return this.request<Workout>(`/workouts/${workoutId}/skip`, {
      method: 'PATCH',
    })
  }

  // ===== INTEGRATIONS =====
  async getIntegrations(): Promise<Integration[]> {
    return this.request<Integration[]>('/integrations')
  }

  async connectIntegration(integrationId: string): Promise<Integration> {
    return this.request<Integration>(`/integrations/${integrationId}/connect`, {
      method: 'POST',
    })
  }

  async disconnectIntegration(integrationId: string): Promise<Integration> {
    return this.request<Integration>(`/integrations/${integrationId}/disconnect`, {
      method: 'DELETE',
    })
  }

  // ===== STRAVA OAUTH =====
  async getStravaAuthUrl(): Promise<{ url: string }> {
    return this.request<{ url: string }>('/integrations/strava/auth')
  }

  async handleStravaCallback(code: string): Promise<Integration> {
    return this.request<Integration>('/integrations/strava/callback', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  }

  async syncStrava(): Promise<{ synced: number }> {
    return this.request<{ synced: number }>('/integrations/strava/sync', {
      method: 'POST',
    })
  }

  async disconnectStrava(): Promise<void> {
    return this.request<void>('/integrations/strava/disconnect', {
      method: 'POST',
    })
  }

  // ===== AI PLANNER =====
  async planNextWeek(params?: { numberOfRuns?: number; weekStartDate?: string }) {
    return this.request('/ai-planner/plan-next-week', {
      method: 'POST',
      body: JSON.stringify(params ?? {}),
    })
  }
}

export const api = new ApiClient()
