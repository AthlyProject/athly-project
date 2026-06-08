# 20 — Perfil + Settings

## 1. Objetivo
Tela de Perfil: estatísticas gerais (do histórico de corridas), preferências de treino (dias disponíveis),
lembretes, peso, conta (sair/excluir), integração (Health Connect / Garmin futuro), sobre e admin opcional.

## 2. Stack & convenções
Ver `README.md`. UI em `feature/profile/ui/`, ViewModel em `feature/profile/`. Usa `UserRepository` (02),
stats do histórico (12/13), toggle de lembretes (21).

## 3. Referência iOS (espelhar 1:1)
- `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/AthlyRunner/Views/Profile/ProfileView.swift`
  — `List` (insetGrouped, fundo dark) com seções:
  - **"Estatisticas gerais"**: 5 linhas (ícone+label+valor) — Total de corridas (`allRuns.count`),
    Distância total (`%.1f km`, soma `distanceKm`), Tempo total (`formatDuration`: `%dh %dmin` ou `%dmin`),
    Pace médio (`totalTime/totalDistance` → `%d:%02d /km` ou `--:--`), Elevação total (`%.0f m`).
    Fonte: `runStore.sortedSessions` (histórico HealthKit-first; ver 12/13).
  - **"Preferências de treino"**: 7 toggles de dia (keys `sunday`…`saturday`, labels pt-BR `Dom`…`Sáb`),
    contador "N dia(s) selecionado(s)", botão **Salvar** → `updateProfile(availableDays:)`, confirmação
    "Dias de treino salvos!" por 2s, erro inline. `selectedDays: Set<String>`.
  - **"Lembretes"**: `Toggle` "Lembretes de treino" → `NotificationService.setEnabled(newValue, workouts: planVM.allWorkouts)`.
    Estado inicial = `NotificationService.shared.isEnabled`.
  - **"Perfil"**: `TextField` peso (kg, decimalPad, placeholder "70"), botão **Salvar** →
    valida `0 < kg < 400` (aceita vírgula), `updateProfile(weight:)`, persiste em `UserMetrics.weightKg`.
  - **"Conta"**: "Sair" (`authViewModel.logout()`), "Excluir conta" → `alert` de confirmação →
    `authViewModel.deleteAccount()` (servidor cascade + limpa sessão local). Ambos `role: .destructive`.
  - **"Integracao"**: `NavigationLink` "Corridas do Apple Health" → `HealthKitRunsView()`.
  - **"Admin"** (só se email ∈ whitelist `adminEmails`): `NavigationLink` "Relatório de dados/IA" → `AdminView()`.
  - **"Sobre"**: Versão `1.0.0`, links "Política de Privacidade" (`/privacy`) e "Termos de Uso" (`/terms`).
- `/Users/.../AthlyRunner/Views/Profile/AdminView.swift` + `/Users/.../AthlyRunner/ViewModels/AdminViewModel.swift`
  — diagnóstico de relatório semanal de IA: picker de semana (de `getWeeklyGoals(planId)` ordenado desc),
  carrega `getAdminWeeklyReport(weeklyGoalId)`; mostra resumo (modelo/prompt version/generation type/createdAt),
  corridas concluídas (data/title/dist/dur/status), prompt enviado e resposta bruta (monospace, selecionável);
  ações "Copiar tudo" (clipboard) e "Compartilhar .txt" (`composedReportText` → arquivo temporário).
- `/Users/.../AthlyRunner/ViewModels/AuthViewModel.swift` (`logout()`, `deleteAccount()`, `clearLocalSession()`:
  limpa Keychain + cache do plano + tokens do APIClient + `isAuthenticated = false`).

## 4. Alvo Android
### `feature/profile/ProfileViewModel.kt` (`@HiltViewModel`)
- `StateFlow<ProfileUiState>` com: `stats` (totalRuns, totalDistanceKm, totalDurationSec, avgPaceSecPerKm,
  totalElevationM), `selectedDays: Set<String>`, `isSavingDays`, `showSaveConfirmation`, `saveError`,
  `remindersEnabled`, `weightText`, `isSavingWeight`, `weightError`, `isDeletingAccount`, `deleteError`, `isAdmin`.
- Carrega perfil via `UserRepository.getMe()` (`availableDays`, `weight`); stats agregando o histórico de corridas
  (RunStore/Health Connect — 12/13). `saveDays()` / `saveWeight()` → `UserRepository.updateProfile(...)`.
  `toggleReminders(enabled)` → chama o scheduler (21) com os workouts do plano (14). `logout()` →
  `TokenStore.clear()` (02) + emite "sessão expirada"/navega ao auth (04/05). `deleteAccount()` →
  `UserRepository.deleteAccount()` (DELETE `/users/me`) → limpa estado local e desloga.
- Whitelist de admin por email (mesma lista do iOS) → expõe `isAdmin`.

### `feature/profile/ui/ProfileScreen.kt`
- `LazyColumn` agrupado (cards `AthlyCard` por seção, fundo `surfaceDark`) espelhando as 8 seções acima,
  strings pt-BR idênticas. Botões de dia: 7 chips em `Row`, selecionado usa `Gradient.brand`; não-selecionado
  `glassBackground` + `glassBorder`. Toggle Material3 `tint = primary`. Peso: `OutlinedTextField` numérico +
  botão Salvar. Excluir conta → `AlertDialog` com texto idêntico
  ("Isso apaga permanentemente sua conta e todos os seus dados…"). Versão via **`BuildConfig.VERSION_NAME`**
  (não hardcode). Links abrem `Intent.ACTION_VIEW` (`https://athlyproject.app/privacy` e `/terms`).
- **Integração**: linha "Conectar Apple Health" → na verdade **Health Connect** (link p/ tela de corridas do 13).
  Deixar **slot placeholder "Conectar Garmin"** (desabilitado / "Em breve") para futuro.

### `feature/profile/ui/AdminScreen.kt` + `AdminViewModel.kt` (opcional, email-gated)
- Picker de semana (`ExposedDropdownMenu`), carrega `AdminWeeklyReportDto` via `ApiService` (GET
  `/weekly-goals/{id}/admin-report`). Ações: copiar (ClipboardManager) e compartilhar `.txt`
  (`Intent.ACTION_SEND`, FileProvider) com o `composedReportText` (replicar o builder do iOS).

### Mapeamento de plataforma
- `UNUserNotifications` toggle → scheduler do prompt 21 (`NotificationManager` + WorkManager/AlarmManager).
- `Keychain` (logout) → `TokenStore` em EncryptedSharedPreferences (02).
- `Bundle version` → `BuildConfig.VERSION_NAME`. `UIPasteboard` → `ClipboardManager`; `ShareLink` → `ACTION_SEND` + FileProvider.

## 5. Contrato de dados
`GET /users/me` → `UserProfileDto` (`availableDays: List<String>?`, `weight: Double?`, `email`, `name?`).
`PUT /users/profile` ← `UpdateProfileRequest(name?, weight?, availableDays?)` → `UserProfileDto`.
`DELETE /users/me` → vazio (cascade no servidor). `GET /weekly-goals/{id}/admin-report` → `AdminWeeklyReportDto`
(`id, weekStartDate, weekEndDate, metrics?, previousWeekAnalysis?, promptLog?(promptText,rawResponse,modelUsed,
promptVersion,generationType,createdAt), workouts[](id,dateScheduled,title,description?,status,
actualDistanceMeters?,actualDurationSeconds?)`). Stats não têm endpoint — derivadas do histórico local/Health.

## 6. Escopo
**In:** ProfileScreen completo (8 seções), ProfileViewModel, salvar dias/peso, toggle de lembretes (chama 21),
logout/excluir conta, link p/ Health Connect, placeholder Garmin, sobre via BuildConfig, Admin opcional gated.
**Fora:** scheduler em si (21), tela de corridas do Health (13), billing.

## 7. Dependências
`02-networking-dtos` (UserRepository, TokenStore), `13-history-ui`/`12-health-connect` (stats + link),
`21-notifications` (toggle), `01-design-system`.

## 8. Critérios de aceite
- Compila; tela mostra as 5 estatísticas com os mesmos formatos do iOS (km/`%dh %dmin`/`%d:%02d /km`/`%.0f m`).
- Selecionar dias + Salvar persiste em `availableDays` e mostra a confirmação por 2s; reabrir reflete o salvo.
- Peso inválido (≤0, ≥400, vazio) mostra erro; válido persiste e ecoa o valor do backend.
- Toggle de lembretes reagenda/cancela via prompt 21; estado inicial vem do DataStore (21).
- "Sair" limpa o TokenStore e volta ao auth; "Excluir conta" chama `DELETE /users/me`, limpa estado e desloga.
- Versão exibida = `BuildConfig.VERSION_NAME`; links de privacy/terms abrem o navegador.
- Admin só aparece para email na whitelist; relatório carrega e copia/compartilha.

## 9. Pitfalls
- `deleteAccount` faz cascade no servidor — **garanta limpar todo o estado local** (TokenStore, caches de plano,
  histórico) e desfazer a navegação para o auth; não deixe dados órfãos em DataStore/Room.
- Persistência de `availableDays`: enviar a lista completa atual (não diff); aceitar vírgula no peso (`,`→`.`).
- Versão **do `BuildConfig`**, nunca string hardcoded.
- Stats agregadas do histórico podem demorar (Health Connect) — calcular fora da main thread e mostrar `0`/`--:--` enquanto carrega.
- Garmin é só placeholder (sem integração); não prometer funcionalidade.
