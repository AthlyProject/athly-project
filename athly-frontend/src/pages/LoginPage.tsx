import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, Rocket, Sparkles, Dumbbell, BarChart3, Target } from "lucide-react";
import { Button, Card, GradientText, Badge, Divider } from "@/components/ui";
import { Input } from "@/components/ui/Input";
import { useAuthStore } from "@/store/authStore";
import { login, getStravaAuthUrl } from "@/services/authService";
import toast from "react-hot-toast";

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = await login(
        email || "alexandre@email.com",
        password || "1234",
      );
      setSession({
        user: payload.user,
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
      });
      navigate("/dashboard");
    } catch {
      toast.error("Falha no login. Verifique suas credenciais.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4">
      <div className="w-full">
        {/* Logo & Title */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-4 mb-6">
            <img
              src="/src/assets/icons/main.png"
              alt="Athly"
              className="w-24 h-24 animate-pulse-glow"
            />
            <GradientText variant="neon" animated>
              <h1 className="text-5xl font-bold">Athly</h1>
            </GradientText>
          </div>
          <p className="text-[var(--color-text-secondary)] text-lg">
            Seu personal trainer inteligente
          </p>
          <Badge variant="neon" className="mt-4">
            <Sparkles className="h-3.5 w-3.5 inline mr-1" />Powered by AI
          </Badge>
        </div>

        {/* Login Card */}
        <Card variant="glow" padding="lg" className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 gradient-primary opacity-10 blur-3xl rounded-full" />
          <div className="relative">
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">
              Entrar na conta
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                icon={<Mail className="h-4 w-4" />}
              />
              <Input
                label="Senha"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                icon={<Lock className="h-4 w-4" />}
              />

              <Divider spacing="sm" />

              <Button
                type="submit"
                variant="gradient"
                fullWidth
                size="lg"
                loading={loading}
                glow
              >
                <Rocket className="h-5 w-5 inline mr-2" />Entrar
              </Button>

              <Button
                type="button"
                variant="outline"
                fullWidth
                size="lg"
                onClick={async () => {
                  setLoading(true);
                  try {
                    const { url } = await getStravaAuthUrl();
                    window.location.href = url;
                  } catch {
                    setLoading(false);
                    toast.error("Erro ao redirecionar para o Strava.");
                  }
                }}
                disabled={loading}
                className="mt-4 border-[#fc4c02] text-[#fc4c02] hover:bg-[#fc4c02]/10"
              >
                <span className="mr-2 text-xl font-bold">strava</span>
                Continuar com Strava
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-[var(--color-text-tertiary)]">
              Não tem uma conta?{" "}
              <Link
                to="/register"
                className="text-[var(--color-primary)] hover:text-[var(--color-primary-400)] font-semibold transition-colors"
              >
                Criar conta
              </Link>
            </p>
          </div>
        </Card>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div>
            <Dumbbell className="h-6 w-6 mx-auto mb-1 text-[var(--color-text-tertiary)]" />
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Treinos IA
            </p>
          </div>
          <div>
            <BarChart3 className="h-6 w-6 mx-auto mb-1 text-[var(--color-text-tertiary)]" />
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Análises
            </p>
          </div>
          <div>
            <Target className="h-6 w-6 mx-auto mb-1 text-[var(--color-text-tertiary)]" />
            <p className="text-xs text-[var(--color-text-tertiary)]">Metas</p>
          </div>
        </div>
      </div>
    </div>
  );
}
