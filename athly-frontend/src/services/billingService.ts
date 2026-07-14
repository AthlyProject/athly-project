import { api } from './api'

const BASE_URL = import.meta.env.VITE_BACKEND_API_URL

export interface EntitlementSnapshot {
  entitled: boolean
  isAdmin: boolean
  isFounderEligible?: boolean | null
  /** Fim do trial backend (ISO). Null se não aplicável (admin, assinante ou expirado). */
  trialEndsAt?: string | null
  /** Dias restantes do trial backend. Null se não aplicável. */
  trialDaysRemaining?: number | null
}

/**
 * Snapshot de entitlement do backend (mesma fonte usada pelo app iOS).
 * O client OpenAPI gerado ainda não expõe BillingApi, então usamos fetch direto.
 */
export async function getEntitlement(): Promise<EntitlementSnapshot | null> {
  const token = api.getToken()
  if (!token) return null

  try {
    const res = await fetch(`${BASE_URL}/billing/entitlement`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return (await res.json()) as EntitlementSnapshot
  } catch {
    return null
  }
}
