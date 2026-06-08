# 05 — Shell de navegação (gate de auth + bottom nav 5 abas)

## 1. Objetivo
`AthlyNavHost` com gate de autenticação (deslogado → grafo de auth; logado → grafo principal) e bottom nav
com 5 abas via um `FloatingTabBar` custom (animado, escondido durante uma corrida).

## 2. Stack & convenções
Ver `README.md`. Navigation-Compose. Shell em `core/navigation/`, componente em
`core/designsystem/component/`. As telas de cada aba são **placeholders** (telas reais vêm em prompts depois).

## 3. Referência iOS (espelhar 1:1)
- `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/AthlyRunner/Views/MainTabView.swift`
- `/Users/.../AthlyRunner/Views/Components/FloatingTabBar.swift`
- `/Users/.../AthlyRunner/Views/RootView.swift` (gate logado/deslogado + splash)
> **Comportamento:**
> - **MainTabView**: `switch selectedTab` entre `dashboard/plan/run/history/profile`. O `FloatingTabBar` é
>   um `safeAreaInset(.bottom)` que **só aparece quando `!isRunInProgress`** (some durante a corrida). Estado
>   `pendingWorkout` passado entre Dashboard↔Run; `isRunInProgress` controlado pela tela de corrida.
> - **AppTab** (enum): `dashboard, plan, run, history, profile`. Títulos: **Home, Plan, Run, History, Profile**.
>   Ícones SF: `house.fill, calendar, figure.run, clock.fill, person.fill`.
> - **FloatingTabBar**: `HStack` de 5 botões; cada um ícone + título empilhados. Ícone do **run maior**
>   (22 vs 18). Selecionado → `primary`, senão → `textTertiary`. Troca animada easeInOut 0.2. Fundo
>   `surfaceDark.opacity(0.95)` + ultraThinMaterial, cantos 20, borda `glassBorder`, sombra, padding
>   horizontal 16 / vertical 12.

## 4. Alvo Android
### `core/navigation/AthlyNavHost.kt`
- `NavHost` raiz com **gate**: observa `AuthViewModel.uiState.isAuthenticated` (04).
  - Deslogado → **auth graph** (`login`, `register` — telas do 04).
  - Logado → **main graph** (host com bottom nav).
- Coordena o splash com o gate (mínimo 850ms + `hasFinishedInitialSessionRestore`, ver 04). Mudança de
  auth troca de grafo (limpar back stack: `popUpTo(graph) { inclusive }`).
- `core/navigation/Destinations.kt`: rotas type-safe (sealed/enum) para `Dashboard, Plan, Run, History, Profile`
  + grafos `AuthGraph`/`MainGraph`.

### `MainScaffold` (host do main graph)
- `Scaffold` com `NavHost` interno (5 destinos → **placeholders** `*PlaceholderScreen` owned por prompts
  futuros) e `bottomBar = { if (!isRunInProgress) FloatingTabBar(...) }`.
- `isRunInProgress` exposto por um estado compartilhado (ex.: VM de escopo do main graph ou um `StateFlow`
  do RunTracker/RunViewModel) — a barra **anima sumindo/aparecendo** (`AnimatedVisibility`, slide/fade) ao
  iniciar/encerrar a corrida.

### `core/designsystem/component/FloatingTabBar.kt`
- 5 itens (`AppTab`), título + ícone Material (`Home, CalendarMonth, DirectionsRun, History, Person`), ícone
  do **run maior**. Selecionado `primary`, senão `textTertiary`, transição animada. Fundo
  `surfaceDark @0.95` + blur (aprox. ultraThinMaterial), cantos 20, borda `glassBorder`, sombra, paddings 16/12.
- `AppTab` enum em domínio/navegação com `title` pt-BR (Home/Plan/Run/History/Profile) e ícone.

### Mapeamento de plataforma
| iOS | Android |
|---|---|
| `switch selectedTab` + `@State` | Navigation-Compose + bottom nav (`selectedItem` por destino) |
| `safeAreaInset(.bottom)` condicional | `Scaffold(bottomBar=…)` + `AnimatedVisibility(!isRunInProgress)` |
| SF Symbols | Material Icons |
| `.ultraThinMaterial` | blur/translucência aproximada (`graphicsLayer`/cor translúcida) |
| environment objects globais | estado compartilhado via Hilt / VM de grafo |

## 5. Contrato de dados
Nenhum endpoint. Consome só `AuthUiState` (04) e o flag `isRunInProgress` (run feature, posterior).

## 6. Escopo
**In:** NavHost com gate, grafos auth/main, `MainScaffold`, `FloatingTabBar`, `AppTab`, placeholders das 5
abas, ocultar a barra durante corrida. **Fora:** conteúdo real das telas (prompts 08+, 13, 15, 19, 20),
lógica de auth (04).

## 7. Dependências
`04-auth-session`.

## 8. Critérios de aceite
- Compila. Deslogado abre no grafo de auth; após login navega ao main graph com a bottom nav (back stack limpo).
- 5 abas trocam de placeholder; aba selecionada destacada em `primary`, ícone do Run maior.
- Setar `isRunInProgress=true` esconde a `FloatingTabBar` com animação; voltar a `false` a traz de volta.
- Logout volta ao grafo de auth.

## 9. Pitfalls
- Trocar de grafo no logout/login deve **limpar o back stack** (não acumular telas).
- A barra precisa **animar** ao sumir/aparecer (não toggle seco) e respeitar insets/IME.
- Placeholders devem expor a mesma rota que os prompts futuros vão substituir (não renomear depois).
- Títulos pt-BR/labels idênticos (Home, Plan, Run, History, Profile).
