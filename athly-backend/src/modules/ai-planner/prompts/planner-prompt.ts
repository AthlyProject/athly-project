import type { AiPlannerInput, PreviousWeekAnalysis } from '../types/planner.types';
import type { FormattedZones } from '../../effort-zones/types/effort-zone.types';
import type { ParsedGoal } from './goal-parser-prompt';

export type { AiPlannerInput };

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
  return `<user_goal>\n${lines.join('\n')}\n</user_goal>`;
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
): string {
  const restDays = 7 - trainingDays;
  const daysList = formatAvailableDays(availableDays);
  const workoutTemplates = buildAssessmentWorkoutTemplates(trainingDays);

  const goalSection = goal ? buildGoalSection(goal) : '';
  const profileSection = userProfile ? buildUserProfileSection(userProfile) : '';

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

<assessment_workouts>
Estes são os treinos de avaliação que você deve distribuir nos ${trainingDays} dias de treino:
${workoutTemplates}

Distribua os treinos de forma inteligente ao longo da semana:
- Treinos DEVEM ser agendados APENAS nos seguintes dias: ${daysList}. Os demais dias são descanso obrigatório.
- Nunca coloque dois treinos intensos (RPE >= 7) em dias consecutivos.
- O treino de velocidade (intervalos) deve vir após pelo menos 1 dia de descanso ou treino fácil.
</assessment_workouts>

${REASONING_INSTRUCTION}

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
- blocks deve ser um array de objetos com: type ("warmup"|"main"|"cooldown"|"rest"), e quando aplicável: distanceKm, durationMinutes, targetPace, instructions.
- OBRIGATÓRIO para blocos "warmup": durationMinutes >= 8 OU distanceKm >= 1.0.
- OBRIGATÓRIO para blocos "main": durationMinutes >= 10 OU distanceKm >= 1.0.
- OBRIGATÓRIO para blocos "cooldown": durationMinutes >= 5 OU distanceKm >= 0.5.
- Para blocos "main" de intervalos: especifique no campo instructions o número de repetições, distância por repetição, RPE alvo e tempo de recuperação entre as repetições.
- Dias de descanso devem ter blocks: [{ "type": "rest", "instructions": "Dia de descanso completo. Sem corrida." }].
- Como não há dados históricos, NÃO prescreva paces específicos no campo targetPace. Use RPE e descrições de esforço nas instructions. Você PODE incluir faixas de pace estimadas como referência (ex: "algo em torno de 6:30-7:00/km se parecer RPE 4-5"), mas deixe claro que o atleta deve priorizar o esforço percebido.
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
      "blocks": [
        {
          "type": "<warmup|main|cooldown|rest>",
          "distanceKm": <número — opcional>,
          "durationMinutes": <número — opcional>,
          "targetPace": "<M:SS /km — opcional>",
          "instructions": "<instrução de treino em português>"
        }
      ]
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
  const profileSection = userProfile ? buildUserProfileSection(userProfile) : '';

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

${profileSection}

<athlete_data>
Corridas recentes analisadas (últimas ${runSummaries.length} corridas):
${JSON.stringify(runSummaries, null, 2)}

Estatísticas resumidas:
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

${previousWeekSection}

${REASONING_INSTRUCTION}

<constraints>
- Treinos DEVEM ser agendados APENAS nos seguintes dias: ${daysList}. Todos os outros dias = descanso obrigatório.
- Nunca aumente o volume semanal em mais de 10% acima da média recente do atleta.
- Sessões de intervalos devem incluir aquecimento de 10 min e volta à calma de 5 min (refletido nos blocks).
- Se dados de FC não estiverem disponíveis, prescreva o esforço por RPE no campo instructions.
- weekPlan deve conter EXATAMENTE 7 entradas, uma por dia de ${weekDates[0]} a ${weekDates[6]}.
- sportType deve ser exatamente um de: "running" | "walking" | "other". Use "running" para dias de treino, "other" para dias de descanso.
- intensity deve ser um número de 1 a 10. Descanso = 1, fácil = 3, moderado = 6, intenso = 9.
- trend deve ser exatamente um de: "improving (volume)" | "improving (intensity)" | "maintaining" | "declining".
- blocks deve ser um array de objetos com: type ("warmup"|"main"|"cooldown"|"rest"), e quando aplicável: distanceKm, durationMinutes, targetPace, instructions.
- OBRIGATÓRIO para blocos "main": durationMinutes >= 20 OU distanceKm >= 2.0. Nunca deixe blocos "main" vazios.
- Corridas longas: mínimo de 30 minutos no bloco "main".
- Corridas de recuperação/fácil: mínimo de 20 minutos no bloco "main".
- Sessões de intervalos: especifique no campo instructions o número de repetições, distância, pace alvo e tempo de descanso entre as repetições.
- Dias de descanso devem ter blocks: [{ "type": "rest", "instructions": "Dia de descanso completo. Sem corrida." }].
- Use as zonas de pace personalizadas acima para prescrever targetPace — NÃO invente paces arbitrários.
- analysis.title: short weekly goal title in Portuguese (2-4 words, e.g. "Semana de Base", "Progressão de Volume", "Deload"). Displayed in the calendar UI.
- analysis.fitnessInsights: 2-3 short sentences in Portuguese covering current fitness diagnosis and weekly focus. This field is displayed directly to the user — do NOT include coaching instructions, tone directives, or meta-text.
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
      "blocks": [
        {
          "type": "<warmup|main|cooldown|rest>",
          "distanceKm": <número — opcional>,
          "durationMinutes": <número — opcional>,
          "targetPace": "<M:SS /km — opcional>",
          "instructions": "<instrução específica de treino em português>"
        }
      ]
    }
  ]
}
</output_schema>`;
}
