---
tags: [camada/cross, tipo/documento]
camada: cross
tipo: documento
status: implementado
created: 2026-04-24
---

# Fluxos Cross-cutting

End-to-end use cases que envolvem múltiplas camadas.

## 1. Login & Autenticação

[[Auth Flow (backend + frontend + iOS)]]

**Resumo:**
1. Frontend/iOS: POST `/auth/login` (email + password)
2. Backend: valida, hash bcrypt, gera JWT access (1h) + refresh
3. Backend: cria Session (refresh token)
4. Frontend: salva JWT em localStorage
5. iOS: salva em Keychain
6. Requests posteriores: Bearer token no header
7. 401 → refresh automático via Session table

## 2. Integração Strava

[[Strava Flow (backend + frontend)]]

**Resumo:**
1. Frontend: redirect OAuth → Strava (scopes: activities:read, profile:read)
2. Strava: callback com `code`
3. Frontend: POST `/integrations/strava/connect` (code)
4. Backend: troca code por access token + refresh
5. Backend: salva em Integration table
6. Backend: fetch últimas atividades via 24 Strava Tools
7. Mapeia atividades (Run→running, Ride→cycling, etc.)
8. Armazena em Workout table (opcional sincronismo)

Ver: [[strava|Módulo Strava]]

## 3. AI Planner (Gerar Plano Semanal)

[[AI Planner Flow (backend + frontend + iOS)]]

**Resumo:**
1. Frontend/iOS: POST `/ai-planner/plan-next-week`
2. Backend AiPlannerService orquestra:
   - Fetch UserGoal (distance, time, event)
   - Fetch Assessment (effort zones, experienceLevel)
   - Fetch Strava runs passadas (StravaService)
   - Fetch UserEffortZone (zonas custom)
   - Análise semana anterior
3. Mount prompt v3.0 (goal + assessment + runs + zones)
4. Gemini 2.5-flash: retorna JSON com 7 Workouts
5. Backend: parse + valida
6. Backend: persist WeeklyGoal, 7 Workouts, AiReasoning, AiPlannerPromptLog
7. Frontend/iOS: exibe plano na tela Plan

Ver: [[AiPlannerService]], [[Planner Prompt v3]]

## 4. Executar Workout (Frontend + iOS)

**Resumo:**
1. Frontend/iOS exibe Workout da WeeklyGoal
2. Clica em "Start"
3. iOS: LocationManager começa GPS, RunTracker calcula distância/pace/splits
4. iOS: Live Activity ativa (AthlyRunnerAttributes)
5. iOS: HealthKit armazena workout
6. Fim: Frontend/iOS POST `/workouts/:id/feedback` (rating, notes, actual km)
7. Backend: calcula volume, intensity, recomendações
8. Backend: persiste WorkoutFeedback + AiReasoning

## 5. Assessment (Avaliação Inicial)

**Resumo:**
1. Usuário novo faz register → redirect para `/assessment`
2. Frontend: 5 sessionsSessões genéricas (RPE-based)
3. Frontend: POST `/assessment` (answers array)
4. Backend: salva em Assessment table
5. Backend: valida se running-related via goal-parser-prompt
6. Frontend: marca usuário como assessment completo
7. Frontend: redirect para `/app/dashboard`

Ver: [[Assessment Prompt]]

---

**Ver também**: [[Correlação de observabilidade]] (X-Athly-Request-Id, etc.)
