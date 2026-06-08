# 17 — Detalhe do treino + conclusão + feedback

## 1. Objetivo
Tela de detalhe de um treino (badges, descrição, árvore de segmentos recursiva OU blocos legados, concluir/pular)
e o bottom sheet de conclusão em 2 passos (escolher corrida do Health → formulário de feedback).

## 2. Stack & convenções
Ver `README.md`. UI em `feature/workout/ui/`, ViewModel reusa `WorkoutRepository` (02). Compose + `StateFlow`.

## 3. Referência iOS (espelhar 1:1)
- `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/AthlyRunner/Views/Plan/WorkoutDetailView.swift`
  (header com badge "🎯 Treino-alvo" / `SportBadge` / `StatusBadge` / data longa / intensidade; seção descrição;
  **`SegmentNodeView` recursivo** — nós `set` com `N×` + filhos recolhíveis, nós folha com barra colorida por
  `kind`, label/fim/cue/notes/target; OU `BlockCardView` legado; `noBlocksCard`; botão "Concluir treino").
- `/Users/.../AthlyRunner/Views/Plan/WorkoutCompletionSheet.swift` (2 passos: **step1** carrega corridas do Health
  na janela [dia do treino, +2 dias], esconde já-linkadas, lista cards selecionáveis, ou "Apenas marcar como
  concluído"; **step2** feedback: toggle "Conseguiu completar?" (Sim/Não), slider Esforço 1–10, slider Fadiga 1–10,
  "Enviar feedback" → `submitWorkoutFeedback` → `onComplete(selectedRun)`; "Pular por agora").
- Conclusão com link real: `TrainingPlanViewModel.completeWorkoutWithHealthData` (cria `RunWorkoutLink` +
  `completeWorkout` com uuid/dist/dur); sem link: `completeWorkout`/`skipWorkout`.
> Leia os três por inteiro. Replicar a recursão de segmentos, a janela de 3 dias e os textos pt-BR.

## 4. Alvo Android
### `feature/workout/ui/WorkoutDetailScreen.kt`
- **Header card:** se `isGoalAttempt == true`, cápsula "🎯 Treino-alvo". Linha `SportBadge` (18) ←→ `StatusBadge`
  (18). Data por extenso (pt-BR, sem hora). Intensidade: ícone raio + "Intensidade {n}/10".
- **Descrição:** card "Descrição" (oculto se vazia).
- **Estrutura:** se `segments?.segments` não-vazio → "Estrutura do treino" + `SegmentNode` recursivo por raiz.
  Senão se `blocks` não-vazio → "Blocos do treino" + `BlockCard`. Senão → `noBlocksCard` ("Nenhum bloco definido…").
- **`SegmentNode` (composable recursivo):**
  - nó `set` (`kind == set`): linha clicável `${repetitions ?? 1}×` (SpaceGrotesk-Bold 18) + `label ?: "Série"` +
    chevron up/down; estado `expanded` local (default `true`); ao expandir, renderiza `children` com `padding-start 16.dp`,
    chamando `SegmentNode` em cada filho. Borda cyan @30%.
  - nó folha: barra lateral 4.dp colorida por `kind` (warmup=laranja, work=primary, recovery=azul, cooldown=teal,
    rest=cinza, else=secondary); `label ?: kindLabel` (Aquecimento/Tiro/Recuperação/Desaquecimento/Descanso/Bloco);
    fim formatado (dist→"m"/"km", dur→"m:ss"/"Xs"/"XhMM", reps→"X reps") na cor do kind; `cue ?: notes`;
    `targetRow` (ritmo `paceMin–paceMax`/"≥ pace", "Zona X", exercício).
- **Botões:** se `status == scheduled`, "Concluir treino" (`AthlyGradientButton`) abre o `WorkoutCompletionSheet`;
  expor também "Pular" (chama `skip`). Reaproveitar a paleta/labels do iOS exatamente.

### `feature/workout/ui/WorkoutCompletionSheet.kt` (`ModalBottomSheet`, 2 passos)
- Máquina de passos `Step { HEALTH, FEEDBACK }` + `initialStep` (default HEALTH). `selectedRun: HealthRunItem?`.
- **Passo HEALTH:** loading "Buscando corridas no Health Connect…". `workoutSummaryCard` (ícone do esporte + título
  + desc 2 linhas). Se há corridas: "Corridas próximas a {data}" + instrução "Selecione a corrida… (até 2 dias após
  o planejado)" + um card por corrida (hora, +1/+2 dias se aplicável, dist/tempo/pace em colunas) que ao tocar
  seta `selectedRun` e vai para FEEDBACK. Senão: `noRunsView`. Erro: `errorView`. Sempre: botão "Apenas marcar como
  concluído" (`selectedRun = null` → FEEDBACK).
- **Passo FEEDBACK:** header emoji (🎉 completou / 💪 não) + "Parabéns!"/"Bom trabalho!". `completionStatusCard`
  ("Conseguiu completar?" Sim/Não, botões com gradiente quando selecionados). `effortCard` (emoji por faixa, "{n}/10"
  primary, `Slider` 1..10 step 1 tint primary, labels Fácil/Moderado/Intenso). `fatigueCard` (idem, secondary, labels
  Energizado/Normal/Exausto). "Enviar feedback" (`AthlyGradientButton`) → `submitFeedback`; erro inline; "Pular por agora".
- Top bar: "Voltar" (FEEDBACK→HEALTH) ou "Cancelar" (dismiss). Título "Concluir Treino" / "Como foi o treino?".

### `feature/workout/WorkoutDetailViewModel.kt` (`@HiltViewModel`)
- `WorkoutRepository` (complete/skip/feedback, 02) + `HealthConnectManager` (12).
- `loadCandidateRuns(workout)`: janela `[startOfDay(date), +3 dias)`; `fetchLatestRuns(limit=30)`, filtra na janela,
  remove corridas já linkadas a outro treino (consulta `RunWorkoutLink`), ordena por início asc.
- `complete(workout, run?)`: se `run != null` → cria `RunWorkoutLink(run.id, workout.id)` + `complete` com
  `appleHealthWorkoutUUID`/dist/dur (no Android, o id da sessão do Health Connect ↔ campo `healthConnectId`/uuid);
  senão `complete` simples.
- `skip(workout)`, `submitFeedback(workoutId, completed, effort, fatigue)`.

## 5. Contrato de dados
- `PATCH /workouts/{id}/complete` → `WorkoutDto` (body opcional `CompleteWorkoutRequest`).
- `PATCH /workouts/{id}/skip` → `WorkoutDto`. `POST /workouts/{id}/feedback` (`WorkoutFeedbackRequest{completed,effort,fatigue}`).
- Domínio: `Segment` (árvore), `SegmentEndCondition`, `SegmentTarget`, `WorkoutBlock`, `HealthRunItem`,
  `RunWorkoutLink` (03).

## 6. Escopo
**In:** tela de detalhe (segmentos recursivos + blocos), sheet de conclusão 2 passos, link Health↔treino, feedback.
**Fora:** lista/calendário (15), criar plano (16), os badges/cards reutilizáveis em si (18 os define).

## 7. Dependências
`02-networking-dtos`, `03-domain-models`, `12-health-connect`, `18-workout-components`.

## 8. Critérios de aceite
- Compila; treino com `segments` renderiza a árvore (set `N×` recolhível + folhas coloridas por kind); treino
  legado renderiza blocos; treino vazio mostra `noBlocksCard`.
- Concluir abre o sheet; com corrida do Health na janela → seleciona, vincula (`RunWorkoutLink`), `complete` com
  dados reais; "Apenas marcar" conclui sem link; feedback envia `completed/effort/fatigue`.
- "Pular" muda status para skipped.

## 9. Pitfalls
- **Composable recursivo:** `SegmentNode` chama a si mesmo nos `children`; `expanded` é estado por nó. Evite recursão
  infinita (árvores reais são rasas) e preserve estado em recompose (`rememberSaveable`/key por `segment.id`).
- **Mapear sessão do Health Connect ↔ treino:** persista `RunWorkoutLink(healthConnectId, athlyWorkoutId)` e
  esconda corridas já linkadas a OUTRO treino na lista de candidatas (igual ao iOS `orphanCandidates`).
- **Janela de datas:** D até D+2 inclusive (`< startOfDay + 3 dias`); rotule "+1 dia"/"+2 dias" quando não for o dia.
- Sliders: `Int` 1–10, step 1; emojis por faixa idênticos ao iOS.
- Health Connect indisponível/negado → `errorView`, não crashe; "Apenas marcar" sempre disponível.
