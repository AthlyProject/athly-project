import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { handleStravaCallback } from '@/services/integrationService'

export function OAuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      toast.error('Autorização Strava cancelada.')
      navigate('/settings', { replace: true })
      return
    }

    if (!code) {
      toast.error('Código de autorização não encontrado.')
      navigate('/settings', { replace: true })
      return
    }

    handleStravaCallback(code)
      .then(() => {
        toast.success('Strava conectado com sucesso! Sincronizando atividades...')
        navigate('/settings', { replace: true })
      })
      .catch((err: Error) => {
        toast.error(err.message ?? 'Erro ao conectar Strava.')
        navigate('/settings', { replace: true })
      })
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
      <div className="text-center space-y-4">
        <div className="text-6xl animate-bounce">🏃</div>
        <p className="text-[var(--color-text-secondary)] text-lg">Conectando Strava...</p>
      </div>
    </div>
  )
}
