# 13 — Histórico de corridas (Health Connect = fonte da verdade)

## 1. Objetivo
Tela de histórico que lista as últimas corridas lidas do **Health Connect** (não há store próprio de corridas):
cards com data/hora, distância, duração, pace, calorias e elevação. Espelha `HealthKitRunsView`.

## 2. Stack & convenções
Ver `README.md`. `feature/history/`. Compose + `@HiltViewModel` + `StateFlow`. Strings pt-BR idênticas.

## 3. Referência iOS (espelhar 1:1)
- `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/AthlyRunner/Views/HealthKit/HealthKitRunsView.swift`
  — `LazyVStack` de `HealthKitRunCard`; estados: `isLoading` (spinner), `isHealthUnavailable`, `errorMessage`,
  `isEmptyAfterLoad` (vazio), `runs`. Pull-to-refresh. Card: data/hora (hoje → só hora; senão data abreviada + hora),
  cabeçalho "Corrida" com ícone de corrida, 3 stats divididos (Duração | Distância | Pace) e rodapé com
  `"%.0f kcal"` (chama) e elevação `"%.0f m"` (montanha) quando `> 0`.
- `/Users/.../Views/History/HistoryView.swift` — só delega para `HealthKitRunsView(title: "Histórico")`.
- `/Users/.../ViewModels/HealthKitRunsViewModel.swift` — `State` enum (idle/loading/loaded/error/healthUnavailable);
  `loadWorkouts()`: se indisponível → `healthUnavailable`; senão `requestReadAuthorization()` +
  `fetchLatestRunningWorkouts(limit: 20)` → `loaded`. `retry()` reseta e recarrega.

> Strings exatas (pt-BR sem acento como no iOS): "Nenhuma corrida encontrada", "Nao ha corridas no Apple Health
> neste dispositivo...", "Apple Health indisponivel" → **adapte para "Health Connect"** no Android, mantendo o tom.

## 4. Alvo Android (`feature/history/`)
- `HistoryScreen.kt` — wrapper (title "Histórico") que renderiza `HealthRunsScreen`.
- `HealthRunsScreen.kt` — `LazyColumn` de `HealthRunCard`; `PullRefresh`/`pullToRefresh`; renderiza por
  `HealthRunsUiState` (Loading/HealthUnavailable/Error/Empty/Loaded). Fundo dark + gradientes radiais do tema (01).
  - `HealthRunCard(item: HealthRunItem)` — card (`AthlyCard`) com header data/hora + "Corrida", linha de 3 stats com
    divisores verticais, rodapé kcal/elevação. Use `Icons` Material equivalentes (run, flame, terrain) ou os do 01.
- `HealthRunsViewModel.kt` — `@HiltViewModel`, `StateFlow<HealthRunsUiState>`; injeta `HealthConnectManager` (12).
  `load()`: checa disponibilidade → `HealthUnavailable`; senão pede read auth via gate (12) e
  `readRunningSessions(limit = 20)` → `Loaded(runs)`/`Empty`; erro → `Error(msg)`. `retry()`.
- `HealthRunsUiState` (sealed): `Loading`, `HealthUnavailable`, `Error(String)`, `Empty`, `Loaded(List<HealthRunItem>)`.
- Formatação reusa os `formatted*` do `HealthRunItem` (03): `formattedDistance` (`%.2f`), `formattedDuration`
  (`H:MM:SS`/`MM:SS`), `formattedPace` (`M:SS` ou `--:--`). Data/hora: hoje → hora curta; senão data abreviada + hora.

## 5. Contrato de dados
Sem rede. Lê só do Health Connect via `HealthConnectManager.readRunningSessions` (12) → `HealthRunItem` (03).

## 6. Escopo
**In:** tela de histórico, card, ViewModel, estados, pull-to-refresh. **Fora:** detalhe de corrida, vincular a
treino prescrito, gravar (já em 09/12).

## 7. Dependências
`12` (Health Connect), `05` (nav-shell/aba), `01` (design system).

## 8. Critérios de aceite
- Compila; a aba Histórico lista as últimas 20 corridas do Health Connect com os mesmos campos do iOS.
- Estados corretos: sem provider → "Health Connect indisponível" (com botão Tentar novamente); sem corridas →
  empty; erro → mensagem + retry; carregando → spinner.
- Pull-to-refresh recarrega. Cards mostram hoje só com hora; demais com data + hora.

## 9. Pitfalls
- Não criar store de corridas: a fonte é o Health Connect (sobrevive a reinstalação, inclui treinos de outros apps).
- Trocar "Apple Health" → "Health Connect" nos textos, mantendo o resto idêntico.
- `formattedPace` deve retornar "--:--" quando pace ≤ 0 / não-finito (mesma regra do iOS).
- Pedir read auth dentro do `load()` (gate só pede uma vez) — não bloquear a UI se negado, mostrar empty/erro.
