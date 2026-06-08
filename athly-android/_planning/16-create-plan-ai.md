# 16 — Criar objetivo + gerar primeira semana (IA)

## 1. Objetivo
Tela "Novo Plano": usuário descreve o objetivo em texto livre → backend interpreta (`ParsedGoal`) → modal de
confirmação com os detalhes extraídos → "Gerar primeira semana" via `plan-from-health` montando o payload do
Health Connect.

## 2. Stack & convenções
Ver `README.md`. UI em `feature/plan/ui/`, ViewModel em `feature/plan/`. Compose + Hilt + `StateFlow`.

## 3. Referência iOS (espelhar 1:1)
- `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/AthlyRunner/Views/Plan/CreatePlanView.swift`
  (entrada de texto, limite 500, 5 pills de exemplo, `submitGoal()` → `createGoal` → modal de confirmação,
  botão "Gerar primeira semana de treinos").
- `/Users/.../AthlyRunner/ViewModels/TrainingPlanViewModel.swift` (método `generateNextWeekWithHealth()`:
  lê corridas do Health, monta `HealthRunPayload[]` + `DetailedSessionPayload[]`, `POST /ai-planner/plan-from-health`,
  recarrega plano; em **timeout** entra em `pollUntilNewWorkouts`).
> Leia os dois por inteiro. Replicar textos pt-BR, validações e o fluxo de dois estados (input → confirmação).

## 4. Alvo Android
### `feature/plan/ui/CreatePlanScreen.kt`
- Dois estados na MESMA tela (espelha `showConfirmation`):
  - **Input:** título "Qual é o seu objetivo?" + subtítulo; `OutlinedTextField`/`TextEditor` multiline (minHeight
    ~120.dp), contador `${count}/500`, **maxLength 500** (descarta excedente). 5 pills de exemplo (clicam →
    preenchem o texto) com ícone lâmpada. Card de erro (ícone + texto, bg error @10%). Botão `AthlyGradientButton`
    "Criar meu plano" (loading → "Interpretando objetivo..."), **desabilitado se `count < 10` ou submitting**.
  - **Confirmação:** ícone check verde + "Objetivo entendido!" + `parsedGoal.summary` (primary). Card com
    `detailRow` por campo presente: `targetDistance` (flag), `targetTime` (relógio), `eventName` (calendar),
    `experienceLevel` mapeado (`beginner`→Iniciante, `intermediate`→Intermediário, `advanced`→Avançado).
    Botão `AthlyGradientButton` "Gerar primeira semana de treinos" (loading → "Gerando treinos...") + botão de
    texto "Fazer isso depois" (fecha).
- Apresentar como `ModalBottomSheet` ou tela full-screen com top bar "Novo Plano" + ação "Cancelar".

### `feature/plan/CreatePlanViewModel.kt` (`@HiltViewModel`)
- Injeta `GoalRepository`, `AiPlannerRepository`, `HealthConnectManager` (12).
- `UiState`: `goalText`, `isSubmitting`, `errorMessage?`, `parsedGoal?`, `showConfirmation`, `isGenerating`.
- `submitGoal()`: valida `length >= 10` → `goalRepository.createGoal(goalText)` → guarda `parsedGoal`,
  `showConfirmation = true`. Tratamento de erro do `createGoal`:
  - **422** (objetivo não-corrida): extrair `message` do corpo JSON se possível; senão fallback
    "Objetivo não reconhecido como corrida. Tente descrever uma meta relacionada a correr." (cobre `rejectionReason`).
  - outros códigos: "Erro ao processar objetivo. Tente novamente."
  - rede: "Erro de conexão. Verifique sua internet e tente novamente."
- `generatePlan()`: monta o payload via `HealthConnectManager` (ver abaixo) → `aiPlannerRepository.planFromHealth(req)`.
  Sucesso → recarrega o plano (delegar ao `TrainingPlanViewModel`/14 ou disparar evento) e fecha. **Timeout** →
  polling silencioso (ver Pitfalls). Sem corridas no Health → enviar `runs = []` (backend cai no plano de avaliação
  / cold start, NÃO bloquear).

### Montagem do payload (espelha `generateNextWeekWithHealth` + `buildDetailedSessions`)
- `runs = HealthConnectManager.fetchLatestRuns(limit = 20).map { it.toHealthRunPayload() }`.
- `detailedSessions`: se há corridas, `HealthConnectManager.buildDetailedSessions(limit = if (planExists) 7 else 5)`
  (cada sessão resolve o link via `RunWorkoutLink`/03 e gera `SegmentPayload[]`). Se vazio → `null`.
- `weekStartDate = null`.

## 5. Contrato de dados
- `POST /goals` → `CreateGoalResponse` (`CreateGoalRequest{goalText}`); `parsedGoal`:
  `{isRunningRelated, targetDistance?, targetTime?, eventDate?, eventName?, experienceLevel?, summary, rejectionReason?}`.
- `GET /goals/active` → `CreateGoalResponse?` (checar objetivo já existente).
- `POST /ai-planner/plan-from-health` → `AiPlannerResponse` (**timeout 120s**, ver 02). Body
  `PlanFromHealthRequest{runs[], detailedSessions?, weekStartDate?}`.

## 6. Escopo
**In:** tela 2-estados, validações, modal de confirmação, geração + payload do Health, polling pós-timeout.
**Fora:** lista/calendário do plano (15), detalhe de treino (17), componentes de card (18).

## 7. Dependências
`14-plan-data`, `12-health-connect`, `02-networking-dtos`, `01-design-system`.

## 8. Critérios de aceite
- Compila; abrir "Novo Plano", digitar < 10 chars → botão desabilitado; objetivo válido → modal com os campos
  do `parsedGoal`.
- Objetivo não-corrida (ex.: "quero fazer musculação") → backend 422 → mensagem de rejeição exibida, sem modal.
- "Gerar primeira semana" com Health autorizado monta `runs`/`detailedSessions` e cria o plano; sem corridas,
  gera plano de avaliação mesmo assim.
- Contador respeita 500; pills preenchem o campo.

## 9. Pitfalls
- **120s + UX de "gerando":** a request demora. Use o timeout de 120s do `plan-from-health` (02). Em
  `SocketTimeoutException`/timeout, NÃO mostre erro — inicie polling: a cada 5s recarregue o plano (até ~18×) e
  pare quando aparecerem treinos novos (compare ids antes/depois, igual ao iOS `pollUntilNewWorkouts`).
- **Permissão Health Connect:** se negada/indisponível, capture e siga com `runs = []` (assessment path) — nunca
  trave a geração.
- **rejectionReason / isRunningRelated:** o backend rejeita objetivos não-corrida via 422; trate o corpo e o
  fallback. `rejectionReason` pode vir no `parsedGoal` mesmo em sucesso parcial.
- **Limite de caracteres:** aplique no input (truncar), não só no contador.
- Após gerar, **reagende os lembretes** e recarregue o cache do plano (delegar ao fluxo do 14/21).
