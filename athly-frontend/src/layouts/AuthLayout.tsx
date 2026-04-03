import type { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen bg-[var(--color-background-dark)]">
      {/* Background gradient effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full gradient-primary opacity-10 blur-3xl rounded-full" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full gradient-neon opacity-10 blur-3xl rounded-full" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 w-full h-full min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  )
}
