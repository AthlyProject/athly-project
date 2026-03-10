import type { Integration } from '@/types'
import { api } from './api'

export async function getIntegrations(): Promise<Integration[]> {
  try {
    return await api.integrations.integrationsControllerIntegrations()
  } catch (error) {
    console.error('Failed to get integrations:', error)
    return []
  }
}

export async function connectIntegration(integrationId: string): Promise<Integration> {
  return api.integrations.integrationsControllerConnectIntegration({ integrationId })
}

export async function disconnectIntegration(integrationId: string): Promise<Integration> {
  return api.integrations.integrationsControllerDisconnectIntegration({ integrationId })
}

export async function initiateStravaOAuth(): Promise<void> {
  const { url } = await api.integrations.integrationsControllerGetStravaAuthUrl()
  if (url) {
    window.location.href = url
  } else {
    throw new Error('Failed to get Strava auth URL')
  }
}

export async function handleStravaCallback(code: string): Promise<Integration> {
  return api.integrations.integrationsControllerHandleStravaCallback({
    stravaCallbackInput: { code }
  })
}

export async function syncStrava(): Promise<{ synced: number }> {
  const res = await api.integrations.integrationsControllerSyncStrava()
  return res as { synced: number }
}

export async function disconnectStrava(): Promise<void> {
  return api.integrations.integrationsControllerDisconnectStrava()
}

export function isStravaConnected(integrations: Integration[]): boolean {
  return integrations.some((i) => i.type === 'strava' && i.connected)
}
