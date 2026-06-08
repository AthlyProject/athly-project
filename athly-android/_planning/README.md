# Athly Android — Prompts de Planejamento (port Kotlin do `athly-ios`)

Este diretório contém **prompts de desenvolvimento**, um por fatia do app. Cada `NN-*.md` é
**auto-contido**: você dá ele para um agente (Claude Code), que **planeja e implementa** aquela fatia
em Kotlin, espelhando o app iOS `AthlyRunner`.

> **Fonte de verdade (iOS):** `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/AthlyRunner`
> **Backend:** `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-backend` (contrato em `api.athlyproject.app`)
> **App novo (Android):** `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-android`

## Como usar

1. Leia o `ENVIRONMENT.md` e prepare a máquina.
2. Rode os prompts **em ordem numérica** (as dependências são incrementais). Comece pelo `00`.
3. Para cada prompt: abra o agente na raiz `athly-android/`, cole o conteúdo do `.md`, deixe ele
   planejar+implementar, e valide pelos **Critérios de aceite** do próprio prompt antes de seguir.

## Ordem & dependências

```
00 foundation ─┬─ 01 design-system ─┐
               ├─ 02 networking-dtos ┤
               └─ 03 domain-models ──┴─ 04 auth ─ 05 nav-shell ─┬─ 06 location ─ 07 run-tracker ─ 08 run-ui ─ 09 summary ─ 10 cues ─ 11 live-notif
                                                                ├─ 12 health-connect ─ 13 history-ui
                                                                ├─ 14 plan-data ─ 15 plan-ui ─ 16 create-plan-ai ─ 17 workout-detail ─ 18 components
                                                                ├─ 19 dashboard
                                                                ├─ 20 profile ─ 21 notifications
                                                                └─ 22 billing-paywall
```

Fundação obrigatória primeiro: **00 → 01 → 02 → 03**. Depois `04` e `05`. As trilhas de feature
(corrida / health / plano / dashboard / profile) podem ser tocadas em paralelo após o `05`.

## Stack padrão (vale para todos os prompts)

- **UI:** Jetpack Compose (Material3), tema dark forçado. Navegação: Navigation-Compose.
- **Arquitetura:** MVVM. `ViewModel` (Hilt) expondo `StateFlow<UiState>`; Composables stateless +
  `collectAsStateWithLifecycle()`. (Espelha `ObservableObject` + `@Published` do iOS.)
- **DI:** Hilt (`@HiltAndroidApp`, `@AndroidEntryPoint`, `@HiltViewModel`, módulos em `core/di`).
- **Rede:** Retrofit + OkHttp + **kotlinx.serialization** (`Json { ignoreUnknownKeys = true }`).
- **Assíncrono:** Coroutines + Flow. Sem RxJava.
- **Persistência:** DataStore (prefs) / Room (listas) / EncryptedSharedPreferences (tokens).
- **Min/Target:** `minSdk 26`, `compileSdk/targetSdk 35`, JDK 17, AGP/Kotlin recentes, Compose BOM.
- **applicationId/namespace:** `com.athly.runner`.

## Layout de pacote (definido no `00`, seguido por todos)

```
com.athly.runner
├── AthlyApp.kt                @HiltAndroidApp
├── MainActivity.kt            @AndroidEntryPoint, setContent { AthlyTheme { AthlyNavHost() } }
├── core/
│   ├── designsystem/          theme/ (Color, Type, Theme), component/ (AthlyCard, buttons, textfield)
│   ├── network/               ApiService, interceptors, NetworkModule
│   ├── data/                  TokenStore, datastore, room
│   ├── common/                Result, formatters (pace, distance, duration)
│   └── di/                    Hilt modules
├── domain/model/              Segment, WorkoutSegments, ActiveSegment, SportType, RunSession, ...
├── data/
│   ├── remote/dto/            *Dto (espelham APIModels.swift)
│   └── repository/            *Repository (Auth, Plan, Workout, Goal, Health)
└── feature/<area>/            ui/ (composables) + <Area>ViewModel.kt
    auth · run · plan · history · dashboard · profile · health · paywall
```

## Template de cada prompt (todo `NN-*.md` tem estas 9 seções)

1. **Objetivo** — 1 linha.
2. **Stack & convenções** — referência a este README (não repetir tudo).
3. **Referência iOS** — caminhos absolutos dos `.swift` a espelhar + resumo do comportamento.
4. **Alvo Android** — arquivos/pacotes a criar + libs + **mapeamento de plataforma** relevante.
5. **Contrato de dados** — DTOs/endpoints envolvidos.
6. **Escopo (in) / Fora de escopo.**
7. **Dependências** — prompts anteriores necessários.
8. **Critérios de aceite** — compila + comportamento + o que verificar manualmente.
9. **Pitfalls.**

## Mapeamento de plataforma (iOS → Android)

| iOS / Apple | Android / Kotlin |
|---|---|
| SwiftUI · `@Published`/Combine · `ObservableObject` | Compose · `StateFlow` · `ViewModel` (Hilt) |
| CoreLocation bg (`UIBackgroundModes: location`) | `FusedLocationProvider` + **Foreground Service** + `ACCESS_BACKGROUND_LOCATION` |
| HealthKit | **Health Connect** (`androidx.health.connect:connect-client`) |
| ActivityKit Live Activity / Dynamic Island | **Notificação contínua de Foreground Service** (sem Dynamic Island) |
| `AVSpeechSynthesizer` · `AVAudioPlayer` · CoreHaptics | `TextToSpeech` · `SoundPool` · `VibrationEffect` |
| Keychain | **EncryptedSharedPreferences** (Jetpack Security) |
| UserNotifications | `NotificationManager` + WorkManager/AlarmManager (+ `POST_NOTIFICATIONS`) |
| MapKit | **Maps Compose** (Google Maps) |
| RevenueCat iOS / StoreKit | RevenueCat Android (`Purchases`) / Play Billing |
| xcodegen `project.yml` | Gradle KTS + version catalog |

## Regras de fidelidade (obrigatórias em todo prompt)

- **Cores em hex exatos** do `Utils/Theme.swift` (primary `#06b6d4`, secondary `#9d25f4`, bg `#0a0a10`…).
- **Fonte SpaceGrotesk** (Regular/Medium/SemiBold/Bold) em `res/font`.
- **Strings pt-BR idênticas** (labels e cues de voz, ex.: "Tiro 3 de 6").
- **Algoritmo de GPS/splits idêntico** (mesmas constantes do `SplitCalculator`/`RunTracker`).
- **Mesmo contrato de API** (snake_case, ISO8601 com fallback `yyyy-MM-dd`, opcionais → nullable).
- Espelhar **telas, fluxos e navegação** 1:1 — não redesenhar.

## Índice

| # | Arquivo | Fatia |
|---|---|---|
| 00 | `00-foundation.md` | Scaffold Gradle/Hilt/Compose/Nav + convenções |
| 01 | `01-design-system.md` | Tema (cores, SpaceGrotesk, componentes) |
| 02 | `02-networking-dtos.md` | Retrofit + DTOs + token store + auth refresh |
| 03 | `03-domain-models.md` | Enums, árvore de segmentos, flatten, modelos locais |
| 04 | `04-auth-session.md` | Login/Register + sessão + splash |
| 05 | `05-navigation-shell.md` | Gate de auth + bottom nav 5 abas |
| 06 | `06-location-service.md` | Localização + foreground service |
| 07 | `07-run-tracker.md` | RunTracker + SplitCalculator |
| 08 | `08-run-ui-live.md` | Pré-corrida + corrida ao vivo |
| 09 | `09-run-summary.md` | Resumo + salvar |
| 10 | `10-cue-system.md` | TTS + sons + haptics |
| 11 | `11-live-notification.md` | Notificação contínua (Live Activity equiv.) |
| 12 | `12-health-connect.md` | Health Connect (ler/gravar/detalhar) |
| 13 | `13-history-ui.md` | Histórico de corridas |
| 14 | `14-plan-data.md` | Plano: dados + ViewModel + cache |
| 15 | `15-plan-ui.md` | Plano: lista + calendário |
| 16 | `16-create-plan-ai.md` | Criar objetivo + gerar semana (IA) |
| 17 | `17-workout-detail-complete.md` | Detalhe + conclusão + feedback |
| 18 | `18-workout-components.md` | Componentes compartilhados |
| 19 | `19-dashboard.md` | Home feed |
| 20 | `20-profile-settings.md` | Perfil + settings |
| 21 | `21-notifications.md` | Lembretes locais |
| 22 | `22-billing-paywall.md` | Billing + paywall (stub) |
| — | `ENVIRONMENT.md` | Setup da máquina + rodar/testar |
