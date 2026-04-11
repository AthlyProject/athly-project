import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Home, CalendarDays, Calendar, TrendingUp, User } from "lucide-react";

const navItems: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/app/dashboard", label: "Home", icon: Home },
  { to: "/app/plan", label: "Plano", icon: CalendarDays },
  { to: "/app/training-plan", label: "Calendário", icon: Calendar },
  { to: "/app/history", label: "Histórico", icon: TrendingUp },
  { to: "/app/profile", label: "Perfil", icon: User },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-border-dark)] bg-[var(--color-surface-card)]/95 backdrop-blur-lg md:hidden">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-card opacity-30" />
        <div className="relative flex justify-around py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `group relative flex flex-col items-center gap-1 px-4 py-2.5 text-xs font-semibold transition-all duration-300 ${
                  isActive
                    ? "text-[var(--color-primary-neon)]"
                    : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-8 rounded-full gradient-primary animate-pulse-glow" />
                  )}

                  {/* Icon with glow effect */}
                  <item.icon
                    className={`h-6 w-6 transition-all ${
                      isActive
                        ? 'scale-110 drop-shadow-[0_0_8px_var(--color-primary-neon)]'
                        : 'group-hover:scale-110'
                    }`}
                  />

                  {/* Label */}
                  <span className={isActive ? 'text-gradient font-bold' : ''}>
                    {item.label}
                  </span>

                  {/* Active dot */}
                  {isActive && (
                    <div className="absolute -bottom-1 h-1 w-1 rounded-full bg-[var(--color-primary-neon)] animate-pulse" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
