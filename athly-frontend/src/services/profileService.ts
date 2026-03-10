import type { User, UpdateProfileInput } from '@/types'
import { api } from './api'

export async function getProfile(): Promise<User> {
  return api.users.usersControllerMe()
}

export async function updateProfile(data: Partial<User>): Promise<User> {
  const input: UpdateProfileInput = {
    name: data.name,
    email: data.email,
    goals: data.goals,
    availability: data.availability ?? undefined,
  }
  return api.users.usersControllerUpdateProfile({
    updateProfileInput: input
  })
}
