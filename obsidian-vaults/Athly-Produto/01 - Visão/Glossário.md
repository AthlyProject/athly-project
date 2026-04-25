---
tags: [tipo/glossario, contexto/produto]
status: done
created: 2026-04-24
---

# Glossário — Athly

## Termos Técnicos

### OAuth 2.0
Protocolo de autorização que permite ao usuário conectar sua conta Strava sem compartilhar senha. Strava gera um código de autorização que Athly usa para obter `accessToken` e `refreshToken`.

### Access Token
Token curto (válido ~6h) que autoriza Athly a ler atividades do Strava em nome do usuário.

### Refresh Token
Token permanente (até revogação) que permite Athly renovar o `accessToken` quando expirar.

### stravaActivityId
Identificador único da atividade no Strava. Armazenado em `Workout.stravaActivityId` (UNIQUE) para evitar duplicatas ao sincronizar.

### Cron
Agendador de tarefas no servidor. Sintaxe: `minute hour day_of_month month day_of_week`  
Exemplo: `0 6 * * 1` = toda segunda-feira, 6h da manhã

### Fetch / Sincronizar
Ato de puxar dados da API Strava para o banco Athly. Ocorre automaticamente (cron) ou manualmente (Settings).

### Histórico
Conjunto de atividades (workouts) dos últimos 30 dias no Strava.

---

## Termos de Produto

### Loop Fechado
Sequência automática: Conectar → Sincronizar → Gerar → Exibir → Repetir. Diferencial do Athly.

### Training Plan (Plano de Treino)
Conjunto de 7 workouts (seg-dom) gerado por IA baseado em histórico Strava + preferências.

### Workout (Treino)
Uma única sessão de exercício. Atributos: tipo (easy run, long run, strength), distância, duração, notas, modalidade (running, cycling, strength, etc.).

### Assessment Plan
Plano fallback (5 treinos genéricos) para usuários que não conectam Strava.

### Geração Automática
Cron executa regeneração do Training Plan toda segunda-feira (6h).

### Modal obrigatória (StravaAuthModal)
Popup que bloqueia acesso ao "Gerar Plano" até que usuário conecte Strava (ou escolha Assessment Plan).

### Badge
Ícone visual indicando origem do workout:
- 🟦 Strava (sincronizado de Strava)
- 🤖 IA (gerado por IA)
- ✏️ Manual (editado pelo usuário)

---

## Termos de Domínio (Esporte)

### Modalidades

| Nome Strava | Mapa em Athly |
| --- | --- |
| Run, TrailRun | running |
| Ride, VirtualRide | cycling |
| Swim | swimming |
| WeightTraining | strength |
| CrossFit | crossfit |
| Walk, Hike | walking |
| Yoga | yoga |
| Outros | other |

### Tipos de Treino

- **Easy Run:** Corrida leve, conversível, recuperação
- **Tempo Run:** Ritmo moderado, um pouco acima do lactato
- **Long Run:** Corrida longa, resistência aeróbia
- **Strength:** Musculação, corpo livre, core
- **Yoga/Stretch:** Flexibilidade, recuperação ativa
- **Rest:** Repouso, caminhada leve

### Métricas

- **Distância:** km
- **Duração:** minutos
- **Ritmo:** min/km
- **Cadência:** passos/min

---

## Termos de Onboarding

### PAR-Q
Questionário de avaliação de risco pré-exercício (7 perguntas de screening). Obrigatório antes de gerar plano.

### Availability
Dias da semana em que o usuário pode treinar (seg-dom). Usado pela IA para distribuir workouts.

### Goal
Objetivo do usuário. Exemplos: "correr 21.1km", "emagrecer 5kg", "melhorar performance", "saúde mental".

### Distance Target
Distância-alvo planejada: 5km, 10km, 21.1km (meia maratona), 42.2km (maratona).

### Time Frame
Prazo para atingir goal, em semanas (máx 24).

---

## Ambreviaturas

| Sigla | Significado |
| --- | --- |
| **MVP** | Minimum Viable Product |
| **IA** | Inteligência Artificial |
| **LLM** | Large Language Model (Claude, Gemini, etc.) |
| **API** | Application Programming Interface |
| **BD** | Banco de Dados |
| **ACL** | Activity Confirmation List (Strava) |
| **ADR** | Architecture Decision Record |
| **ORM** | Object-Relational Mapping (TypeORM, Prisma) |

---

**Relacionado:** [[Visão do Produto]], [[Loop do MVP]]
