# Plano de Integração Strava — Athly MVP

## Visão Geral

Implementar o fluxo completo de integração Strava: OAuth 2.0 per-user, armazenamento seguro de tokens, sincronização de atividades como Workouts (`status: done`), link bidirecional Strava ↔ Workout, refresh automático de tokens, sync manual, e UI/UX com modal obrigatória de autenticação.

---

## Fase 1 — Schema Prisma (Migrations)

### 1.1 Expandir model `Integration` com campos OAuth

```prisma
model Integration {
  id               String          @id @default(uuid())
  name             String
  icon             String
  connected        Boolean         @default(false)
  type             IntegrationType
  accessToken      String?         @map("access_token")
  refreshToken     String?         @map("refresh_token")
  tokenExpiresAt   DateTime?       @map("token_expires_at")
  stravaAthleteId  String?         @map("strava_athlete_id")
  scope            String?

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId String @map("user_id")

  @@map("integrations")
}
```

**Campos novos:** `accessToken`, `refreshToken`, `tokenExpiresAt`, `stravaAthleteId`, `scope`
**Campo alterado:** `id` passa a ser `@default(uuid())` (antes era manual)

### 1.2 Adicionar `stravaActivityId` no model `Workout`

```prisma
model Workout {
  // ... campos existentes ...
  stravaActivityId String? @unique @map("strava_activity_id")
}
```

**Propósito:** Evitar duplicatas no sync e permitir link Strava ↔ Workout.

### Migration

```bash
npx prisma migrate dev --name add_strava_oauth_and_activity_id
```

---

## Fase 2 — Backend: Strava OAuth Flow

### 2.1 Variáveis de Ambiente

Adicionar ao `.env`:
```
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=http://localhost:3000/oauth/strava/callback
```

### 2.2 Endpoints no `IntegrationsController`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/integrations/strava/auth` | Retorna URL de autorização OAuth |
| POST | `/integrations/strava/callback` | Recebe `code`, troca por tokens, salva |
| POST | `/integrations/strava/sync` | Sync manual de atividades |
| POST | `/integrations/strava/disconnect` | Desconecta e limpa tokens |

### 2.3 Fluxo OAuth Detalhado

```
Frontend                           Backend                          Strava
   |                                 |                                |
   |-- GET /integrations/strava/auth -->                              |
   |<-- { url: "strava.com/oauth/authorize?..." } --                  |
   |                                 |                                |
   |-- redirect browser ------------------------------------------------>
   |                                 |                    User authorizes
   |<-- redirect to REDIRECT_URI?code=xxx -----------------------------|
   |                                 |                                |
   |-- POST /integrations/strava/callback { code } -->                |
   |                                 |-- POST strava.com/oauth/token -->
   |                                 |<-- { access_token, refresh_token, athlete } --|
   |                                 |                                |
   |                    Upsert Integration:                           |
   |                    - connected: true                             |
   |                    - accessToken, refreshToken, tokenExpiresAt   |
   |                    - stravaAthleteId: athlete.id                 |
   |                    Dispara syncActivities(userId)                |
   |                                 |                                |
   |<-- { success: true, integration } --                             |
```

### 2.4 `IntegrationsService` — Novos Métodos

```typescript
getStravaAuthUrl(): string
handleStravaCallback(userId: string, code: string): Promise<Integration>
refreshStravaToken(integration: Integration): Promise<Integration>
getValidStravaToken(userId: string): Promise<string> // refresh automático se expirado
disconnectStrava(userId: string): Promise<void>
```

**`getValidStravaToken`** — método central usado por qualquer serviço que precise do token Strava:
1. Busca Integration do usuário com `type: strava`
2. Se `tokenExpiresAt < now + 5min`, chama `refreshStravaToken`
3. Retorna `accessToken` válido

---

## Fase 3 — Backend: Strava Sync Service

### 3.1 Novo módulo `StravaModule`

```
src/modules/strava/
  strava.module.ts
  strava.service.ts       # Sync de atividades + chamadas API Strava
  strava.mapper.ts        # Mapeamento Strava Activity → Workout
```

### 3.2 `StravaService.syncActivities(userId)`

**Fluxo:**
1. Obter token válido via `integrationsService.getValidStravaToken(userId)`
2. GET `https://www.strava.com/api/v3/athlete/activities?per_page=60&after={30_dias_atras_unix}`
3. Para cada atividade:
   - Verificar se já existe Workout com `stravaActivityId === activity.id.toString()`
   - Se existe: skip (evitar duplicata)
   - Se não existe: criar Workout mapeado

### 3.3 Mapeamento Strava Activity → Workout

```typescript
// strava.mapper.ts

Strava type → SportType:
  Run, TrailRun       → running
  Ride, VirtualRide   → cycling
  Swim                → swimming
  WeightTraining      → strength
  CrossFit            → crossfit
  Walk, Hike          → walking
  Yoga                → yoga
  *                   → other

Strava Activity → Workout:
  stravaActivityId  ← activity.id.toString()
  title             ← activity.name
  dateScheduled     ← activity.start_date
  sportType         ← mapeamento acima
  status            ← 'done' (atividade já aconteceu)
  intensity         ← derivado de suffer_score ou heartrate (1-10)
  description       ← `Synced from Strava — ${distance}km in ${time}`
  trainingPlanId    ← plano ativo do usuário
  userId            ← userId
  blocks            ← [{
                        type: "strava_import",
                        distanceKm: activity.distance / 1000,
                        durationMinutes: activity.moving_time / 60,
                        targetPace: formatPace(activity.average_speed),
                        instructions: `Elevation: ${activity.total_elevation_gain}m | Avg HR: ${activity.average_heartrate} bpm`
                      }]
```

### 3.4 Intensidade derivada

```typescript
function deriveIntensity(activity: StravaActivity): number {
  if (activity.suffer_score) {
    if (activity.suffer_score >= 150) return 10;
    if (activity.suffer_score >= 100) return 8;
    if (activity.suffer_score >= 50) return 6;
    return Math.max(1, Math.round(activity.suffer_score / 10));
  }
  if (activity.average_heartrate) {
    if (activity.average_heartrate >= 170) return 9;
    if (activity.average_heartrate >= 150) return 7;
    if (activity.average_heartrate >= 130) return 5;
    return 3;
  }
  return 5; // default moderate
}
```

---

## Fase 4 — Backend: Atualizar AI Planner para Per-User Token

### 4.1 Alterar `StravaService` (ai-planner)

O `StravaService` atual do módulo `ai-planner` usa `STRAVA_ACCESS_TOKEN` da env var. Precisa passar a usar o token per-user:

```typescript
// Antes:
async getRecentActivities(count: number)

// Depois:
async getRecentActivities(userId: string, count: number)
// Internamente usa integrationsService.getValidStravaToken(userId)
```

### 4.2 Atualizar `AiPlannerService`

```typescript
// Passa userId para StravaService
const activities = await this.stravaService.getRecentActivities(userId, 30);
```

### 4.3 Fallback quando Strava não conectado

Se o usuário não tem Integration Strava conectada → `getValidStravaToken` lança exceção → AiPlannerService trata como "sem dados" → gera assessment plan.

---

## Fase 5 — Frontend: OAuth Flow + UI

### 5.1 Nova página `OAuthCallbackPage`

**Rota:** `/oauth/strava/callback`

```
1. Lê ?code= e ?error= da URL
2. Se error → toast de erro → redirect /settings
3. Se code → POST /integrations/strava/callback { code }
4. Se sucesso → toast "Strava conectado!" → redirect /settings
5. Se erro → toast com mensagem → redirect /settings
```

### 5.2 Atualizar `SettingsPage`

- Botão "Conectar Strava" → chama `GET /integrations/strava/auth` → `window.location.href = url`
- Botão "Sincronizar" (visível quando conectado) → chama `POST /integrations/strava/sync`
- Botão "Desconectar" → chama `POST /integrations/strava/disconnect`
- Badge "Conectado" / "Desconectado" com cores

### 5.3 Modal obrigatória de autenticação Strava

**Componente:** `StravaAuthModal`

Exibida automaticamente quando:
- Usuário tenta gerar plano (`POST /ai-planner/plan-next-week`)
- E não tem Integration Strava com `connected: true`

**Conteúdo da modal:**
```
┌─────────────────────────────────────────┐
│  🏃 Conecte seu Strava                  │
│                                         │
│  Para gerar um plano personalizado,     │
│  precisamos acessar seu histórico de    │
│  treinos no Strava.                     │
│                                         │
│  Isso nos permite:                      │
│  ✓ Analisar seu ritmo e distâncias     │
│  ✓ Adaptar a intensidade ao seu nível  │
│  ✓ Criar progressão baseada em dados   │
│                                         │
│  Sem o Strava, geramos um plano de     │
│  avaliação inicial com 5 treinos       │
│  para testar seu nível.                │
│                                         │
│  [Conectar Strava]  [Gerar sem Strava] │
└─────────────────────────────────────────┘
```

**Dois caminhos:**
1. **Conectar Strava** → inicia OAuth flow
2. **Gerar sem Strava** → chama `plan-next-week` sem Strava (assessment plan)

### 5.4 Indicadores visuais de origem do Workout

No `WorkoutCard` e `PlanPage`, exibir badge de origem:

| Origem | Badge | Cor |
|--------|-------|-----|
| Strava sync | "Strava" com ícone | Laranja (#FC4C02) |
| IA gerado | "IA" com sparkle | Cyan (primary) |
| Manual | — (sem badge) | — |

**Lógica:** `workout.stravaActivityId != null` → Strava; else se criado por AI planner → IA; else → Manual.

### 5.5 Sync manual

Botão na `SettingsPage` e opcionalmente na `PlanPage`:
```
[🔄 Sincronizar Strava]
```
- Loading spinner enquanto processa
- Toast com resultado: "X atividades sincronizadas" ou "Nenhuma atividade nova"
- Desabilitado se Strava não conectado

---

## Fase 6 — Variáveis de Ambiente

### Backend `.env`
```
# Strava OAuth (novos)
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=http://localhost:3000/oauth/strava/callback

# Strava (remover depois)
STRAVA_ACCESS_TOKEN=   # deprecated — usar OAuth per-user
```

### Frontend `.env`
```
VITE_API_URL=http://localhost:4000
```

---

## Arquivos a Criar/Modificar

### Backend — Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/modules/strava/strava.module.ts` | Módulo NestJS para sync |
| `src/modules/strava/strava.service.ts` | Sync de atividades, chamadas API |
| `src/modules/strava/strava.mapper.ts` | Mapeamento Activity → Workout |
| `src/modules/integrations/dto/strava-callback.input.ts` | DTO `{ code: string }` |

### Backend — Modificar

| Arquivo | Mudança |
|---------|---------|
| `prisma/schema.prisma` | Adicionar campos OAuth + stravaActivityId |
| `src/modules/integrations/integrations.controller.ts` | 4 novos endpoints Strava |
| `src/modules/integrations/integrations.service.ts` | OAuth flow + token refresh |
| `src/modules/integrations/integrations.module.ts` | Importar StravaModule |
| `src/modules/integrations/models/integration.model.ts` | Novos campos |
| `src/modules/ai-planner/strava.service.ts` | Usar token per-user |
| `src/modules/ai-planner/ai-planner.service.ts` | Passar userId ao Strava |
| `src/modules/ai-planner/ai-planner.module.ts` | Importar IntegrationsModule |
| `src/modules/workouts/models/workout.model.ts` | Adicionar stravaActivityId |
| `src/app.module.ts` | Registrar StravaModule |

### Frontend — Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/OAuthCallbackPage.tsx` | Callback do OAuth Strava |
| `src/components/StravaAuthModal.tsx` | Modal obrigatória de conexão |

### Frontend — Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/router/index.tsx` | Adicionar rota `/oauth/strava/callback` |
| `src/services/integrationService.ts` | Novos métodos OAuth |
| `src/pages/SettingsPage.tsx` | Botões OAuth + sync manual |
| `src/pages/PlanPage.tsx` | Modal Strava + badge de origem |
| `src/components/WorkoutCard.tsx` | Badge Strava/IA |
| `src/types/index.ts` | Expandir tipo Integration |

---

## Ordem de Implementação

```
1. Migration Prisma (Integration + Workout)
2. IntegrationsService: OAuth methods + token refresh
3. IntegrationsController: 4 endpoints Strava
4. StravaModule: sync service + mapper
5. Atualizar AI Planner: per-user token
6. Frontend: OAuthCallbackPage + rota
7. Frontend: SettingsPage (OAuth + sync)
8. Frontend: StravaAuthModal
9. Frontend: badges de origem (WorkoutCard)
```

---

## Verificação End-to-End

1. `npx prisma migrate dev` — migration sem erros
2. `npm run build` — compilação sem erros
3. Clicar "Conectar Strava" → redireciona para Strava OAuth
4. Autorizar no Strava → redirect callback → tokens salvos no banco
5. `POST /integrations/strava/sync` → atividades aparecem como Workouts
6. Re-sync → sem duplicatas (constraint stravaActivityId UNIQUE)
7. `POST /ai-planner/plan-next-week` → usa token do usuário (não env var)
8. Usuário sem Strava → modal → opção de gerar assessment plan
9. Token expirado → refresh automático transparente
10. Desconectar → tokens limpos, connected = false
