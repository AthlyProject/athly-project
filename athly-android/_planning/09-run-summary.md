# 09 — Run Summary + persistência local + disparo do Health write

## 1. Objetivo
Recriar a tela de resumo da corrida (mapa da rota com polyline, 6 stat cards, lista de splits por km, botão
salvar + estado de salvamento) e a persistência local da `RunSession` (Room), disparando em seguida a gravação
no Health Connect via interface `HealthRepository.saveRun(...)` (a gravação real é o prompt 12).

## 2. Stack & convenções
Ver `README.md`. Compose + Hilt + `StateFlow`. Mapa: **Maps Compose**. Persistência: **Room** (recomendado).
Tela em `feature/run/ui/`, store em `core/data/`.

## 3. Referência iOS (espelhar 1:1)
- `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/AthlyRunner/Views/Run/RunSummaryView.swift`
  — `ScrollView` em fundo dark. Header: `checkmark.circle.fill` (success, 56), "Corrida finalizada!"
  (`heading 22`), subtítulo com `startDate` formatado (data abreviada + hora curta). Depois, se há `lastRunResult`:
  **mapa da rota** (`SummaryMapView`, altura 200, raio de card, só se `!locations.isEmpty`), **statsGrid**
  (`LazyVGrid` 2 colunas, 16 spacing) e **splitsSection** (se `!splits.isEmpty`). Rodapé: estado de save
  (`isSaving` → spinner "Salvando corrida..."; `saveError` → `wifi.slash` + msg em warning) + botão
  `AthlyGradientButtonStyle` que mostra "Corrida salva!"/`checkmark` quando `isSaved`, senão "Salvando...",
  `disabled = isSaving`, ação `dismissSummary()`. `.task { await viewModel.saveRun(runStore:) }` dispara o save
  ao aparecer. (A sheet de feedback de treino prescrito é do `17`, não aqui.)
- **6 stat cards** (`statCard`, ícone primary + valor `heading 20` + label `body 12`, `.athlyCard()`):
  1. **Distancia** `%.2f km` (`distanceMeters/1000`)
  2. **Duracao** `formatDuration` (h:%02d:%02d se ≥1h, senão %02d:%02d)
  3. **Pace medio** `formatPace` (`%d:%02d /km`; guarda `--:--` se `≤0 / !finite / ≥3600`)
  4. **Elevacao** `%.0f m`
  5. **Calorias** `%.0f kcal`
  6. **Splits** `count` (número de splits)
- **splitsSection**: título "Splits" (`semibold 17`); lista de linhas "Km \(kilometer)" (`medium 16`) ↔
  `formattedPace` (`SpaceGrotesk-SemiBold 16` monospaced, primary) + "/km", com `Divider` `borderDark` entre
  itens, dentro de card `surfaceCard` + gradiente sutil + borda gradiente, raio de card.
- `/Users/.../Views/Components/SummaryMapView.swift` — mapa estático (scroll/zoom/rotate/pitch off):
  polyline `secondaryNeon` lw3, **marker verde** (`success`) no início, **marker vermelho** (`error`) no fim,
  e `setVisibleMapRect(polyline.boundingMapRect, edgePadding: 20)` para **enquadrar a rota**.
- `/Users/.../Services/RunStore.swift` — persistência local: `@Published sessions: [RunSession]`, `add`
  (insere no índice 0), `update`, `delete`, `sortedSessions` (por `startDate` desc), e save/load de
  `run_sessions.json` em Documents com escrita **atômica**, `JSONEncoder/Decoder` ISO8601. **No Android use Room**
  (ou DataStore) em vez do JSON atômico.
- `/Users/.../ViewModels/RunViewModel.swift` (`saveRun`) — fluxo de save: monta `RunSession` a partir do
  `RunResult` (start/end, dist, dur, pace médio, elevação, kcal, status="completed", `routePoints`, `splits`),
  `runStore.add(session)`, depois **best-effort** grava no Health (não bloqueia, falha silenciosa). Seta
  `isSaving=false; isSaved=true`. (No iOS é HealthKit-first: a corrida fica durável no Health; o backend só
  guarda coaching. Espelhar essa filosofia — não persistir a corrida crua no backend aqui.)
- `RunResult`/`SplitData` em `/Users/.../Services/RunTracker.swift` (L397-426) — formato dos dados de saída.

## 4. Alvo Android
### `RunSummaryScreen.kt` (`feature/run/ui/`)
- `Column`/`LazyColumn` em fundo dark espelhando o layout: header (check success + textos pt-BR + data),
  **`SummaryMapScreen`** (Maps Compose), **`StatsGrid`** (6 cards 2 colunas via `LazyVerticalGrid` ou
  `Row`/`Column` aninhados), **`SplitsSection`** (lista km↔pace), rodapé de save + botão gradiente.
- `SummaryMapScreen`: `GoogleMap` (gestos off via `uiSettings`), `Polyline` da rota cor `secondaryNeon`
  (`#bf40ff`/`#9d25f4`-neon — usar o mesmo hex do iOS) largura ~3dp, `Marker` verde (start) e vermelho (end),
  **câmera ajustada à rota** com `LatLngBounds.builder()` + `CameraUpdateFactory.newLatLngBounds(bounds, padding)`
  (≈20–40dp). Aplicar o bounds no `onMapLoaded`/`LaunchedEffect`.
- Formatters de duração/pace **idênticos** ao iOS (sec/km → `M:SS`; guardas de pace/divisão por zero).

### `RunStore` (`core/data/`, Room recomendado)
- `RunSessionEntity` + DAO (`@Insert`, `@Update`, `@Delete`, `@Query` ordenado por `startDate` desc →
  espelha `sortedSessions`) + `RunStore` (repositório) expondo `Flow<List<RunSession>>` e `add/update/delete`.
  Persistir rota/splits como tabelas filhas (`@Relation`) ou JSON em coluna (`routePoints`, `splits`).
- Mapear `RunResult` (07) → `RunSession` (03) → entity. `id` UUID, `synced=false`, `status="completed"`.

### Save flow (no `RunViewModel` do `08`, completado aqui)
1. Persistir local: `runStore.add(session)`.
2. Disparar **`healthRepository.saveRun(runSession): Result<String?>`** (interface declarada aqui;
   **implementação real no `12`**) — best-effort, falha **não bloqueia** nem reverte o save local. Em sucesso,
   guardar o `healthConnectId` retornado (para o `RunWorkoutLink` / `completeWorkout` do `17`).
3. `isSaving=false; isSaved=true`; expor `saveError` se o local falhar.

### Mapeamento de plataforma
| iOS | Android |
|---|---|
| `MKPolyline` + `setVisibleMapRect` | `Polyline` + `CameraUpdateFactory.newLatLngBounds` |
| markers start/end via `MKAnnotation` | `Marker(state)` verde/vermelho (ou `BitmapDescriptor` colorido) |
| `RunStore` JSON atômico em Documents | **Room** (`@Entity`/DAO) ou DataStore |
| `HealthKitService.saveWorkout` | `HealthRepository.saveRun(...)` (interface; impl no `12`) |
| `.task { await saveRun }` | `LaunchedEffect(Unit) { viewModel.saveRun() }` |

## 5. Contrato de dados
Sem endpoint de corrida (HealthKit-first). Usa `RunSession`/`RoutePoint`/`Split` (03) e `RunResult`/`SplitData` (07).
`HealthRepository.saveRun(...)` é a fronteira para o `12`.

## 6. Escopo
**In:** `RunSummaryScreen` (mapa+6 cards+splits+save), Room `RunStore` (persistência local de `RunSession`),
disparo do `HealthRepository.saveRun` (best-effort), estados isSaving/isSaved/saveError.
**Fora:** implementação real do Health Connect write (12); histórico/listagem (13); sheet de feedback do treino
prescrito (17); sync com backend (não há — coaching só).

## 7. Dependências
`07-run-tracker` (`RunResult`/`SplitData`), `03-domain-models` (`RunSession`/`RoutePoint`/`Split`),
`08-run-ui-live` (o `RunViewModel` e o switch de telas). Health write delegado ao `12`.

## 8. Critérios de aceite
- Compila. Ao finalizar uma corrida, o resumo mostra rota (polyline enquadrada com markers), os **6 cards**
  com os valores corretos e a **lista de splits por km** com pace `M:SS`.
- O save persiste a `RunSession` no Room (verificável: aparece em `sortedSessions`/histórico do `13`).
- `HealthRepository.saveRun(...)` é chamado (stub do `12` pode só logar/retornar `success(null)`); falha dele
  **não** quebra o save local. Estados isSaving→isSaved refletem na UI; botão fecha o resumo.

## 9. Pitfalls
- **Formatação de pace = iOS:** `sec/km → M:SS`; **guarde pace infinito/zero** (`≤0`, `!isFinite`, `≥3600` → `--:--`),
  inclusive em splits e no pace médio.
- `LatLngBounds` com 0/1 ponto crasha — só ajuste a câmera com `coordinates.size >= 2`; trate rota vazia
  (esconder o mapa, igual ao iOS `if !locations.isEmpty`).
- Não persistir a corrida crua no backend (a fonte de verdade do histórico é o Health Connect, lido no `12/13`).
- Save local e Health write são **independentes**: ordene local-primeiro; o Health é best-effort e não deve
  reverter nem bloquear a UI.
- Room: rode em `Dispatchers.IO`; exponha via `Flow` para a UI reagir; não bloqueie a thread principal no save.
