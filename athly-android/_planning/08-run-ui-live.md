# 08 — Run UI: pré-corrida + corrida ao vivo

## 1. Objetivo
Recriar as telas de pré-corrida (gate de GPS + preview do mapa + botão "INICIAR") e de corrida ao
vivo (timer grande, métricas, banner do segmento atual com anel de progresso, controles pause/resume/stop),
dirigidas por um `RunViewModel` que envelopa o `RunTracker` (07).

## 2. Stack & convenções
Ver `README.md`. Compose + Hilt + `StateFlow`. Mapa: **Maps Compose** (Google Maps). Tudo em `feature/run/ui/`.

## 3. Referência iOS (espelhar 1:1)
- `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/AthlyRunner/Views/Run/RunStartView.swift`
  — pré-corrida: container `NavigationStack` que troca entre `preRunView` / `RunTrackingView` / `RunSummaryView`
  conforme `viewModel.isActive` / `viewModel.showSummary`. `preRunView`: `LocationSnapshotMap` (mapa estático
  travado, `showsUserLocation`, região 400m) sob gradiente escuro top→bottom (0.3/0.6/0.85). Se **sem permissão**
  → `permissionView` (ícone `location.slash`, texto pt-BR; botão "Permitir localizacao" → `requestAlwaysPermission()`,
  ou "Abrir Ajustes" se `denied/restricted`). Se **com permissão** → `readyView`: indicador de GPS
  ("● GPS ativo" verde se `currentLocation != nil`, senão spinner "Buscando GPS..." em warning), título
  "Pronto para correr?", e o **botão circular grande "INICIAR"** (130x130, `Gradient.neon`, anel externo 148x148
  stroke `primaryNeon.opacity(0.3)`), `disabled` + `opacity 0.5` enquanto `currentLocation == nil`.
- `/Users/.../Views/Run/RunTrackingView.swift` — ao vivo: fundo dark + 2 `RadialGradient` ambiente
  (primary @0.2,0.15 r300; secondary @0.85,0.85 r250). Layout vertical: `mainTimeDisplay` (timer
  `SpaceGrotesk-Bold 72`, monospaced, `minimumScaleFactor 0.6`, label "TEMPO") → `segmentBanner`
  (só se `tracker.currentSegment != nil`) → `metricsGrid` (card 2x2: **KM**, **PACE /KM**, **ELEVACAO (M)**,
  **KCAL**; cada célula com ícone primary, valor `SpaceGrotesk-Bold 32` monospaced) → `controlsPanel`.
  Controles: se **rodando** → 1 botão pause (80x80, warning); se **pausado** → botão stop (64x64, error) +
  botão resume (80x80, `Gradient.neon`). Stop abre `confirmationDialog` "Finalizar corrida?" com
  "Finalizar e salvar" (`finishRun`), "Descartar" (destrutivo, `discardRun`), "Continuar correndo" (cancel,
  resume se pausado).
- **`CurrentSegmentBanner`** (struct privado em `RunTrackingView.swift`): linha principal em card
  (`surfaceCard`, raio 16, borda `kindColor.opacity(0.45)`) com `progressRing` (44x44, trim = `progress`
  clamp 0..1, `rotationEffect(-90)`, animação linear 1s) + `labelStack` (label do segmento `semibold 15`;
  badge "idx/total" se `setIndex`/`setTotal`; **remainingText** = `endSummary` da distância/tempo/reps
  RESTANTE, `SpaceGrotesk-Bold 22`) + `skipButton` (`chevron.right.2` → `tracker.skipSegment()`). Abaixo,
  pílula "A seguir: <label> · <endSummary(next.end)>" se `nextSegment != nil`. `kindColor`: warmup=orange,
  work=primary, recovery=blue, cooldown=teal, rest=gray, default=primary.
- `/Users/.../Views/Run/RunMapView.swift` — overlay de rota ao vivo (polyline `secondaryNeon` lw4, pino
  verde de início `success`, segue o usuário com região 300m enquanto `isTracking`). **No Android este mapa
  ao vivo é opcional** na tela de corrida (o iOS não o exibe no `RunTrackingView` — só no pré-corrida e no
  resumo); inclua apenas o preview de pré-corrida aqui e deixe o polyline completo para o `09`.
- `/Users/.../ViewModels/RunViewModel.swift` — fonte do `RunViewModel`: `tracker: RunTracker`, `showSummary`,
  `lastRunResult: RunResult?`, `isSaving/isSaved/saveError`, `pendingWorkout` (`didSet` →
  `tracker.loadPlaylist(...)`). `startRun()` (pede permissão se faltar; senão seta peso e `tracker.start()`),
  `pauseRun/resumeRun/finishRun/discardRun/dismissSummary`. `isActive = state ∈ {running,paused}`.
- `/Users/.../Views/MainTabView.swift` (L24-29) — a `FloatingTabBar` é escondida via
  `safeAreaInset { if !isRunInProgress { FloatingTabBar(...) } }`; `isRunInProgress = isActive || showSummary`.

## 4. Alvo Android (`feature/run/ui/`)
- **`RunViewModel.kt`** (`@HiltViewModel`) — envolve o `RunTracker` (07). Expõe `StateFlow<RunUiState>`
  combinando o estado do tracker (`elapsedSeconds`, `distanceMeters`, `currentPaceSecondsPerKm`,
  `elevationGain`, `calories`, `currentSegment`, `nextSegment`, `segmentProgress`, `state`) + `showSummary` +
  flags de save. Ações: `start()`, `pause()`, `resume()`, `finish()`, `discard()`, `dismissSummary()`,
  `skipSegment()`, `setPendingWorkout(WorkoutModel?)` → `tracker.loadPlaylist(...)`. `isActive`/`isRunInProgress`
  computados. Coleta o `Flow` do tracker e mapeia para o UiState (1Hz).
- **`RunStartScreen.kt`** — `preRun`: `Box` com **map preview** (Maps Compose, `GoogleMap` com
  `uiSettings` tudo desabilitado, `isMyLocationEnabled`, câmera fixa ~zoom 15 na posição atual) + `Brush`
  vertical escuro por cima. Permissão: usar `rememberMultiplePermissionsState`
  (`ACCESS_FINE_LOCATION`) — Accompanist Permissions ou API nativa; `permissionContent` vs `readyContent`
  espelhando os textos pt-BR. Botão circular "INICIAR" (`Box`/`Canvas` 130dp, gradiente neon, anel externo),
  `enabled = currentLocation != null`. Trocar entre `RunStartScreen`/`RunTrackingScreen`/`RunSummaryScreen`
  via `when(uiState)` no nível do nav-host da feature.
- **`RunTrackingScreen.kt`** — `Column` central: `MainTimeDisplay` (SpaceGrotesk-Bold 72sp, `digit`),
  `CurrentSegmentBanner` (composable separado), `MetricsGrid` (card 2x2 com `AthlyCard`/borda gradiente),
  `ControlsPanel` (pause/resume/stop circulares). Stop → `AlertDialog`/`ModalBottomSheet` de confirmação
  com as 3 ações.
- **`CurrentSegmentBanner.kt`** — anel de progresso via `drawArc` em `Canvas` (startAngle -90, sweep =
  `progress*360`, `StrokeCap.Round`, `animateFloatAsState`), `labelStack` com badge idx/total, `remainingText`,
  botão skip. Pílula "A seguir". Replicar `endSummary` e `kindColor` (mapear `.teal/.blue/.orange/.gray` para
  os hex equivalentes; teal≈`#14b8a6`, blue≈`#3b82f6`, orange≈`#f97316`, gray≈`#9ca3af`).
- **`RunMapPreview.kt`** (opcional, reutilizável) — `GoogleMap` estático para o pré-corrida.
- **Esconder a bottom nav** durante a corrida: o `RunViewModel` (ou um estado de sessão compartilhado no
  shell do `05`) expõe `isRunInProgress`; o `AthlyNavHost`/scaffold (05) oculta a `NavigationBar` quando true.
- **Manter a tela acesa:** `WindowCompat`/`window.addFlags(FLAG_KEEP_SCREEN_ON)` (ou
  `KeepScreenOn` via `DisposableEffect` num `View`/`LocalView.keepScreenOn`) enquanto `isActive`.

### Mapeamento de plataforma
| iOS | Android |
|---|---|
| `MKMapView` snapshot estático | `GoogleMap` (Maps Compose) com `uiSettings` off, câmera fixa |
| `MKMapView` `showsUserLocation` | `properties = MapProperties(isMyLocationEnabled = true)` (+ permissão) |
| `confirmationDialog` | `AlertDialog` ou `ModalBottomSheet` |
| `CHHapticEvent`/anel `trim` | `Canvas.drawArc` + `animateFloatAsState` |
| `UIApplication.openSettingsURLString` | `Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)` |
| `safeAreaInset` esconde tab bar | scaffold do `05` oculta a `NavigationBar` quando `isRunInProgress` |
| keep awake automático (tela ativa) | `FLAG_KEEP_SCREEN_ON` / `keepScreenOn` |

## 5. Contrato de dados
Nenhum endpoint. Consome o estado do `RunTracker` (07) e os modelos `ActiveSegment`/`SegmentEndCondition`/
`SegmentKind`/`RunResult` (03/07). Formatters de tempo/distância/pace **idênticos** ao iOS (ver `formatted*`
no `RunTracker`/`SplitData`): pace `--:--` quando `≤0 / !finite / ≥3600`.

## 6. Escopo
**In:** `RunViewModel`, `RunStartScreen`, `RunTrackingScreen`, `CurrentSegmentBanner`, preview de mapa,
gate de permissão de localização, keep-screen-on, esconder bottom nav.
**Fora:** o resumo (09), os cues de áudio/voz/haptic (10), a notificação contínua (11), persistência (09),
Health write (12). O `RunMapView` ao vivo completo (polyline) não é necessário — o iOS não o mostra na tela de corrida.

## 7. Dependências
`07-run-tracker` (estado/ações), `05-navigation-shell` (host + esconder nav), `01-design-system`
(cores, SpaceGrotesk, `AthlyCard`, botões neon).

## 8. Critérios de aceite
- Compila. Sem permissão de localização, a tela mostra o gate pt-BR e o botão de permissão; concedida,
  aparece o preview do mapa + "● GPS ativo" + botão "INICIAR" habilitado quando há fix.
- Tocar "INICIAR" inicia o tracker e a UI passa para a tela ao vivo; timer/dist/pace/elevação/kcal atualizam ~1Hz.
- Com um treino prescrito carregado (`setPendingWorkout`), o `CurrentSegmentBanner` exibe label, anel de
  progresso, restante e "A seguir", e o skip avança o segmento.
- Pause/resume/stop funcionam; stop pede confirmação (finalizar/descartar/continuar). A tela **não apaga**
  durante a corrida e a **bottom nav some**.

## 9. Pitfalls
- **Recomposição a 1Hz tem de ser barata:** isole o tick num único `StateFlow`; evite recriar `Brush`,
  formatters e listas a cada frame; use `derivedStateOf`/`remember` e composables `@Stable`.
- `FLAG_KEEP_SCREEN_ON` deve ser **removido** ao sair da corrida (limpe no `onDispose`).
- A bottom nav deve sumir tanto em `isActive` quanto em `showSummary` (igual ao iOS `isRunInProgress`).
- Maps Compose: `isMyLocationEnabled` exige `ACCESS_FINE_LOCATION` concedido **antes** de habilitar, senão crasha.
- Pace/tempo: use exatamente as mesmas regras de formatação do iOS (monospaced, guardas de pace).
- Permissão: o iOS pede `Always` (background); aqui peça `ACCESS_FINE_LOCATION` na pré-corrida e deixe o
  `ACCESS_BACKGROUND_LOCATION` para o fluxo do `06` (não bloqueie o INICIAR por background).
