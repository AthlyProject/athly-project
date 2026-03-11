import type { Workout } from '@/types'
import { api } from './api'

export async function getWorkoutHistory(): Promise<Workout[]> {
  try {
    return await api.workouts.workoutsControllerWorkoutHistory()
  } catch (error) {
    console.error('Failed to get workout history:', error)
    return []
  }
}
