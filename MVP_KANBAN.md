# Athly MVP — Kanban

> Referência: `MVP_PRD.md`
> Branch base: `main`
> Stack: NestJS + Prisma + React + Anthropic Claude

---

## Épico 1 — Strava OAuth

### TASK-001: Adicionar variáveis de ambiente Strava

k
**Arquivo:** `athly-backend/.env.example`

Adicionar:

```
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=http://localhost:3000/integrations/strava/callback
ANTHROPIC_API_KEY=
```

**Arquivo:** `athly-frontend/.env.example`

```
VITE_STRAVA_CLIENT_ID=
VITE_STRAVA_REDIRECT_URI=http://localhost:5173/oauth/strava/callback
```

**Critério:** Variáveis documentadas e lidas corretamente via `ConfigService` no NestJS.

---

### TASK-002: Endpoint GET /integrations/strava/auth (backend)

**Arquivo:** `athly-backend/src/modules/integrations/integrations.controller.ts`

Adicionar endpoint que retorna a URL de autorização OAuth do Strava:

```
https://www.strava.com/oauth/authorize?client_id={STRAVA_CLIENT_ID}&response_type=code&redirect_uri={REDIRECT_URI}&scope=activity:read_all
```

**Arquivo:** `athly-backend/src/modules/integrations/integrations.service.ts`

Método `getStravaAuthUrl()` que monta e retorna a URL.

**Critério:** `GET /integrations/strava/auth` retorna `{ url: "https://www.strava.com/..." }`.

---

### TASK-003: Endpoint POST /integrations/strava/callback (backend)

**Arquivo:** `athly-backend/src/modules/integrations/integrations.controller.ts`

Recebe `{ code: string }` no body. Chama `integrationsService.handleStravaCallback(userId, code)`.

**Arquivo:** `athly-backend/src/modules/integrations/integrations.service.ts`

`handleStravaCallback(userId, code)`:

1. POST para `https://www.strava.com/oauth/token` com `client_id`, `client_secret`, `code`, `grant_type: authorization_code`
2. Recebe `access_token`, `refresh_token`, `expires_at`, `athlete.id`
3. Upsert em `Integration` com `type: strava`, `connected: true`, tokens e `stravaAthleteId`
4. Dispara `stravaService.syncActivities(userId)` (fire-and-forget ou await)

**Critério:** Após callback, `Integration` no banco tem `connected: true` e tokens preenchidos.

---

### TASK-004: Botão "Conectar Strava" no frontend

**Arquivo:** `athly-frontend/src/services/integrationService.ts`

Adicionar:

```typescript
export const initiateStravaOAuth = async (): Promise<void> => {
  const { data } = await api.get("/integrations/strava/auth");
  window.location.href = data.url;
};

export const handleStravaCallback = async (code: string): Promise<void> => {
  await api.post("/integrations/strava/callback", { code });
};
```

**Arquivo:** `athly-frontend/src/pages/SettingsPage.tsx`

- Exibir botão "Conectar Strava" (ou "Desconectar" se já conectado)
- Ao clicar, chamar `initiateStravaOAuth()`
- Exibir badge verde "Conectado" quando `integration.connected === true`

**Arquivo:** Criar `athly-frontend/src/pages/OAuthCallbackPage.tsx` (ou rota `/oauth/strava/callback`)

- Ler `?code=` da URL
- Chamar `handleStravaCallback(code)`
- Redirecionar para Settings com toast de sucesso

**Critério:** Fluxo completo funciona sem erros no browser.

---

## Épico 2 — Schema Migrations

### TASK-005: Adicionar campos OAuth na Integration

**Arquivo:** `athly-backend/prisma/schema.prisma`

Adicionar na model `Integration`:

```prisma
accessToken      String?   @map("access_token")
refreshToken     String?   @map("refresh_token")
tokenExpiresAt   DateTime? @map("token_expires_at")
stravaAthleteId  String?   @map("strava_athlete_id")
```

Executar:

```bash
cd athly-backend
npx prisma migrate dev --name add_strava_oauth_fields
```

**Critério:** Migration aplicada sem erros, campos acessíveis via PrismaClient.

---

### TASK-006: Adicionar stravaActivityId na Workout

**Arquivo:** `athly-backend/prisma/schema.prisma`

Adicionar na model `Workout`:

```prisma
stravaActivityId String? @unique @map("strava_activity_id")
```

Executar:

```bash
npx prisma migrate dev --name add_strava_activity_id
```

**Critério:** Campo disponível no banco, constraint UNIQUE aplicada.

---

## Épico 3 — Strava Sync Service

### TASK-007: Criar módulo StravaModule

**Criar:** `athly-backend/src/modules/strava/strava.module.ts`

```typescript
@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [StravaService],
  exports: [StravaService],
})
export class StravaModule {}
```

**Criar:** `athly-backend/src/modules/strava/strava.service.ts`

Registrar no `athly-backend/src/app.module.ts`.

**Critério:** Módulo injetável em `IntegrationsModule`.

---

### TASK-008: Implementar StravaService.syncActivities

**Arquivo:** `athly-backend/src/modules/strava/strava.service.ts`

`syncActivities(userId: string)`:

1. Buscar `Integration` do usuário com `type: strava`
2. Se `tokenExpiresAt < now`, chamar `refreshStravaToken(integration)` primeiro
3. GET `https://www.strava.com/api/v3/athlete/activities?per_page=60&after={30_dias_atras_unix}`
   - Header: `Authorization: Bearer {accessToken}`
4. Para cada atividade:
   - Verificar se já existe `Workout` com `stravaActivityId === activity.id`
   - Se não existe, criar `Workout`:
     - `stravaActivityId`: `activity.id`
     - `sportType`: mapear tipo Strava para enum local (ver mapeamento abaixo)
     - `title`: `activity.name`
     - `dateScheduled`: `activity.start_date`
     - `status`: `done`
     - `intensity`: calcular de `activity.average_heartrate` ou `suffer_score`
     - `blocks`: `[{ type: "strava_import", distance: activity.distance, movingTime: activity.moving_time, elevationGain: activity.total_elevation_gain }]`
     - `trainingPlanId`: plano ativo do usuário
     - `userId`: userId

**Mapeamento de tipos Strava → SportType:**

```
Run → running
Ride/VirtualRide → cycling
Swim → swimming
WeightTraining → strength
Crossfit → crossfit
Walk → walking
* → other
```

**Critério:** Após sync, atividades Strava aparecem como `Workout` com `status: done`. Re-sync não duplica.

---

### TASK-009: Implementar refresh de token Strava

**Arquivo:** `athly-backend/src/modules/strava/strava.service.ts`

`refreshStravaToken(integration: Integration)`:

1. POST `https://www.strava.com/oauth/token` com `grant_type: refresh_token`
2. Atualizar `Integration` com novos `accessToken`, `refreshToken`, `tokenExpiresAt`

Chamar antes de toda requisição à API Strava quando `tokenExpiresAt < now + 5min`.

**Critério:** Token expirado é renovado transparentemente sem erro 401.

---

## Épico 4 — User Preferences

### TASK-010: Validar que campos de preferência estão acessíveis

**Verificar em:** `athly-backend/src/modules/users/users.service.ts`

Confirmar que `findById` retorna `goals`, `availability`, `weight`, `height` do `User` e `sports` do `TrainingPlan`.

**Arquivo:** `athly-backend/src/modules/training-plans/training-plans.service.ts`

Confirmar que `findByUserId` inclui `user` com `goals` e `availability`.

**Critério:** Serviço de IA consegue buscar todos os campos necessários para o prompt em uma query.

---

### TASK-011: Frontend — formulário de preferências inicial

**Arquivo:** `athly-frontend/src/pages/SettingsPage.tsx` ou página de onboarding existente

Se `user.goals` está vazio ou `user.availability` é null, exibir alerta/banner pedindo ao usuário para preencher preferências antes de gerar plano.

**Critério:** Usuário sem preferências vê aviso claro antes de tentar gerar plano.

---

## Épico 5 — AI Service

### TASK-012: Instalar Anthropic SDK no backend

```bash
cd athly-backend
npm install @anthropic-ai/sdk
```

**Critério:** Pacote instalado e importável.

---

### TASK-013: Criar AiModule e AiService

**Criar:** `athly-backend/src/modules/ai/ai.module.ts`

```typescript
@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
```

**Criar:** `athly-backend/src/modules/ai/ai.service.ts`

Injetar `ConfigService` para ler `ANTHROPIC_API_KEY`. Inicializar cliente Anthropic.

Registrar `AiModule` em `athly-backend/src/app.module.ts`.

**Critério:** Módulo injetável, cliente Anthropic inicializado.

---

### TASK-014: Implementar AiService.generateWeeklyPlan

**Arquivo:** `athly-backend/src/modules/ai/ai.service.ts`

`generateWeeklyPlan(userId: string): Promise<WeeklyPlanJson>`:

1. Buscar dados do usuário:
   - `User`: `goals`, `availability`, `weight`, `height`, `equipments`
   - `TrainingPlan`: `sports`, `objective`, `targetDate`
   - `Workout[]`: últimos 30 workouts com `status: done` (Strava + manuais)

2. Montar system prompt:

```
Você é um personal trainer especialista. Seu trabalho é criar planos de treino semanais personalizados.
Retorne APENAS um JSON válido seguindo exatamente o schema fornecido, sem texto adicional.
```

3. Montar user message com dados do atleta e histórico.

4. Chamar Claude:

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  system: systemPrompt,
  messages: [{ role: "user", content: userMessage }],
});
```

5. Parsear JSON da resposta. Se inválido, lançar erro descritivo.

6. Retornar objeto `WeeklyPlanJson` validado.

**Critério:** Método retorna JSON válido com `weekStartDate`, `weekEndDate`, `metrics`, `workouts[]`.

---

## Épico 6 — Training Plan Generation

### TASK-015: Endpoint POST /training-plans/generate

**Arquivo:** `athly-backend/src/modules/training-plans/training-plans.controller.ts`

Adicionar rota `POST /training-plans/generate` (protegida por auth guard).

**Arquivo:** `athly-backend/src/modules/training-plans/training-plans.service.ts`

`generatePlan(userId: string)`:

1. Chamar `aiService.generateWeeklyPlan(userId)`
2. Criar `WeeklyGoal` com datas e metrics retornados
3. Criar `Workout[]` com `status: scheduled`, associados ao `WeeklyGoal` e `TrainingPlan`
4. Retornar `TrainingPlan` atualizado com `WeeklyGoal` e `Workout[]`

Importar `AiModule` em `TrainingPlansModule`.

**Critério:** Endpoint retorna plano gerado em menos de 30s. Dados persistidos no banco.

---

### TASK-016: Endpoint POST /training-plans/cron-trigger (admin)

**Arquivo:** `athly-backend/src/modules/training-plans/training-plans.controller.ts`

Adicionar rota `POST /training-plans/cron-trigger` protegida por role `ADMIN`.

Chama `trainingPlansService.runWeeklyLoop()`.

`runWeeklyLoop()`: busca todos `TrainingPlan` com `autoGenerate: true`, chama `generatePlan` para cada userId.

**Critério:** Endpoint permite testar o cron manualmente.

---

## Épico 7 — Weekly Loop (Cron)

### TASK-017: Instalar @nestjs/schedule

```bash
cd athly-backend
npm install @nestjs/schedule
npm install -D @types/cron
```

Adicionar `ScheduleModule.forRoot()` nos imports de `athly-backend/src/app.module.ts`.

**Critério:** Módulo de agendamento configurado.

---

### TASK-018: Implementar cron job semanal

**Arquivo:** `athly-backend/src/modules/training-plans/training-plans.service.ts`

Adicionar método com decorator:

```typescript
@Cron('0 6 * * 1') // toda segunda-feira às 06:00
async weeklyPlanCron() {
  await this.runWeeklyLoop()
}
```

Importar `Cron` de `@nestjs/schedule`.

**Critério:** Cron registrado (visível nos logs de boot). `runWeeklyLoop` funciona via endpoint de teste.

---

## Épico 8 — Frontend Integration

### TASK-019: Exibir workouts por origem na PlanPage

**Arquivo:** `athly-frontend/src/pages/PlanPage.tsx` (ou equivalente)

Adicionar indicador visual de origem do workout:

- Strava sync: ícone Strava laranja + "Sincronizado"
- IA gerado: ícone robot/sparkle + "Gerado por IA"
- Manual: sem badge extra

Lógica: se `workout.stravaActivityId !== null` → Strava; else se `workout.status === 'done'` com data passada → manual; else → IA.

**Critério:** Usuário consegue identificar origem de cada treino visualmente.

---

### TASK-020: Botão "Gerar Plano" no frontend

**Arquivo:** `athly-frontend/src/pages/PlanPage.tsx` ou `TrainingPlanCalendarPage.tsx`

Adicionar botão "Gerar Plano Semanal" que chama `POST /training-plans/generate`.

Exibir loading durante geração (pode levar até 30s).

Após sucesso: atualizar lista de workouts da semana.

**Arquivo:** `athly-frontend/src/services/trainingPlanService.ts`

Adicionar `generateWeeklyPlan(): Promise<TrainingPlan>`.

**Critério:** Usuário clica e vê plano gerado aparecendo no calendário.

---

### TASK-021: Página de callback OAuth no frontend

**Criar:** `athly-frontend/src/pages/OAuthCallbackPage.tsx`

- Ler `?code=` e `?error=` da URL
- Se `error`: redirecionar para Settings com toast de erro
- Se `code`: chamar `handleStravaCallback(code)`, aguardar, redirecionar para Settings com toast de sucesso

**Arquivo:** `athly-frontend/src/router/index.tsx` (ou equivalente de rotas)

Registrar rota `/oauth/strava/callback` apontando para `OAuthCallbackPage`.

**Critério:** Usuário autoriza no Strava e é redirecionado de volta com feedback claro.

---

## Ordem de Implementação Sugerida

```
TASK-001 → TASK-005 → TASK-006   # Setup inicial
    ↓
TASK-007 → TASK-008 → TASK-009   # Strava sync
    ↓
TASK-002 → TASK-003               # OAuth backend
    ↓
TASK-012 → TASK-013 → TASK-014   # AI service
    ↓
TASK-015 → TASK-016               # Geração do plano
    ↓
TASK-017 → TASK-018               # Cron
    ↓
TASK-004 → TASK-019 → TASK-020 → TASK-021  # Frontend
    ↓
TASK-010 → TASK-011               # Validações finais
```

---

## Checklist de Verificação End-to-End

- [ ] "Conectar Strava" redireciona para Strava OAuth
- [ ] Após autorizar, `Integration.connected = true` no banco
- [ ] Tokens salvos: `accessToken`, `refreshToken`, `tokenExpiresAt`, `stravaAthleteId`
- [ ] Atividades dos últimos 30 dias aparecem como `Workout` com `status: done`
- [ ] Re-sync não duplica workouts (constraint `stravaActivityId UNIQUE`)
- [ ] `POST /training-plans/generate` retorna plano em menos de 30s
- [ ] Plano respeita `availability` (dias disponíveis)
- [ ] Frontend exibe plano na PlanPage e CalendarPage
- [ ] Cron testado via `POST /training-plans/cron-trigger`
- [ ] Token expirado é renovado automaticamente
