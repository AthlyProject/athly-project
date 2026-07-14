import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { BottomNav } from '@/components/BottomNav'
import { TrialBanner } from '@/components/TrialBanner'
import { Toaster } from 'react-hot-toast'

export function MainLayout() {
  return (
    <div className="min-h-screen">
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
      <main className="pb-20 md:pb-0 md:pl-64">
        <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
          <TrialBanner />
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
