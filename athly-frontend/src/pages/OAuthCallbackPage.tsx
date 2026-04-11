import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { handleStravaCallback } from '@/services/integrationService'
import { stravaLogin } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'

export function OAuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const called = useRef(false)
  const isAuth = useAuthStore((state) => state.isAuthenticated)
  const setSession = useAuthStore((state) => state.setSession)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      toast.error('Autorização Strava cancelada.')
      navigate(isAuth ? '/app/settings' : '/login', { replace: true })
      return
    }

    if (!code) {
      toast.error('Código de autorização não encontrado.')
      navigate(isAuth ? '/app/settings' : '/login', { replace: true })
      return
    }

    if (isAuth) {
      handleStravaCallback(code)
        .then(() => {
          toast.success('Strava conectado com sucesso! Sincronizando atividades...')
          navigate('/app/settings', { replace: true })
        })
        .catch((err: Error) => {
          toast.error(err.message ?? 'Erro ao conectar Strava.')
          navigate('/app/settings', { replace: true })
        })
    } else {
      stravaLogin(code)
        .then((payload) => {
          setSession({
            user: payload.user,
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken,
          })
          toast.success('Login com Strava realizado com sucesso!')
          navigate('/app/dashboard', { replace: true })
        })
        .catch((err: Error) => {
          toast.error(err.message ?? 'Erro ao fazer login com Strava.')
          navigate('/login', { replace: true })
        })
    }
  }, [searchParams, navigate, isAuth, setSession])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
      <div className="text-center space-y-4">
        <div className="text-6xl animate-bounce">🏃</div>
        <p className="text-[var(--color-text-secondary)] text-lg">
          {isAuth ? 'Conectando Strava...' : 'Fazendo login com Strava...'}
        </p>
      </div>
    </div>
  )
}
