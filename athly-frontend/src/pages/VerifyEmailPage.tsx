import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/services/api'
import { toast } from 'react-hot-toast'
import { CheckCircle2, ArrowRight } from 'lucide-react'

export function VerifyEmailPage() {
  const [otp, setOtp] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !user.email) return

    if (otp.length !== 6) {
      toast.error('O código OTP deve ter 6 dígitos.')
      return
    }

    try {
      setIsLoading(true)
      await api.auth.authControllerVerifyEmail({
        verifyEmailDto: {
          email: user.email,
          otp,
        },
      })
      
      // Update user state to reflect verification
      setUser({ ...user, isEmailVerified: true })
      toast.success('E-mail verificado com sucesso!')
      
      // Navigate back to dashboard
      navigate('/app/dashboard')
    } catch (error: any) {
      console.error(error)
      toast.error(error.response?.data?.message || 'Falha ao verificar e-mail. Verifique o código.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-[var(--color-surface-card)] p-8 shadow-[var(--shadow-neon)] border border-[var(--color-border-dark)] relative overflow-hidden backdrop-blur-xl">
        {/* Glow Effects */}
        <div className="absolute -top-32 -left-32 w-64 h-64 rounded-full bg-purple-500/10 blur-[64px] pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-64 h-64 rounded-full bg-blue-500/10 blur-[64px] pointer-events-none" />
        
        <div className="relative text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/10 mb-6">
            <CheckCircle2 className="h-8 w-8 text-purple-400" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Verifique seu e-mail
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Enviamos um código de 6 dígitos para <span className="font-semibold text-purple-400">{user?.email}</span>
          </p>
        </div>

        <form className="relative mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="otp" className="sr-only">
              Código OTP
            </label>
            <input
              id="otp"
              name="otp"
              type="text"
              required
              maxLength={6}
              className="block w-full rounded-xl border border-[var(--color-border-dark)] bg-black/20 px-4 py-4 text-center text-3xl tracking-widest text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || otp.length !== 6}
            className="group relative flex w-full justify-center rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-3 text-sm font-semibold text-white hover:from-purple-500 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:shadow-[0_0_25px_rgba(168,85,247,0.6)]"
          >
            {isLoading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Verificando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Verificar E-mail
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
