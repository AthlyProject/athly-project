import type { Integration } from '@/types'
import { api } from './api'

export async function getIntegrations(): Promise<Integration[]> {
  try {
    return await api.getIntegrations()
  } catch (error) {
    console.error('Failed to get integrations:', error)
    return []
  }
}

export async function connectIntegration(integrationId: string): Promise<Integration> {
  return api.connectIntegration(integrationId)
}

export async function disconnectIntegration(integrationId: string): Promise<Integration> {
  return api.disconnectIntegration(integrationId)
}

export async function initiateStravaOAuth(): Promise<void> {
  const { url } = await api.getStravaAuthUrl()
  window.location.href = url
}

export async function handleStravaCallback(code: string): Promise<Integration> {
  return api.handleStravaCallback(code)
}

export async function syncStrava(): Promise<{ synced: number }> {
  return api.syncStrava()
}

export async function disconnectStrava(): Promise<void> {
  return api.disconnectStrava()
}

export function isStravaConnected(integrations: Integration[]): boolean {
  return integrations.some((i) => i.type === 'strava' && i.connected)
}
