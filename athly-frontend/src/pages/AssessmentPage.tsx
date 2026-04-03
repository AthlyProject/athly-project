import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, ChevronLeft, Sparkles, Check } from "lucide-react";
import { Button, Card, GradientText, Badge } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { submitAssessment, type AssessmentAnswers } from "@/services/assessmentService";
import toast from "react-hot-toast";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ToggleChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
        selected
          ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/30"
          : "border-[var(--color-border-dark)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-text-primary)]"
      }`}
    >
      {label}
    </button>
  );
}

function RadioGroup({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left text-sm transition-all duration-200 ${
            value === opt.value
              ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-text-primary)]"
              : "border-[var(--color-border-dark)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/50"
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
              value === opt.value
                ? "border-[var(--color-primary)] bg-[var(--color-primary)]"
                : "border-[var(--color-border-dark)]"
            }`}
          >
            {value === opt.value && (
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            )}
          </div>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
      {children}
    </h3>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
      {children}
    </p>
  );
}

// ─── Initial State ────────────────────────────────────────────────────────────

const INITIAL: AssessmentAnswers = {
  goals: { practicesRegularly: "", targetDistance: "", motivations: [] },
  activityHistory: {
    currentActivities: [],
    trainingPreparedBy: "",
    canRun3km: "",
    runningExperience: "",
  },
  trainingPlanning: { availableDays: [], startDate: "", hasTargetDate: "" },
  performanceHealth: {
    referenceDistance: "5 km",
    bestTime: "",
    sleepQuality: undefined,
    hasChronicPain: "",
  },
  parq: {},
  gender: "",
  termsAccepted: false,
};

const STEPS = [
  "Objetivos",
  "Atividades",
  "Planejamento",
  "Performance & Saúde",
  "PAR-Q",
  "Termos",
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AssessmentPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<AssessmentAnswers>(INITIAL);

  function patchGoals(patch: Partial<AssessmentAnswers["goals"]>) {
    setForm((p) => ({ ...p, goals: { ...p.goals, ...patch } }));
  }
  function patchActivity(patch: Partial<AssessmentAnswers["activityHistory"]>) {
    setForm((p) => ({ ...p, activityHistory: { ...p.activityHistory, ...patch } }));
  }
  function patchPlanning(patch: Partial<AssessmentAnswers["trainingPlanning"]>) {
    setForm((p) => ({ ...p, trainingPlanning: { ...p.trainingPlanning, ...patch } }));
  }
  function patchPerf(patch: Partial<AssessmentAnswers["performanceHealth"]>) {
    setForm((p) => ({ ...p, performanceHealth: { ...p.performanceHealth, ...patch } }));
  }
  function patchParq(patch: Partial<AssessmentAnswers["parq"]>) {
    setForm((p) => ({ ...p, parq: { ...p.parq, ...patch } }));
  }

  function toggleArray(arr: string[], val: string): string[] {
    return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
  }

  async function handleSubmit() {
    if (!form.termsAccepted) {
      toast.error("Você deve aceitar os termos para continuar.");
      return;
    }
    setLoading(true);
    try {
      await submitAssessment(form);
      // Update user in store so the gate lets them through
      if (user) {
        setUser({ ...user, assessmentCompleted: true });
      }
      toast.success("Questionário enviado! Bem-vindo(a) à Athly 🎉");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar questionário.");
    } finally {
      setLoading(false);
    }
  }

  // ── Step content ────────────────────────────────────────────────────────────

  const steps = [
    // 0 – Goals
    <div className="space-y-6" key="goals">
      <div>
        <SectionTitle>Você já pratica atividades físicas regularmente?</SectionTitle>
        <RadioGroup
          options={[
            { label: "Sim", value: "yes" },
            { label: "Ainda não", value: "no" },
          ]}
          value={form.goals.practicesRegularly ?? ""}
          onChange={(v) => patchGoals({ practicesRegularly: v })}
        />
      </div>
      <div>
        <SectionTitle>Para qual distância você quer treinar?</SectionTitle>
        <RadioGroup
          options={[
            { label: "5 km", value: "5k" },
            { label: "10 km", value: "10k" },
            { label: "Meia maratona (21.1 km)", value: "half" },
          ]}
          value={form.goals.targetDistance ?? ""}
          onChange={(v) => patchGoals({ targetDistance: v })}
        />
      </div>
      <div>
        <SectionTitle>Eu quero treinar para...</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Correr provas", value: "races" },
            { label: "Emagrecer", value: "weight_loss" },
            { label: "Melhorar saúde física", value: "physical_health" },
            { label: "Melhorar saúde mental", value: "mental_health" },
            { label: "Superar desafios pessoais", value: "challenges" },
            { label: "Outro motivo", value: "other" },
          ].map((opt) => (
            <ToggleChip
              key={opt.value}
              label={opt.label}
              selected={(form.goals.motivations ?? []).includes(opt.value)}
              onClick={() =>
                patchGoals({
                  motivations: toggleArray(form.goals.motivations ?? [], opt.value),
                })
              }
            />
          ))}
        </div>
      </div>
    </div>,

    // 1 – Activity History
    <div className="space-y-6" key="activity">
      <div>
        <SectionTitle>Atividades que você pratica atualmente</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {["Caminhada","Pilates","Yoga","Musculação","Corrida","Natação","Ciclismo","Esportes coletivos","Outras"].map((act) => (
            <ToggleChip
              key={act}
              label={act}
              selected={(form.activityHistory.currentActivities ?? []).includes(act)}
              onClick={() =>
                patchActivity({
                  currentActivities: toggleArray(
                    form.activityHistory.currentActivities ?? [],
                    act
                  ),
                })
              }
            />
          ))}
        </div>
      </div>
      <div>
        <SectionTitle>Quem prepara seus treinos de corrida atualmente?</SectionTitle>
        <RadioGroup
          options={[
            { label: "Ainda não treino corrida", value: "none" },
            { label: "Planilhas do ChatGPT", value: "chatgpt" },
            { label: "Outra assessoria de corrida", value: "other_coach" },
            { label: "Planilha pronta da internet", value: "online_plan" },
            { label: "App de corrida (Runna, Nike Run, etc.)", value: "app" },
            { label: "Nenhuma das opções acima", value: "none_above" },
          ]}
          value={form.activityHistory.trainingPreparedBy ?? ""}
          onChange={(v) => patchActivity({ trainingPreparedBy: v })}
        />
      </div>
      <div>
        <SectionTitle>Você consegue correr 3 km direto, sem caminhar?</SectionTitle>
        <RadioGroup
          options={[
            { label: "Sim", value: "yes" },
            { label: "Ainda não", value: "no" },
          ]}
          value={form.activityHistory.canRun3km ?? ""}
          onChange={(v) => patchActivity({ canRun3km: v })}
        />
      </div>
      <div>
        <SectionTitle>Há quanto tempo você começou a correr?</SectionTitle>
        <RadioGroup
          options={[
            { label: "Menos de 6 meses", value: "<6m" },
            { label: "6 a 12 meses", value: "6-12m" },
            { label: "1 a 3 anos", value: "1-3y" },
            { label: "Mais de 3 anos", value: ">3y" },
          ]}
          value={form.activityHistory.runningExperience ?? ""}
          onChange={(v) => patchActivity({ runningExperience: v })}
        />
      </div>
    </div>,

    // 2 – Planning
    <div className="space-y-6" key="planning">
      <div>
        <SectionTitle>Quais dias da semana você tem disponíveis para treinar?</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"].map((day) => (
            <ToggleChip
              key={day}
              label={day}
              selected={(form.trainingPlanning.availableDays ?? []).includes(day)}
              onClick={() =>
                patchPlanning({
                  availableDays: toggleArray(
                    form.trainingPlanning.availableDays ?? [],
                    day
                  ),
                })
              }
            />
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>Qual dia você vai começar a treinar?</FieldLabel>
        <input
          type="date"
          value={form.trainingPlanning.startDate ?? ""}
          onChange={(e) => patchPlanning({ startDate: e.target.value })}
          className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-dark)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
        />
      </div>
      <div>
        <SectionTitle>Você quer correr em alguma data específica?</SectionTitle>
        <RadioGroup
          options={[
            { label: "Sim", value: "yes" },
            { label: "Não", value: "no" },
          ]}
          value={form.trainingPlanning.hasTargetDate ?? ""}
          onChange={(v) => patchPlanning({ hasTargetDate: v })}
        />
        {form.trainingPlanning.hasTargetDate === "yes" && (
          <div className="mt-3">
            <FieldLabel>Qual data?</FieldLabel>
            <input
              type="date"
              value={form.trainingPlanning.targetDate ?? ""}
              onChange={(e) => patchPlanning({ targetDate: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-dark)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
            />
          </div>
        )}
      </div>
    </div>,

    // 3 – Performance & Health
    <div className="space-y-6" key="perf">
      <div>
        <SectionTitle>Calculando seus ritmos</SectionTitle>
        <FieldLabel>Escolha uma distância de referência:</FieldLabel>
        <RadioGroup
          options={[
            { label: "5 km", value: "5k" },
            { label: "10 km", value: "10k" },
          ]}
          value={form.performanceHealth.referenceDistance ?? "5k"}
          onChange={(v) => patchPerf({ referenceDistance: v })}
        />
        <div className="mt-4">
          <FieldLabel>Seu melhor tempo estimado (Hr:Min:Seg):</FieldLabel>
          <input
            type="text"
            placeholder="00:35:00"
            value={form.performanceHealth.bestTime ?? ""}
            onChange={(e) => patchPerf({ bestTime: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-dark)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          />
        </div>
      </div>
      <div>
        <SectionTitle>Qualidade do sono (0 a 10)</SectionTitle>
        <div className="flex gap-1 flex-wrap">
          {[0,1,2,3,4,5,6,7,8,9,10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => patchPerf({ sleepQuality: n })}
              className={`w-10 h-10 rounded-lg text-sm font-semibold transition-all ${
                form.performanceHealth.sleepQuality === n
                  ? "bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/30"
                  : "bg-[var(--color-surface)] border border-[var(--color-border-dark)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div>
        <SectionTitle>Você possui alguma dor crônica?</SectionTitle>
        <RadioGroup
          options={[
            { label: "Sim", value: "yes" },
            { label: "Não", value: "no" },
          ]}
          value={form.performanceHealth.hasChronicPain ?? ""}
          onChange={(v) => patchPerf({ hasChronicPain: v })}
        />
        {form.performanceHealth.hasChronicPain === "yes" && (
          <textarea
            placeholder="Descreva suas dores da melhor forma que conseguir..."
            value={form.performanceHealth.chronicPainDescription ?? ""}
            onChange={(e) => patchPerf({ chronicPainDescription: e.target.value })}
            rows={3}
            className="mt-3 w-full px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-dark)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors resize-none"
          />
        )}
      </div>
    </div>,

    // 4 – PAR-Q
    <div className="space-y-4" key="parq">
      <SectionTitle>Questionário de Prontidão (PAR-Q)</SectionTitle>
      <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
        Responda com honestidade. Estas perguntas são apenas para sua segurança.
      </p>
      {([
        { key: "heartCondition", label: "Algum médico já disse que você possui algum problema de coração e que só deveria realizar atividade física supervisionado por profissionais de saúde?" },
        { key: "chestPainDuringActivity", label: "Você sente dores no peito quando pratica atividade física?" },
        { key: "chestPainLastMonth", label: "No último mês, você sentiu dores no peito quando praticou atividade física?" },
        { key: "dizzinessOrLossOfConsciousness", label: "Você apresenta desequilíbrio devido à tontura e/ou perda de consciência?" },
        { key: "boneJointProblem", label: "Você possui algum problema ósseo ou articular que poderia ser piorado pela atividade física?" },
        { key: "takingBloodPressureMeds", label: "Você toma atualmente algum medicamento para pressão arterial e/ou problema de coração?" },
        { key: "otherReasonToAvoidExercise", label: "Sabe de alguma outra razão pela qual você não deve praticar atividade física?" },
      ] as { key: keyof AssessmentAnswers["parq"]; label: string }[]).map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-2 p-4 rounded-xl border border-[var(--color-border-dark)] bg-[var(--color-surface)]">
          <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">{label}</p>
          <div className="flex gap-3 mt-1">
            <button
              type="button"
              onClick={() => patchParq({ [key]: true })}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                form.parq[key] === true
                  ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white"
                  : "border-[var(--color-border-dark)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]"
              }`}
            >
              Sim
            </button>
            <button
              type="button"
              onClick={() => patchParq({ [key]: false })}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                form.parq[key] === false
                  ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white"
                  : "border-[var(--color-border-dark)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]"
              }`}
            >
              Não
            </button>
          </div>
        </div>
      ))}
    </div>,

    // 5 – Terms & gender
    <div className="space-y-6" key="terms">
      <div>
        <SectionTitle>Dados Complementares</SectionTitle>
        <FieldLabel>Gênero</FieldLabel>
        <RadioGroup
          options={[
            { label: "Masculino", value: "male" },
            { label: "Feminino", value: "female" },
            { label: "Não-binário", value: "nonbinary" },
            { label: "Prefiro não informar", value: "not_informed" },
          ]}
          value={form.gender ?? ""}
          onChange={(v) => setForm((p) => ({ ...p, gender: v }))}
        />
      </div>
      <div className="p-4 rounded-xl border border-[var(--color-border-dark)] bg-[var(--color-surface)]">
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
          Termo de Uso e Ciência
        </h4>
        <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">
          Estou ciente de que é recomendável conversar com um médico antes de iniciar um programa de treinamento.
          Assumo plena responsabilidade por qualquer atividade praticada. Os treinos propostos pela IA usarão como
          base as respostas deste formulário.
        </p>
      </div>
      <div>
        <FieldLabel>Ao prosseguir, você declara que leu e concorda com o Termo de Uso acima.</FieldLabel>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, termsAccepted: true }))}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left text-sm transition-all ${
              form.termsAccepted
                ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-text-primary)]"
                : "border-[var(--color-border-dark)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/50"
            }`}
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${form.termsAccepted ? "bg-[var(--color-primary)] border-[var(--color-primary)]" : "border-[var(--color-border-dark)]"}`}>
              {form.termsAccepted && <Check className="w-3 h-3 text-white" />}
            </div>
            Aceito os termos e quero começar a treinar
          </button>
          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, termsAccepted: false }))}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left text-sm transition-all ${
              !form.termsAccepted
                ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-text-primary)]"
                : "border-[var(--color-border-dark)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/50"
            }`}
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${!form.termsAccepted ? "bg-[var(--color-primary)] border-[var(--color-primary)]" : "border-[var(--color-border-dark)]"}`}>
              {!form.termsAccepted && <Check className="w-3 h-3 text-white" />}
            </div>
            Não aceito
          </button>
        </div>
      </div>
    </div>,
  ];

  const isLast = step === STEPS.length - 1;

  return (
    <div className="min-h-screen w-full flex items-start justify-center p-4 py-8 relative z-20">
      <div className="w-full min-w-[320px] max-w-3xl mx-auto flex-1">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img
              src="/src/assets/icons/main.png"
              alt="Athly"
              className="w-12 h-12"
            />
            <GradientText variant="neon" animated>
              <span className="text-3xl font-bold">Athly</span>
            </GradientText>
          </div>
          <p className="text-[var(--color-text-secondary)] text-base">
            Vamos personalizar sua experiência
          </p>
          <Badge variant="neon" className="mt-3">
            <Sparkles className="h-3.5 w-3.5 inline mr-1" />
            Questionário de Avaliação
          </Badge>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-[var(--color-text-tertiary)] mb-2">
            <span>{STEPS[step]}</span>
            <span>
              {step + 1} / {STEPS.length}
            </span>
          </div>
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i <= step
                    ? "bg-[var(--color-primary)]"
                    : "bg-[var(--color-border-dark)]"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <Card variant="glow" padding="lg" className="relative overflow-hidden w-full min-h-[400px]">
          <div className="absolute top-0 right-0 w-40 h-40 gradient-primary opacity-10 blur-3xl rounded-full pointer-events-none" />
          <div className="relative">{steps[step]}</div>
        </Card>

        {/* Navigation */}
        <div className="flex gap-3 mt-4">
          {step > 0 && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
          )}
          {!isLast ? (
            <Button
              variant="gradient"
              size="lg"
              glow
              onClick={() => setStep((s) => s + 1)}
              className="flex-1"
            >
              Continuar
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              variant="gradient"
              size="lg"
              glow
              loading={loading}
              onClick={handleSubmit}
              className="flex-1"
            >
              Finalizar
              <Sparkles className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
