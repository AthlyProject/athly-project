import type { AiPlannerInput, PreviousWeekAnalysis } from '../types/planner.types';
import type { FormattedZones } from '../../effort-zones/types/effort-zone.types';
import type { ParsedGoal } from './goal-parser-prompt';
import type { AnalyzedSession } from '../workout-execution-analyzer.service';

export type { AiPlannerInput };

export interface LongitudinalWeek {
  weekLabel: string;
  totalKm: number;
  avgPace: string;
  completionRate: number;
  avgEffort: number | null;
}

export interface UserProfileContext {
  sleepQuality?: number;
  hasChronicPain?: boolean;
  chronicPainDescription?: string;
  canRun3km?: string;
  runningExperience?: string;
  motivations?: string[];
  parqFlags?: string[];
}

const DAY_NAME_MAP: Record<string, string> = {
  monday: 'Segunda',
  tuesday: 'Terça',
  wednesday: 'Quarta',
  thursday: 'Quinta',
  friday: 'Sexta',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

function formatAvailableDays(availableDays: string[]): string {
  return availableDays.map((d) => DAY_NAME_MAP[d] || d).join(', ');
}

function buildPreviousWeekSection(analysis: PreviousWeekAnalysis): string {
  const completionPct = Math.round(analysis.completionRate * 100);
  const skippedList = analysis.skippedWorkouts.length > 0
    ? analysis.skippedWorkouts.join(', ')
    : 'nenhum';

  return `
<previous_week_review>
Resumo da semana anterior:
- Treinos completados: ${analysis.completedWorkouts}/${analysis.totalWorkouts} (${completionPct}%)
- Treinos pulados: ${skippedList}
- Esforço médio reportado: ${analysis.avgEffort !== null ? `${analysis.avgEffort}/10` : 'sem dados'}
- Fadiga média reportada: ${analysis.avgFatigue !== null ? `${analysis.avgFatigue}/10` : 'sem dados'}
- Volume total completado: ${analysis.totalDistanceKm} km
- Mudança de volume: ${analysis.volumeChange}
- ${analysis.adherenceNote}

Considere estes dados ao planejar a próxima semana:
- Se aderência foi baixa (< 70%), considere reduzir volume ou número de treinos intensos.
- Se fadiga foi alta (> 7/10), inclua mais dias de recuperação ou reduza intensidade.
- Se todos os treinos foram completados com esforço baixo (< 5/10), considere progredir intensidade ou volume.
- Se o atleta pulou treinos intensos, considere se a carga está adequada.
</previous_week_review>`;
}

function secondsToPace(secondsPerKm?: number): string {
  if (!secondsPerKm || secondsPerKm <= 0) return 'N/A';
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function buildRecentSessionsDetailSection(analyzedSessions: AnalyzedSession[]): string {
  if (analyzedSessions.length === 0) return '';

  const payload = analyzedSessions.map((a) => {
    const session = a.session;
    return {
      date: session.startDate.split('T')[0],
      totals: {
        distanceKm: Number((session.distanceMeters / 1000).toFixed(2)),
        durationMin: Math.round(session.durationSeconds / 60),
        avgPace: secondsToPace(session.averagePaceSecondsPerKm),
        avgHR: session.avgHR ?? null,
      },
      prescribed: a.prescribed
        ? {
            title: a.prescribed.title,
            date: a.prescribed.dateScheduled,
            main: a.prescribed.mainBlockDescription,
            expectedRepCount: a.prescribed.expectedRepCount ?? null,
            expectedRepDistanceKm: a.prescribed.expectedRepDistanceKm ?? null,
            targetPaceRange: a.prescribed.targetPaceRange
              ? `${secondsToPace(a.prescribed.targetPaceRange.minSecPerKm)}–${secondsToPace(
                  a.prescribed.targetPaceRange.maxSecPerKm,
                )}/km`
              : null,
          }
        : null,
      segments: session.segments.map((s) => ({
        label: s.label,
        index: s.index ?? null,
        distKm: Number(s.distanceKm.toFixed(2)),
        durationSec: Math.round(s.durationSeconds),
        pace: secondsToPace(s.avgPaceSecondsPerKm),
        avgHR: s.avgHR ?? null,
        peakHR: s.peakHR ?? null,
        endHR: s.endHR ?? null,
      })),
      executionAnalysis: a.executionAnalysis,
      feedback: a.feedback ?? null,
    };
  });

  return `
<recentSessionsDetail>
Sessões recentes com análise mastigada (use como leitura direta, não recalcule estatísticas):
${JSON.stringify(payload, null, 2)}

Leia o campo "executionAnalysis" de cada sessão como veredito pronto. Use "observations" para citar padrões concretos no "reasoning" dos próximos treinos (ex: se "fade", reduza intensidade OU reforce pacing; se "undershot", suba o estímulo; se recuperação cardíaca baixa, dê mais recovery entre reps).
</recentSessionsDetail>`;
}

function buildLongitudinalTrendSection(weeks: LongitudinalWeek[]): string {
  if (weeks.length === 0) return '';
  return `
<longitudinalTrend>
Tendência das últimas ${weeks.length} semanas (agregado já calculado no backend):
${JSON.stringify(weeks, null, 2)}

Use esse bloco para detectar stagnation, overreaching e progressão sustentável. Regras:
- Volume subiu > 10% por 3 semanas seguidas com pace estagnado → sinal de overreach, considere deload.
- Volume caiu > 15% e aderência > 80% → atleta pode absorver progressão na próxima semana.
- Pace melhorou > 5s/km sobre 4 semanas → progressão natural, mantenha estímulo.
</longitudinalTrend>`;
}

function buildGoalSection(goal: ParsedGoal): string {
  const lines = [`Objetivo do atleta: ${goal.summary}`];
  if (goal.targetDistance) lines.push(`- Distância alvo: ${goal.targetDistance}`);
  if (goal.targetTime) lines.push(`- Tempo alvo: ${goal.targetTime}`);
  if (goal.eventDate) lines.push(`- Data do evento: ${goal.eventDate}`);
  if (goal.eventName) lines.push(`- Evento: ${goal.eventName}`);
  if (goal.experienceLevel) {
    const levelMap: Record<string, string> = {
      beginner: 'Iniciante',
      intermediate: 'Intermediário',
      advanced: 'Avançado',
    };
    lines.push(`- Nível inferido: ${levelMap[goal.experienceLevel] ?? goal.experienceLevel}`);
  }
  if (!goal.eventDate && goal.targetDistance && goal.targetTime) {
    lines.push(`- Sem data programada: avalie se o atleta tem condicionamento para tentar nesta semana (ver <goal_attempt_logic>).`);
  }
  return `<user_goal>\n${lines.join('\n')}\n</user_goal>`;
}

/**
 * Active only when the goal has distance + time but no programmed eventDate.
 * The AI evaluates feasibility from the data already in the prompt and may
 * mark exactly one day as the goal-attempt session.
 */
function buildGoalAttemptLogicSection(goal: ParsedGoal | null | undefined): string {
  if (!goal || goal.eventDate || !goal.targetDistance || !goal.targetTime) return '';
  return `
<goal_attempt_logic>
O objetivo do atleta NÃO tem data programada. Avalie se ele tem condicionamento para tentar bater o objetivo NESTA semana usando:
- Pace recente vs. pace alvo do objetivo (do summary/targetTime)
- Tendência das últimas 4 semanas (longitudinalTrend)
- Aderência da semana anterior
- Zonas de esforço (VDOT)

REGRA DE FEASIBILITY: marque feasibility=true APENAS se TODAS as condições forem verdadeiras:
1. Pace recente do atleta em distâncias similares está dentro de ~3% do pace alvo.
2. Aderência recente >= 70%.
3. Sem sinais de overreach (fadiga média > 7/10 ou volume subindo > 10% por 3 semanas seguidas com pace estagnado).

SE feasibility=true: escolha UM dia da semana para ser o "treino-alvo" (a tentativa do objetivo). Esse dia deve:
1. Ter "isGoalAttempt": true no JSON.
2. Ter o título no formato "Tentativa: <objetivo>" (ex: "Tentativa: 5km < 25min").
3. Ter blocos de aquecimento (10–15 min), main = a tentativa em si com targetPace = pace alvo, e cooldown (5–10 min).
4. Vir após 1 dia de descanso OU treino muito leve (RPE <= 4).
5. NÃO ter sessão intensa (RPE >= 7) no dia anterior.
6. O dia seguinte deve ser descanso ou recuperação leve.
7. O reasoning deve explicitar por que esta semana é viável (citar números: pace recente, pace alvo, aderência).

SE feasibility=false: NÃO marque isGoalAttempt em nenhum dia. Continue periodizando normalmente, evoluindo o atleta em direção ao objetivo. O reasoning do dia mais "duro" da semana deve mencionar brevemente por que ainda não é o momento da tentativa (ex: "pace recente 5:30/km ainda longe do alvo 5:00/km — semana focada em volume").

NUNCA marque mais de UM dia com isGoalAttempt=true por semana.
</goal_attempt_logic>`;
}

function buildUserProfileSection(profile: UserProfileContext): string {
  const lines: string[] = [];

  if (profile.sleepQuality !== undefined) {
    lines.push(`- Qualidade do sono: ${profile.sleepQuality}/10`);
  }
  if (profile.hasChronicPain) {
    lines.push(`- Dor crônica: sim${profile.chronicPainDescription ? ` (${profile.chronicPainDescription})` : ''}`);
  }
  if (profile.canRun3km) {
    lines.push(`- Consegue correr 3km sem parar: ${profile.canRun3km === 'yes' ? 'sim' : 'ainda não'}`);
  }
  if (profile.runningExperience) {
    const expMap: Record<string, string> = {
      '<6m': 'menos de 6 meses',
      '6-12m': '6 a 12 meses',
      '1-3y': '1 a 3 anos',
      '>3y': 'mais de 3 anos',
    };
    lines.push(`- Experiência de corrida: ${expMap[profile.runningExperience] ?? profile.runningExperience}`);
  }
  if (profile.motivations?.length) {
    lines.push(`- Motivações: ${profile.motivations.join(', ')}`);
  }
  if (profile.parqFlags?.length) {
    lines.push(`\nALERTA DE SAÚDE (PAR-Q): O atleta reportou as seguintes condições:`);
    for (const flag of profile.parqFlags) {
      lines.push(`  ⚠️ ${flag}`);
    }
    lines.push(`Prescreva treinos CONSERVADORES e inclua advertências de segurança nas instruções.`);
  }

  if (lines.length === 0) return '';
  return `<user_profile>\n${lines.join('\n')}\n</user_profile>`;
}

const REASONING_INSTRUCTION = `
<reasoning_requirement>
Para CADA dia de treino (não descanso), inclua um campo "reasoning" no JSON explicando:
1. POR QUE este tipo de treino foi escolhido para este dia específico
2. QUAIS dados do atleta embasaram a decisão (pace atual, volume, tendência, VDOT, feedback da semana anterior)
3. COMO este treino contribui para o objetivo do atleta
O reasoning deve ser técnico e específico, não genérico. Mínimo 2 frases.
Dias de descanso NÃO precisam de reasoning.
</reasoning_requirement>`;

const SEGMENT_SCHEMA_DOCS = `
<segment_schema>
Cada treino é uma árvore de "segments" — formato estruturado e legível por máquina que o app usa para anunciar transições em tempo real (vibração, bipe e voz). Esqueça texto livre descrevendo séries e tiros; a estrutura abaixo é a fonte da verdade.

Cada nó da árvore segue este shape:
{
  "id": "<slug único curto, ex: 'wu', 'work-1', 'rec-1'>",
  "kind": "<warmup | work | recovery | cooldown | rest | set>",
  "label": "<texto curto em pt-BR exibido no app, ex: '400m forte'>",
  "end": { "by": "<distanceM | durationSec | reps>", "value": <número> },
  "target": { ... },         // opcional, ver targets por esporte
  "repetitions": <int >= 1>, // obrigatório APENAS quando kind = "set"
  "children": [<segment>, ...] // obrigatório APENAS quando kind = "set"
}

Regras absolutas:
- kind = "set" deve ter "repetitions" >= 1 e "children" >= 1; NÃO inclui "end".
- kind != "set" DEVE ter "end" e NÃO pode ter "children".
- Profundidade máxima da árvore = 2 (sem set dentro de set).
- "rest" é usado para dias inteiros de descanso (treino com um único segmento rest grande), enquanto "recovery" é a pausa entre repetições dentro do treino.

Targets por esporte (campo "target" do segmento) — preencha apenas o que fizer sentido:
- running: { "paceSecPerKmMin": <int>, "paceSecPerKmMax": <int>, "hrZone": 1..5, "rpe": 1..10 }
- cycling: { "powerWattsMin": <int>, "powerWattsMax": <int>, "cadenceRpm": <int>, "hrZone": 1..5 }
- swimming: { "strokeType": "freestyle|backstroke|breaststroke|butterfly|medley|kick|drill", "poolLengthM": 25|50, "targetSecPer100m": <int> }
- strength: { "exercise": "<nome em pt-BR>", "reps": <int>, "loadKg": <number>, "loadPctOf1RM": <0-150>, "tempoSec": "<3-1-1-0>", "restAfterSec": <int> }

Estrutura mínima esperada em um treino de corrida: um warmup + um ou mais work (eventualmente envolvidos em set) + um cooldown. Dias de descanso têm UM ÚNICO segmento { "kind": "rest", "end": {...} }.
</segment_schema>`;

const SEGMENT_RECIPES = `
<segment_recipes>
Receitas canônicas — adapte distâncias, paces e durações aos dados do atleta. Estas são templates de SHAPE, não valores fixos.

(1) Intervalado clássico 6×400m com 90s de recuperação:
"segments": [
  { "id": "wu", "kind": "warmup", "label": "Aquecimento", "end": { "by": "durationSec", "value": 600 }, "target": { "rpe": 3 } },
  { "id": "set-main", "kind": "set", "label": "6×400m", "repetitions": 6, "children": [
    { "id": "work", "kind": "work", "label": "400m forte", "end": { "by": "distanceM", "value": 400 }, "target": { "paceSecPerKmMin": 280, "paceSecPerKmMax": 295 } },
    { "id": "rec", "kind": "recovery", "label": "Recuperação", "end": { "by": "durationSec", "value": 90 }, "target": { "rpe": 3 } }
  ] },
  { "id": "cd", "kind": "cooldown", "label": "Volta à calma", "end": { "by": "durationSec", "value": 300 }, "target": { "rpe": 2 } }
]

(2) Tempo run 20min em limiar:
"segments": [
  { "id": "wu", "kind": "warmup", "label": "Aquecimento", "end": { "by": "durationSec", "value": 600 }, "target": { "rpe": 3 } },
  { "id": "tempo", "kind": "work", "label": "Tempo run", "end": { "by": "durationSec", "value": 1200 }, "target": { "paceSecPerKmMin": 330, "paceSecPerKmMax": 345, "rpe": 7 } },
  { "id": "cd", "kind": "cooldown", "label": "Volta à calma", "end": { "by": "durationSec", "value": 300 }, "target": { "rpe": 2 } }
]

(3) Longão fácil 12 km:
"segments": [
  { "id": "wu", "kind": "warmup", "label": "Início suave", "end": { "by": "durationSec", "value": 300 }, "target": { "rpe": 2 } },
  { "id": "main", "kind": "work", "label": "Corrida fácil", "end": { "by": "distanceM", "value": 12000 }, "target": { "paceSecPerKmMin": 390, "paceSecPerKmMax": 420, "rpe": 4 } },
  { "id": "cd", "kind": "cooldown", "label": "Volta à calma", "end": { "by": "durationSec", "value": 180 }, "target": { "rpe": 2 } }
]

(4) Pirâmide 400-800-1200-800-400 (filhos heterogêneos — NÃO use "set"):
"segments": [
  { "id": "wu", "kind": "warmup", "end": { "by": "durationSec", "value": 600 }, "target": { "rpe": 3 } },
  { "id": "w-400-1", "kind": "work", "label": "400m forte", "end": { "by": "distanceM", "value": 400 }, "target": { "paceSecPerKmMin": 280 } },
  { "id": "r-1", "kind": "recovery", "end": { "by": "durationSec", "value": 120 }, "target": { "rpe": 3 } },
  { "id": "w-800-1", "kind": "work", "label": "800m forte", "end": { "by": "distanceM", "value": 800 }, "target": { "paceSecPerKmMin": 295 } },
  { "id": "r-2", "kind": "recovery", "end": { "by": "durationSec", "value": 180 }, "target": { "rpe": 3 } },
  { "id": "w-1200", "kind": "work", "label": "1200m forte", "end": { "by": "distanceM", "value": 1200 }, "target": { "paceSecPerKmMin": 310 } },
  { "id": "r-3", "kind": "recovery", "end": { "by": "durationSec", "value": 180 }, "target": { "rpe": 3 } },
  { "id": "w-800-2", "kind": "work", "label": "800m forte", "end": { "by": "distanceM", "value": 800 }, "target": { "paceSecPerKmMin": 295 } },
  { "id": "r-4", "kind": "recovery", "end": { "by": "durationSec", "value": 120 }, "target": { "rpe": 3 } },
  { "id": "w-400-2", "kind": "work", "label": "400m forte", "end": { "by": "distanceM", "value": 400 }, "target": { "paceSecPerKmMin": 280 } },
  { "id": "cd", "kind": "cooldown", "end": { "by": "durationSec", "value": 300 }, "target": { "rpe": 2 } }
]

(5) Dia de descanso:
"segments": [
  { "id": "rest", "kind": "rest", "label": "Descanso completo", "end": { "by": "durationSec", "value": 0 } }
]
</segment_recipes>`;

const SEGMENT_CONSTRAINTS_PLANNER = `
- segments é OBRIGATÓRIO em todo treino — é a fonte da verdade que o tracker do app lê para tocar bipes/vibração/voz nas transições.
- Toda sessão de corrida deve começar com 1 segmento "warmup" e terminar com 1 segmento "cooldown". O meio pode ser "work", "set" (com filhos work+recovery) ou misto.
- OBRIGATÓRIO para warmup: end.value >= 480 (8 min) quando by=durationSec OU >= 1000 (1 km) quando by=distanceM.
- OBRIGATÓRIO para cooldown: end.value >= 300 (5 min) OU >= 500 (500 m).
- Bloco principal (work ou set) na corrida deve ter pelo menos 20 min OU 2 km no acumulado.
- Em sessões de intervalo: ENVOLVA as repetições em um nó "set" com repetitions correto e children = [work, recovery]. NÃO descreva o intervalo em texto.
- Dias de descanso: exatamente um segmento { "kind": "rest", "end": { "by": "durationSec", "value": 0 } }. sportType = "other".
- Use as zonas de pace personalizadas para preencher target.paceSecPerKmMin/Max (converta M:SS para segundos: 5:00 → 300, 4:50 → 290). NÃO invente paces.`;

const SEGMENT_CONSTRAINTS_ASSESSMENT = `
- segments é OBRIGATÓRIO em todo treino — é a fonte da verdade que o tracker do app lê para tocar bipes/vibração/voz nas transições.
- Toda sessão de corrida deve começar com 1 segmento "warmup" e terminar com 1 segmento "cooldown".
- OBRIGATÓRIO para warmup: end.value >= 480 (8 min) ou >= 1000 (1 km).
- OBRIGATÓRIO para cooldown: end.value >= 300 (5 min) ou >= 500 (500 m).
- Como NÃO há histórico, NÃO preencha target.paceSecPerKmMin/Max. Use apenas target.rpe (1–10) e mencione referência de pace em "label" ou no description do dia.
- Em sessões de intervalo: ENVOLVA as repetições em um nó "set". NÃO descreva o intervalo em texto.
- Dias de descanso: exatamente um segmento { "kind": "rest", "end": { "by": "durationSec", "value": 0 } }. sportType = "other".`;

const SEGMENT_OUTPUT_FIELD = `      "segments": [
        {
          "id": "<slug>",
          "kind": "<warmup|work|recovery|cooldown|rest|set>",
          "label": "<texto curto em pt-BR>",
          "end": { "by": "<distanceM|durationSec|reps>", "value": <número> },
          "target": { /* campos opcionais por esporte; ver <segment_schema> */ },
          "repetitions": <int — apenas quando kind=set>,
          "children": [ /* segments — apenas quando kind=set */ ]
        }
      ]`;

/**
 * Prompt for athletes with no running history.
 * Generates assessment workouts on the specified available days.
 */
export function buildAssessmentPrompt(
  weekDates: string[],
  trainingDays: number,
  availableDays: string[],
  effortZones: FormattedZones,
  goal?: ParsedGoal | null,
  userProfile?: UserProfileContext | null,
  analyzedSessions?: AnalyzedSession[],
): string {
  const restDays = 7 - trainingDays;
  const daysList = formatAvailableDays(availableDays);
  const workoutTemplates = buildAssessmentWorkoutTemplates(trainingDays);

  const goalSection = goal ? buildGoalSection(goal) : '';
  const profileSection = userProfile ? buildUserProfileSection(userProfile) : '';
  const detailedSessionsSection = analyzedSessions && analyzedSessions.length > 0
    ? buildRecentSessionsDetailSection(analyzedSessions)
    : '';

  const goalSummary = goal?.summary ?? 'começar a correr';

  return `<role>
Você é um treinador de corrida experiente recebendo um novo atleta que ainda não tem histórico de corridas registrado.
Seu objetivo é criar ${trainingDays} treinos de avaliação distribuídos ao longo da próxima semana para medir com segurança o nível de condicionamento físico atual antes de prescrever um plano de treino personalizado.
O objetivo declarado do atleta é: ${goalSummary}.
Tom: acolhedor, encorajador e claro — este atleta está iniciando sua jornada.
</role>

<language>
OBRIGATÓRIO: escreva TODO o texto visível ao usuário em Português Brasileiro (pt-BR). Isso inclui: title, description, instructions de cada bloco, fitnessInsights, reasoning e o campo period.
Mantenha em inglês apenas: keys do JSON, valores de enum (sportType, type, trend), formato de datas (YYYY-MM-DD) e formato de pace (M:SS/km).
</language>

${goalSection}

${profileSection}

<context>
O atleta não possui dados de corrida anteriores. Antes de criar um plano personalizado, é necessário avaliar:
1. A base aeróbica (corrida em ritmo fácil)
2. O limiar lático (esforço de tempo)
3. O teto de velocidade (intervalos curtos)
4. A resistência muscular (corrida longa fácil)
5. A capacidade de recuperação (trote leve ou corrida-caminhada) — apenas se trainingDays >= 5

Os ${restDays} dias restantes da semana devem ser dias de descanso completo.
Semana a planejar: ${weekDates[0]} (Segunda) até ${weekDates[6]} (Domingo).
Dias de treino do atleta: ${daysList}
</context>

${effortZones.formatted}

${detailedSessionsSection}

<assessment_workouts>
Estes são os treinos de avaliação que você deve distribuir nos ${trainingDays} dias de treino:
${workoutTemplates}

Distribua os treinos de forma inteligente ao longo da semana:
- Treinos DEVEM ser agendados APENAS nos seguintes dias: ${daysList}. Os demais dias são descanso obrigatório.
- Nunca coloque dois treinos intensos (RPE >= 7) em dias consecutivos.
- O treino de velocidade (intervalos) deve vir após pelo menos 1 dia de descanso ou treino fácil.
</assessment_workouts>

${REASONING_INSTRUCTION}

${SEGMENT_SCHEMA_DOCS}

${SEGMENT_RECIPES}

<constraints>
- Gere EXATAMENTE 7 entradas no total: ${trainingDays} dias de treino e ${restDays} dias de descanso.
- Treinos SOMENTE nos dias: ${daysList}. Todos os outros dias = descanso.
- Mantenha todas as distâncias conservadoras (1–6 km) já que não há dados de linha de base.
- Use RPE (escala 1–10) para guia de esforço, pois não há histórico de frequência cardíaca.
- sportType deve ser exatamente um de: "running" | "walking" | "other". Use "running" para dias de treino, "other" para dias de descanso.
- intensity deve ser um número de 1 a 10. Descanso = 1, fácil = 3, moderado = 6, intenso = 8.
- trend deve ser "maintaining" (sem histórico para determinar).
- Set runsAnalyzed to 0, period to "Sem dados", avgDistanceKm to 0, avgPace to "N/A", avgHeartRate to null, totalDistanceKm to 0.
- analysis.title: short weekly goal title in Portuguese (2-4 words, e.g. "Avaliação Inicial", "Semana de Base"). Displayed in the calendar UI.
- fitnessInsights: maximum 2 short sentences in Portuguese explaining that no previous data exists and these sessions will assess current fitness. This field is displayed directly to the user — do NOT include coaching instructions, tone directives, or meta-text.
${SEGMENT_CONSTRAINTS_ASSESSMENT}
</constraints>

<output_schema>
Retorne APENAS este JSON — sem markdown, sem texto extra:
{
  "analysis": {
    "title": "<short weekly goal title in Portuguese, 2-4 words, e.g. 'Avaliação Inicial'>",
    "runsAnalyzed": 0,
    "period": "Sem dados",
    "avgDistanceKm": 0,
    "avgPace": "N/A",
    "avgHeartRate": null,
    "totalDistanceKm": 0,
    "trend": "maintaining",
    "fitnessInsights": "<2 short sentences in Portuguese explaining no data was found and these sessions establish the fitness baseline. No coaching instructions.>"
  },
  "weekPlan": [
    {
      "date": "<YYYY-MM-DD>",
      "dayOfWeek": "<Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday>",
      "title": "<título do treino em português>",
      "description": "<descrição geral da sessão com meta de RPE em português>",
      "sportType": "<running|walking|other>",
      "intensity": <número 1-10>,
      "reasoning": "<justificativa técnica em português — obrigatório para dias de treino, omitir para descanso>",
${SEGMENT_OUTPUT_FIELD}
    }
  ]
}
</output_schema>`;
}

function buildAssessmentWorkoutTemplates(trainingDays: number): string {
  const templates = [
    `1. Teste de Base Aeróbica (fácil):
   - Aquecimento: 8 min caminhada/trote suave (RPE 2-3)
   - Principal: 20-25 min corrida fácil (RPE 4-5, ritmo conversacional — consiga falar frases completas)
   - Volta à calma: 5 min caminhada (RPE 2)
   - Objetivo: estabelecer o pace de base fácil do atleta. Sem pressão de velocidade.`,

    `2. Teste de Limiar Lático (tempo):
   - Aquecimento: 10 min trote fácil (RPE 3-4)
   - Principal: 15 min em ritmo "difícil mas sustentável" (RPE 7 — consiga dizer apenas frases curtíssimas)
   - Volta à calma: 5 min caminhada (RPE 2)
   - Objetivo: estimar o pace de limiar lático. Instrua o atleta a manter o mesmo ritmo durante todo o bloco principal.`,

    `3. Avaliação de Velocidade (intervalos):
   - Aquecimento: 10 min trote fácil (RPE 3)
   - Principal: 6 repetições de 400m (RPE 8-9 — muito difícil, palavras isoladas), com 90 segundos de caminhada de recuperação entre cada repetição
   - Volta à calma: 5 min caminhada (RPE 2)
   - Objetivo: medir o teto de velocidade e a capacidade de recuperação. Instrua o atleta a correr cada repetição no máximo esforço sustentável.`,

    `4. Teste de Resistência (progressivo):
   - Aquecimento: 8 min trote fácil (RPE 3)
   - Principal: 30-35 min corrida iniciando em RPE 4, progredindo para RPE 6 nos últimos 10 min
   - Volta à calma: 5 min caminhada (RPE 2)
   - Objetivo: avaliar resistência muscular e capacidade de manter o ritmo. O atleta deve sentir os últimos 10 min como "moderadamente difícil".`,

    `5. Recuperação e Técnica (strides):
   - Aquecimento: 8 min trote muito leve (RPE 2-3)
   - Principal: 20 min trote fácil (RPE 3) com 4 acelerações de 20 segundos (strides a RPE 7) no final, com 60 segundos de caminhada entre cada uma
   - Volta à calma: 5 min caminhada (RPE 2)
   - Objetivo: avaliar a forma de corrida sob fadiga leve e confirmar a capacidade de recuperação.`,
  ];

  return templates.slice(0, trainingDays).join('\n\n');
}

/**
 * Prompt for athletes with running history.
 * Generates a personalized 7-day plan based on recent data, effort zones, and previous week analysis.
 */
export function buildPlannerPrompt(
  input: AiPlannerInput,
  effortZones: FormattedZones,
  previousWeekAnalysis?: PreviousWeekAnalysis | null,
  goal?: ParsedGoal | null,
  userProfile?: UserProfileContext | null,
  analyzedSessions?: AnalyzedSession[],
  longitudinalWeeks?: LongitudinalWeek[],
): string {
  const {
    runSummaries,
    avgDistKm,
    avgPace,
    avgHR,
    maxDistKm,
    totalDistKm,
    weekDates,
    trainingDays,
    availableDays,
  } = input;
  const restDays = 7 - trainingDays;
  const hrCtx = avgHR ? `${avgHR} bpm` : 'não disponível — prescreva esforço por RPE (escala 1–10)';
  const daysList = formatAvailableDays(availableDays);

  const previousWeekSection = previousWeekAnalysis
    ? buildPreviousWeekSection(previousWeekAnalysis)
    : '';

  const goalSection = goal ? buildGoalSection(goal) : '';
  const goalAttemptSection = buildGoalAttemptLogicSection(goal);
  const profileSection = userProfile ? buildUserProfileSection(userProfile) : '';
  const detailedSessionsSection = analyzedSessions && analyzedSessions.length > 0
    ? buildRecentSessionsDetailSection(analyzedSessions)
    : '';
  const longitudinalSection = longitudinalWeeks && longitudinalWeeks.length > 0
    ? buildLongitudinalTrendSection(longitudinalWeeks)
    : '';

  const goalSummary = goal?.summary ?? 'evoluir como corredor';

  return `<role>
Você é um treinador de corrida experiente. Crie um plano de treino personalizado baseado nos dados reais do atleta.
Tom: direto, motivador e orientado por dados — como um treinador de atletismo.
Objetivo do atleta: ${goalSummary}.
</role>

<language>
OBRIGATÓRIO: escreva TODO o texto visível ao usuário em Português Brasileiro (pt-BR). Isso inclui: title, description, instructions de cada bloco, fitnessInsights e reasoning.
Mantenha em inglês apenas: keys do JSON, valores de enum (sportType, type, trend), formato de datas (YYYY-MM-DD) e formato de pace (M:SS/km).
</language>

${goalSection}

${goalAttemptSection}

${profileSection}

<athlete_data>
Estatísticas resumidas (calculadas a partir de ${runSummaries.length} corridas recentes; sessões individuais detalhadas em <recentSessionsDetail>):
- Distância média: ${avgDistKm.toFixed(2)} km
- Pace médio: ${avgPace}
- Frequência cardíaca média: ${hrCtx}
- Maior corrida recente: ${maxDistKm.toFixed(2)} km
- Distância total analisada: ${totalDistKm.toFixed(2)} km
- Semana a planejar: ${weekDates[0]} (Segunda) até ${weekDates[6]} (Domingo)
- Dias de treino do atleta: ${daysList} (${trainingDays} dias de treino, ${restDays} de descanso)
</athlete_data>

<task>
1. Analise o nível de condicionamento físico, tendência de pace e padrões de treino do atleta.
2. Monte um plano equilibrado de 7 dias (${weekDates[0]} a ${weekDates[6]}) seguindo princípios de periodização e alinhado ao objetivo declarado.
3. Derive todas as distâncias e paces dos dados reais do atleta e das zonas personalizadas abaixo.
4. Respeite ESTRITAMENTE a disponibilidade: treinos SOMENTE nos dias ${daysList}. Os demais dias são descanso obrigatório.
5. Retorne APENAS o objeto JSON descrito em <output_schema>. Sem markdown, sem prosa, sem keys extras.
</task>

${effortZones.formatted}

${detailedSessionsSection}

${longitudinalSection}

${previousWeekSection}

${REASONING_INSTRUCTION}

${SEGMENT_SCHEMA_DOCS}

${SEGMENT_RECIPES}

<constraints>
- Treinos DEVEM ser agendados APENAS nos seguintes dias: ${daysList}. Todos os outros dias = descanso obrigatório.
- Nunca aumente o volume semanal em mais de 10% acima da média recente do atleta.
- Sessões de intervalos devem incluir warmup de pelo menos 10 min e cooldown de pelo menos 5 min.
- Se dados de FC não estiverem disponíveis, use target.rpe (1–10) em vez de target.hrZone.
- weekPlan deve conter EXATAMENTE 7 entradas, uma por dia de ${weekDates[0]} a ${weekDates[6]}.
- sportType deve ser exatamente um de: "running" | "walking" | "other". Use "running" para dias de treino, "other" para dias de descanso.
- intensity deve ser um número de 1 a 10. Descanso = 1, fácil = 3, moderado = 6, intenso = 9.
- trend deve ser exatamente um de: "improving (volume)" | "improving (intensity)" | "maintaining" | "declining".
- analysis.title: short weekly goal title in Portuguese (2-4 words, e.g. "Semana de Base", "Progressão de Volume", "Deload"). Displayed in the calendar UI.
- analysis.fitnessInsights: 2-3 short sentences in Portuguese covering current fitness diagnosis and weekly focus. This field is displayed directly to the user — do NOT include coaching instructions, tone directives, or meta-text.
- isGoalAttempt: opcional, default false. Marque true em NO MÁXIMO 1 dia da semana e somente quando feasibility for verdadeira segundo <goal_attempt_logic>. Se houver tentativa, respeite as regras de periodização ao redor (1 dia leve antes, recuperação depois, sem sessão intensa adjacente).
- Corridas longas: nó "work" principal com end.by="distanceM" e value de pelo menos a distância prescrita; OU end.by="durationSec" com pelo menos 1800 (30 min).
- Corridas de recuperação/fácil: nó "work" principal com pelo menos 1200s (20 min) ou >= 4000m.
${SEGMENT_CONSTRAINTS_PLANNER}
</constraints>

<output_schema>
Retorne APENAS este JSON — sem markdown, sem texto extra:
{
  "analysis": {
    "title": "<short weekly goal title in Portuguese, 2-4 words, e.g. 'Semana de Base', 'Progressão de Volume', 'Deload'>",
    "runsAnalyzed": <número>,
    "period": "<data da primeira corrida> — <data da última corrida>",
    "avgDistanceKm": <número>,
    "avgPace": "<M:SS /km>",
    "avgHeartRate": <número | null>,
    "totalDistanceKm": <número>,
    "trend": "<improving (volume) | improving (intensity) | maintaining | declining>",
    "fitnessInsights": "<2-3 short sentences in Portuguese: current fitness diagnosis and weekly focus. No coaching instructions.>"
  },
  "weekPlan": [
    {
      "date": "<YYYY-MM-DD>",
      "dayOfWeek": "<Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday>",
      "title": "<título do treino em português>",
      "description": "<descrição geral da sessão com instrução específica de treino em português>",
      "sportType": "<running|walking|other>",
      "intensity": <número 1-10>,
      "reasoning": "<justificativa técnica em português — obrigatório para dias de treino, omitir para descanso>",
      "isGoalAttempt": <boolean — opcional, true APENAS no dia da tentativa de objetivo (ver <goal_attempt_logic>)>,
${SEGMENT_OUTPUT_FIELD}
    }
  ]
}
</output_schema>`;
}
