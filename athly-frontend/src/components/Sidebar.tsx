import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { BarChart3, CalendarDays, Calendar, TrendingUp, User, Settings, Check } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { GradientText } from "@/components/ui/GradientText";
import { Badge } from "@/components/ui/Badge";

const navItems: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/app/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/app/plan", label: "Plano", icon: CalendarDays },
  { to: "/app/training-plan", label: "Calendário", icon: Calendar },
  { to: "/app/history", label: "Histórico", icon: TrendingUp },
  { to: "/app/profile", label: "Perfil", icon: User },
  { to: "/app/settings", label: "Config", icon: Settings },
];

export function Sidebar() {
  const user = useAuthStore((s) => s.user);

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-white/[0.07] glass md:flex">
      {/* Logo Header */}
      <div className="relative flex h-16 items-center gap-3 border-b border-white/[0.07] px-6 overflow-hidden">
        <div className="absolute inset-0 gradient-primary opacity-5" />
        <img
          src="/src/assets/icons/main.png"
          alt="Athly"
          className="w-15 h-15"
        />
        <GradientText variant="neon">
          <span className="text-xl font-bold">Athly</span>
        </GradientText>
        <Badge variant="neon" size="sm" className="ml-auto">
          AI
        </Badge>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 p-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 ${
                isActive
                  ? "gradient-primary text-white shadow-[var(--shadow-neon)] scale-[1.02]"
                  : "text-[var(--color-text-secondary)] hover:bg-white/[0.06] hover:text-[var(--color-text-primary)] hover:scale-[1.02]"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={`h-5 w-5 transition-transform ${isActive ? "scale-110" : "group-hover:scale-110"}`}
                />
                {item.label}
                {isActive && (
                  <span className="ml-auto h-2 w-2 rounded-full bg-white animate-pulse" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Info */}
      {user && (
        <div className="relative border-t border-white/[0.07] p-4 overflow-hidden">
          <div className="absolute inset-0 gradient-card opacity-50" />
          <div className="relative flex items-center gap-3">
            <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center text-lg font-bold text-white glow-primary">
              {user.name?.charAt(0).toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                {user.name}
              </p>
              <p className="truncate text-xs text-[var(--color-text-tertiary)]">
                {user.email}
              </p>
            </div>
            <Badge variant="success" size="sm">
              <Check className="h-3 w-3" />
            </Badge>
          </div>
        </div>
      )}
    </aside>
  );
}
