import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Button, Card, GradientText, Badge, Divider } from "@/components/ui";
import { Input } from "@/components/ui/Input";
import { useAuthStore } from "@/store/authStore";
import { register, getStravaAuthUrl } from "@/services/authService";
import toast from "react-hot-toast";

interface RegisterForm {
  name: string;
  userName: string;
  email: string;
  password: string;
  confirmPassword: string;
  dateOfBirth: string;
  weight: string;
  height: string;
}

interface FormErrors {
  [key: string]: string;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<RegisterForm>({
    name: "",
    userName: "",
    email: "",
    password: "",
    confirmPassword: "",
    dateOfBirth: "",
    weight: "",
    height: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});

  function updateField(field: keyof RegisterForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function validateStep1(): boolean {
    const newErrors: FormErrors = {};

    if (!form.name || form.name.length < 2) {
      newErrors.name = "Nome deve ter no mínimo 2 caracteres";
    }
    if (!form.userName || form.userName.length < 3) {
      newErrors.userName = "Username deve ter no mínimo 3 caracteres";
    } else if (!/^[a-zA-Z0-9_-]+$/.test(form.userName)) {
      newErrors.userName =
        "Username deve conter apenas letras, números, _ e -";
    }
    if (!form.email) {
      newErrors.email = "Email é obrigatório";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function validateStep2(): boolean {
    const newErrors: FormErrors = {};

    if (!form.password || form.password.length < 8) {
      newErrors.password = "Senha deve ter no mínimo 8 caracteres";
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) {
      newErrors.password =
        "Senha deve conter letras maiúsculas, minúsculas e números";
    }
    if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = "As senhas não coincidem";
    }
    if (!form.dateOfBirth) {
      newErrors.dateOfBirth = "Data de nascimento é obrigatória";
    }
    if (!form.weight || Number(form.weight) <= 0) {
      newErrors.weight = "Peso deve ser um número positivo";
    }
    if (!form.height || Number(form.height) <= 0) {
      newErrors.height = "Altura deve ser um número positivo";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleNext() {
    if (validateStep1()) {
      setStep(2);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep2()) return;

    setLoading(true);
    try {
      const payload = await register({
        name: form.name,
        userName: form.userName,
        email: form.email,
        password: form.password,
        confirmPassword: form.confirmPassword,
        dateOfBirth: form.dateOfBirth,
        weight: Number(form.weight),
        height: Number(form.height),
      });
      setSession({
        user: payload.user,
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
      });
      toast.success("Conta criada com sucesso!");
      navigate("/dashboard");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Falha ao criar conta.";
      toast.error(message);
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
            Crie sua conta e comece a treinar
          </p>
          <Badge variant="neon" className="mt-4">
            <Sparkles className="h-3.5 w-3.5 inline mr-1" />Powered by AI
          </Badge>
        </div>

        {/* Register Card */}
        <Card variant="glow" padding="lg" className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 gradient-primary opacity-10 blur-3xl rounded-full" />
          <div className="relative">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
                Criar conta
              </h2>
              <span className="text-sm text-[var(--color-text-tertiary)]">
                Passo {step} de 2
              </span>
            </div>

            {/* Step indicators */}
            <div className="flex gap-2 mb-6">
              <div
                className={`h-1 flex-1 rounded-full transition-colors ${
                  step >= 1
                    ? "bg-[var(--color-primary)]"
                    : "bg-[var(--color-border-dark)]"
                }`}
              />
              <div
                className={`h-1 flex-1 rounded-full transition-colors ${
                  step >= 2
                    ? "bg-[var(--color-primary)]"
                    : "bg-[var(--color-border-dark)]"
                }`}
              />
            </div>

            <form onSubmit={handleSubmit}>
              {step === 1 && (
                <div className="space-y-5">
                  <Input
                    label="Nome completo"
                    type="text"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="Seu nome"
                    error={errors.name}
                  />
                  <Input
                    label="Username"
                    type="text"
                    value={form.userName}
                    onChange={(e) => updateField("userName", e.target.value)}
                    placeholder="seu_username"
                    error={errors.userName}
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="seu@email.com"
                    error={errors.email}
                  />

                  <Divider spacing="sm" />

                  <Button
                    type="button"
                    variant="gradient"
                    fullWidth
                    size="lg"
                    glow
                    onClick={handleNext}
                  >
                    Continuar
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
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <Input
                    label="Senha"
                    type="password"
                    value={form.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    error={errors.password}
                  />
                  <Input
                    label="Confirmar senha"
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) =>
                      updateField("confirmPassword", e.target.value)
                    }
                    placeholder="Repita a senha"
                    error={errors.confirmPassword}
                  />
                  <Input
                    label="Data de nascimento"
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) =>
                      updateField("dateOfBirth", e.target.value)
                    }
                    error={errors.dateOfBirth}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Peso (kg)"
                      type="number"
                      value={form.weight}
                      onChange={(e) => updateField("weight", e.target.value)}
                      placeholder="70"
                      error={errors.weight}
                    />
                    <Input
                      label="Altura (cm)"
                      type="number"
                      value={form.height}
                      onChange={(e) => updateField("height", e.target.value)}
                      placeholder="175"
                      error={errors.height}
                    />
                  </div>

                  <Divider spacing="sm" />

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={() => setStep(1)}
                      className="flex-1"
                    >
                      Voltar
                    </Button>
                    <Button
                      type="submit"
                      variant="gradient"
                      size="lg"
                      loading={loading}
                      glow
                      className="flex-1"
                    >
                      Criar conta
                    </Button>
                  </div>
                </div>
              )}
            </form>

            <p className="mt-6 text-center text-sm text-[var(--color-text-tertiary)]">
              Já tem uma conta?{" "}
              <Link
                to="/login"
                className="text-[var(--color-primary)] hover:text-[var(--color-primary-400)] font-semibold transition-colors"
              >
                Entrar
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
