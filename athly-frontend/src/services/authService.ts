import type { UserModel, AuthPayload, RegisterUserDto } from '@/client'
import { api } from './api'

export async function login(email: string, password: string): Promise<AuthPayload> {
  const data = await api.auth.authControllerLogin({
    loginDto: { email, password }
  })
  api.setToken(data.accessToken)
  return data
}

export async function register(data: RegisterUserDto): Promise<AuthPayload> {
  const result = await api.auth.authControllerRegister({
    registerUserDto: data
  })
  api.setToken(result.accessToken)
  return result
}

export async function getMe(): Promise<UserModel | null> {
  try {
    const user = await api.users.usersControllerMe()
    return user
  } catch (error) {
    console.error('Failed to get user:', error)
    return null
  }
}
