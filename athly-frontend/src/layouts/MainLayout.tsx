import { Outlet, Link, useLocation } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { BottomNav } from '@/components/BottomNav'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { AlertCircle } from 'lucide-react'

export function MainLayout() {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  
  const showVerificationBanner = user && !user.isEmailVerified && location.pathname !== '/app/verify-email'

  return (
    <div className="min-h-screen flex flex-col">
      {/* Fixed ambient gradient — glass cards across all pages blur this */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" style={{ background: 'var(--color-background-dark)' }}>
        <div
          className="absolute -top-40 -left-40 w-[750px] h-[750px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.22) 0%, transparent 65%)' }}
        />
        <div
          className="absolute -bottom-40 -right-40 w-[650px] h-[650px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.18) 0%, transparent 65%)' }}
        />
        <div
          className="absolute top-1/2 left-1/2 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 60%)', transform: 'translate(-50%, -50%)' }}
        />
      </div>
      <Sidebar />
      <main className="flex-1 pb-20 md:pb-0 md:pl-64 flex flex-col">
        {showVerificationBanner && (
          <div className="bg-purple-900/40 border-b border-purple-500/30 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between mx-auto max-w-4xl gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-purple-400" />
                <p className="text-sm text-purple-100">
                  Por favor, confirme seu e-mail para ter acesso a todas as funcionalidades.
                </p>
              </div>
              <Link 
                to="/app/verify-email" 
                className="flex-none rounded-lg bg-purple-500/20 px-3.5 py-1.5 text-sm font-semibold text-purple-200 shadow-sm hover:bg-purple-500/30 ring-1 ring-inset ring-purple-500/50 transition-colors"
              >
                Verificar agora
              </Link>
            </div>
          </div>
        )}
        <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6 md:py-8 flex-1">
          <Outlet />
        </div>
      </main>
      <BottomNav />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--color-surface-card)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border-dark)',
            borderRadius: '1rem',
            boxShadow: 'var(--shadow-neon)',
          },
        }}
      />
    </div>
  )
}
