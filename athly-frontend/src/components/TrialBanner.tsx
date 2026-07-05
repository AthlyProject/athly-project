import { useEffect, useState } from 'react'
import { getEntitlement } from '@/services/billingService'

/**
 * Banner discreto com os dias restantes do trial backend (14 dias a partir do cadastro).
 * Some sozinho quando o backend devolve trialDaysRemaining = null
 * (paywall desligado, admin, assinante ativo ou trial expirado).
 */
export function TrialBanner() {
  const [days, setDays] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    getEntitlement().then((snapshot) => {
      if (cancelled) return
      const remaining = snapshot?.trialDaysRemaining
      if (typeof remaining === 'number' && remaining > 0) {
        setDays(remaining)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (days === null) return null

  return (
    <div
      className="mb-4 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm"
      style={{
        borderColor: 'rgba(6,182,212,0.35)',
        background: 'rgba(6,182,212,0.10)',
        color: 'var(--color-text-primary)',
      }}
      role="status"
    >
      <span aria-hidden>⏳</span>
      <span>
        {days === 1
          ? 'Último dia do seu período de teste gratuito'
          : `Período de teste gratuito: ${days} dias restantes`}
      </span>
    </div>
  )
}
