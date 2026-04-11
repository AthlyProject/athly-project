export interface ParsedGoal {
  isRunningRelated: boolean;
  targetDistance: string | null;
  targetTime: string | null;
  eventDate: string | null;
  eventName: string | null;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced' | null;
  summary: string;
  rejectionReason: string | null;
}

export function buildGoalParserPrompt(goalText: string): string {
  return `<role>
Você é um assistente especializado em interpretar objetivos de corrida. Sua função é analisar o texto livre do usuário e extrair informações estruturadas sobre o objetivo.
</role>

<task>
Analise o texto do objetivo abaixo e retorne um JSON estruturado com as informações extraídas.

IMPORTANTE: O Athly é um aplicativo focado EXCLUSIVAMENTE em corrida (running). Se o objetivo não for relacionado a corrida, retorne isRunningRelated: false e explique o motivo em rejectionReason.

Objetivos válidos incluem:
- Completar uma corrida (5k, 10k, meia maratona, maratona, trail, etc.)
- Melhorar pace/tempo em corridas
- Correr sem parar por uma determinada distância ou tempo
- Começar a correr
- Preparar para uma prova de corrida
- Perder peso através da corrida (ok se corrida for o meio)

Objetivos INVÁLIDOS (fora do escopo de corrida):
- Objetivos puramente de academia/musculação (sem corrida)
- Natação, ciclismo, yoga, pilates (sem corrida)
- Objetivos sem qualquer relação com corrida

Objetivo do usuário: "${goalText}"
</task>

<output_schema>
Retorne APENAS este JSON — sem markdown, sem texto extra:
{
  "isRunningRelated": <true|false>,
  "targetDistance": "<5k|10k|21k|42k|outro — null se não mencionado>",
  "targetTime": "<HH:MM:SS — null se não mencionado>",
  "eventDate": "<YYYY-MM-DD — null se não mencionado>",
  "eventName": "<nome do evento/prova — null se não mencionado>",
  "experienceLevel": "<beginner|intermediate|advanced|null>",
  "summary": "<resumo claro e objetivo do goal em português, ex: 'Correr 10km em menos de 50 minutos'>",
  "rejectionReason": "<motivo em português se isRunningRelated=false, ex: 'O Athly é focado em corrida. Natação não é suportada no momento.' — null se válido>"
}
</output_schema>`;
}
