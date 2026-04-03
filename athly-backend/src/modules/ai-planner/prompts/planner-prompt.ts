import type { AiPlannerInput } from '../types/planner.types';

export type { AiPlannerInput };

const GOAL = {
  distanceKm: 5,
  targetTimeMin: 26,
  targetPace: '5:12/km',
} as const;

function classifyAthlete(avgPace: string): string {
  const match = avgPace.match(/^(\d+):(\d{2})/);
  if (!match) return 'unknown';
  const totalSec = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  if (totalSec > 345) return 'Iniciante (mais lento que 5:45/km) — priorizar volume e consistência';
  if (totalSec > 312) return 'Em evolução (5:13–5:44/km) — aumentar intensidade dos intervalos';
  return 'Meta ao alcance (≤ 5:12/km) — refinar o pace de corrida e estratégia de ritmo';
}

const EFFORT_ZONES = `
<effort_zones>
| RPE | Zona            | Descrição                                          | Uso típico                   |
|-----|-----------------|----------------------------------------------------|------------------------------|
| 2-3 | Recuperação     | Muito fácil, conversa completa sem dificuldade     | Aquecimento, volta à calma   |
| 4-5 | Aeróbico/Fácil  | Confortável, fala frases completas                 | Corridas de base             |
| 6   | Moderado        | Frases curtas, esforço perceptível                 | Corridas progressivas        |
| 7   | Limiar Lático   | Difícil, apenas frases curtíssimas                 | Intervalos de tempo/tempo    |
| 8-9 | Intenso         | Muito difícil, palavras isoladas                   | Intervalos de velocidade     |
| 10  | Máximo          | All-out, sem falar                                 | Sprints curtos apenas        |
</effort_zones>`;

/**
 * Prompt for athletes with no Strava running history.
 * Asks Gemini to generate assessment workouts spread across the week,
 * respecting the athlete's configured training days.
 */
export function buildAssessmentPrompt(weekDates: string[], trainingDays: number): string {
  const restDays = 7 - trainingDays;

  const workoutTemplates = buildAssessmentWorkoutTemplates(trainingDays);

  return `<role>
Você é um treinador de corrida experiente recebendo um novo atleta que ainda não tem histórico de corridas registrado no Strava.
Seu objetivo é criar ${trainingDays} treinos de avaliação distribuídos ao longo da próxima semana para medir com segurança o nível de condicionamento físico atual antes de prescrever um plano de treino personalizado.
Tom: acolhedor, encorajador e claro — este atleta está iniciando sua jornada.
</role>

<language>
OBRIGATÓRIO: escreva TODO o texto visível ao usuário em Português Brasileiro (pt-BR). Isso inclui: title, description, instructions de cada bloco, fitnessInsights e o campo period.
Mantenha em inglês apenas: keys do JSON, valores de enum (sportType, type, trend), formato de datas (YYYY-MM-DD) e formato de pace (M:SS/km).
</language>

<context>
O atleta não possui dados de corrida anteriores. Antes de criar um plano personalizado com o objetivo de correr 5 km em menos de 26 minutos, é necessário avaliar:
1. A base aeróbica (corrida em ritmo fácil)
2. O limiar lático (esforço de tempo)
3. O teto de velocidade (intervalos curtos)
4. A resistência muscular (corrida longa fácil)
5. A capacidade de recuperação (trote leve ou corrida-caminhada) — apenas se trainingDays >= 5

Os ${restDays} dias restantes da semana devem ser dias de descanso completo.
Semana a planejar: ${weekDates[0]} (Segunda) até ${weekDates[6]} (Domingo).
</context>

${EFFORT_ZONES}

<assessment_workouts>
Estes são os treinos de avaliação que você deve distribuir nos ${trainingDays} dias de treino:
${workoutTemplates}

Distribua os treinos de forma inteligente ao longo da semana:
- Nunca coloque dois treinos intensos (RPE >= 7) em dias consecutivos.
- Alterne sempre entre dias de treino e descanso quando possível.
- O treino de velocidade (intervalos) deve vir após pelo menos 1 dia de descanso ou treino fácil.
</assessment_workouts>

<constraints>
- Gere EXATAMENTE ${trainingDays} dias de treino e ${restDays} dias de descanso — 7 entradas no total.
- Mantenha todas as distâncias conservadoras (1–6 km) já que não há dados de linha de base.
- Use RPE (escala 1–10) para guia de esforço, pois não há histórico de frequência cardíaca.
- sportType deve ser exatamente um de: "running" | "walking" | "other". Use "running" para dias de treino, "other" para dias de descanso.
- intensity deve ser um número de 1 a 10. Descanso = 1, fácil = 3, moderado = 6, intenso = 8.
- trend deve ser "maintaining" (sem histórico para determinar).
- Defina runsAnalyzed como 0, period como "Sem dados", avgDistanceKm como 0, avgPace como "N/A", avgHeartRate como null, totalDistanceKm como 0.
- fitnessInsights deve explicar em português que nenhum dado foi encontrado e que essas sessões são a linha de base de avaliação.
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
    "runsAnalyzed": 0,
    "period": "Sem dados",
    "avgDistanceKm": 0,
    "avgPace": "N/A",
    "avgHeartRate": null,
    "totalDistanceKm": 0,
    "trend": "maintaining",
    "fitnessInsights": "<explicação em português de que nenhum dado Strava foi encontrado e que essas sessões são a linha de base de avaliação>"
  },
  "weekPlan": [
    {
      "date": "<YYYY-MM-DD>",
      "dayOfWeek": "<Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday>",
      "title": "<título do treino em português>",
      "description": "<descrição geral da sessão com meta de RPE em português>",
      "sportType": "<running|walking|other>",
      "intensity": <número 1-10>,
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
 * Prompt for athletes with running history from Strava.
 * Asks Gemini to generate a personalized 7-day plan based on recent data.
 */
export function buildPlannerPrompt(input: AiPlannerInput): string {
  const {
    runSummaries,
    avgDistKm,
    avgPace,
    avgHR,
    maxDistKm,
    totalDistKm,
    weekDates,
    trainingDays,
  } = input;
  const restDays = 7 - trainingDays;
  const athleteClass = classifyAthlete(avgPace);
  const hrCtx = avgHR ? `${avgHR} bpm` : 'não disponível — prescreva esforço por RPE (escala 1–10)';

  return `<role>
Você é um treinador de corrida experiente. O objetivo do seu atleta é correr ${GOAL.distanceKm}km em menos de ${GOAL.targetTimeMin} minutos (pace alvo: ${GOAL.targetPace}).
Tom: direto, motivador e orientado por dados — como um treinador de atletismo.
Classificação atual do atleta: ${athleteClass}.
</role>

<language>
OBRIGATÓRIO: escreva TODO o texto visível ao usuário em Português Brasileiro (pt-BR). Isso inclui: title, description, instructions de cada bloco e fitnessInsights.
Mantenha em inglês apenas: keys do JSON, valores de enum (sportType, type, trend), formato de datas (YYYY-MM-DD) e formato de pace (M:SS/km).
</language>

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
- Dias de treino disponíveis: ${trainingDays} dias (${restDays} dias de descanso)
</athlete_data>

<task>
1. Analise o nível de condicionamento físico, tendência de pace e padrões de treino do atleta.
2. Monte um plano equilibrado de 7 dias (${weekDates[0]} a ${weekDates[6]}) seguindo princípios de periodização em direção ao objetivo de sub-${GOAL.targetTimeMin}min nos ${GOAL.distanceKm}km.
3. Derive todas as distâncias e paces dos dados reais do atleta — nunca invente números.
4. Respeite ESTRITAMENTE a disponibilidade: inclua EXATAMENTE ${trainingDays} dias de treino e ${restDays} dias de descanso.
5. Retorne APENAS o objeto JSON descrito em <output_schema>. Sem markdown, sem prosa, sem keys extras.
</task>

${EFFORT_ZONES}

<reference_paces>
| Tipo de sessão     | Pace alvo    |
|--------------------|--------------|
| Intervalos (400m)  | 4:45–5:00/km |
| Tempo run          | 5:12–5:20/km |
| Corrida longa      | 6:00–6:30/km |
| Recuperação        | 6:30–7:00/km |
| Descanso           | —            |
</reference_paces>

<constraints>
- Nunca aumente o volume semanal em mais de 10% acima da média recente do atleta.
- Sessões de intervalos devem incluir aquecimento de 10 min e volta à calma de 5 min (refletido nos blocks).
- Se dados de FC não estiverem disponíveis, prescreva o esforço por RPE no campo instructions.
- Dias de descanso são inegociáveis — inclua EXATAMENTE ${restDays} dias de descanso completo.
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
</constraints>

<output_schema>
Retorne APENAS este JSON — sem markdown, sem texto extra:
{
  "analysis": {
    "runsAnalyzed": <número>,
    "period": "<data da primeira corrida> — <data da última corrida>",
    "avgDistanceKm": <número>,
    "avgPace": "<M:SS /km>",
    "avgHeartRate": <número | null>,
    "totalDistanceKm": <número>,
    "trend": "<improving (volume) | improving (intensity) | maintaining | declining>",
    "fitnessInsights": "<2–3 frases em português: diagnóstico atual do condicionamento, padrão-chave identificado e uma área de foco concreta para chegar ao sub-${GOAL.targetTimeMin}min>"
  },
  "weekPlan": [
    {
      "date": "<YYYY-MM-DD>",
      "dayOfWeek": "<Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday>",
      "title": "<título do treino em português>",
      "description": "<descrição geral da sessão com instrução específica de treino em português>",
      "sportType": "<running|walking|other>",
      "intensity": <número 1-10>,
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
