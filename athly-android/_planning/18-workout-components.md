# 18 — Componentes compartilhados (cards, badges, mapa)

## 1. Objetivo
Composables reutilizáveis e stateless usados pelo plano/detalhe/dashboard/resumo: card de treino, badges de
esporte/status, cards de insight da IA (semana atual + anterior + análise) e o mapa estático de rota.

## 2. Stack & convenções
Ver `README.md`. Em `core/designsystem/component/` (ou `feature/common/`). **Stateless + `@Preview`**. Cores via
`AthlyTheme`; cards via `Modifier.athlyCard`/`athlyInsightCard` (01).

## 3. Referência iOS (espelhar 1:1)
- `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/AthlyRunner/Views/Components/WorkoutCardView.swift`
  (modos `compact`/expandido + `isNext`; badge 🎯; header esporte+título / status+"Próximo treino"; descrição;
  rodapé data + intensidade colorida + "IA").
- `/Users/.../Components/SportBadgeView.swift` (ícone + `sport.label`, cápsula glass borda primary @30%).
- `/Users/.../Components/StatusBadgeView.swift` (labels Concluído/Agendado/Parcial/Pulado + cores success/primary/warning/error).
- `/Users/.../Components/WeeklyGoalInsightCard.swift` (`WeeklyGoalInsightCard` com trend + métricas; +
  `PreviousWeekFeedbackCard` com `previousWeekAnalysis`).
- `/Users/.../Components/AnalysisSummaryCard.swift` (`AnalysisSummaryCard` + `AnalysisSummarySheet`).
- `/Users/.../Components/SummaryMapView.swift` (mapa estático: polyline secondaryNeon + marcadores start/end —
  **também usado pelo prompt 09**).
> Leia os seis. Replicar labels pt-BR, faixas de cor e os textos de trend exatamente.

## 4. Alvo Android
### `WorkoutCard.kt`
- Params `(workout, compact = false, isNext = false)`. `compact` reduz spacing/fonte e oculta descrição.
- Topo: cápsula 🎯 "Treino-alvo" se `isGoalAttempt == true`. Header: `SportBadge` + título (lineLimit 2) ←→
  `StatusBadge` + "Próximo treino" (primaryNeon, uppercase) se `isNext`. Descrição (lineLimit 3, só não-compact).
  Rodapé: data abreviada (calendar) · "Intensidade {n}" com cor por faixa (1–3 success / 4–6 warning / else error) ·
  "IA" (sparkles, secondary) se `trainingPlanId != null`. `Modifier.athlyCard(glow = isNext)`.

### `SportBadge.kt`
- Ícone por `SportType` (Material/emoji equivalente ao `sfSymbol` do iOS) + `sport.label` (pt-BR de 03). Cápsula
  glass, texto/ícone primary, borda primary @30%.

### `StatusBadge.kt`
- `WorkoutStatus` → label/cor: done→"Concluído"/success, scheduled→"Agendado"/primary, partial→"Parcial"/warning,
  skipped→"Pulado"/error. Cápsula bg cor @15%, borda @40%, uppercase.

### `WeeklyGoalInsightCard.kt` + `PreviousWeekFeedbackCard.kt`
- **Insight:** só renderiza se `metrics.fitnessInsights` não-vazio. Header "Meta da Semana" (target) + trendBadge
  (`improving*`→"Em alta"/success, `maintaining`→"Estável"/primary, `declining`→"Em baixa"/warning, else raw).
  Texto (lineLimit 4). Chips Vol. alvo / Pace ref. / Corridas anal. `athlyInsightCard`.
- **PreviousWeek:** só se `previousWeekAnalysis != null`. Header "Semana Anterior" (clock.arrow) + badge
  `completionRate` (% colorido ≥0.8 success / ≥0.5 warning / else error). `adherenceNote`. Chips Treinos
  (`completed/total`), Distância (`%.1f km`), Volume (increase→"↑ Mais", decrease→"↓ Menos", maintain→"= Igual").
  Card surfaceCard + overlay secondary @8%, borda secondary @25%.

### `AnalysisSummaryCard.kt` (+ `AnalysisSummarySheet`)
- Card: "Análise dos seus treinos" (sparkles) + `fitnessInsights` (lineLimit 4) + chips Período/Corridas/Média
  (`%.1f km`)/Pace + "Tendência:" `trendLabel` + (se `isInteractive`) "Toque para ver o resumo completo" + chevron.
  `athlyInsightCard`. `trendLabel`: "improving (volume)"→"Em alta (volume)", "improving (intensity)"→"Em alta
  (intensidade)", "maintaining"→"Estável", "declining"→"Em baixa".
- Sheet (`ModalBottomSheet`): "Leitura da Athly" + insights + grid de métricas (período, corridas, dist média/total,
  pace, FC média se > 0).

### `SummaryMap.kt` (Maps Compose)
- `GoogleMap` estático (sem scroll/zoom/rotate/tilt, POIs ocultos) a partir de `List<LatLng>`. `Polyline`
  secondaryNeon largura 3; `Marker`/círculo start (success) e end (error); câmera ajustada ao `LatLngBounds` da rota
  com padding ~20. Render só com ≥ 2 pontos. Reutilizado pelo 09.

## 5. Contrato de dados
N/A direto — consome modelos de domínio (03): `WorkoutModel`/`Workout`, `SportType`, `WorkoutStatus`,
`WeeklyGoal`(+`metrics`,`previousWeekAnalysis`), `RunAnalysis`, `RoutePoint`/`LatLng`.

## 6. Escopo
**In:** os 7 composables acima + previews. Mapeamento de cores/labels por sport/status idêntico ao iOS.
**Fora:** lógica de dados/ViewModels; telas que os consomem (15/17/19/09).

## 7. Dependências
`01-design-system`, `03-domain-models`.

## 8. Critérios de aceite
- Compila; cada composable tem `@Preview` (claro de dados mock) e renderiza nos modos relevantes (`WorkoutCard`
  compact/expandido/isNext; badges para cada `SportType`/`WorkoutStatus`).
- Cores e labels batem com o iOS (intensidade, status, trend, volume).
- `SummaryMap` desenha polyline + marcadores e enquadra a rota; sem pontos suficientes, não desenha.

## 9. Pitfalls
- **Stateless + preview-able:** sem `ViewModel`/IO nos componentes; recebem dados por parâmetro.
- **Cores por SportType/status DEVEM bater** com o iOS (use as constantes de `AthlyTheme`, não cores ad-hoc).
- Cards de insight só aparecem quando os campos opcionais existem (espelhe os `guard let` do iOS — `EmptyView`).
- Maps Compose exige API key + `MapsInitializer`; o mapa é estático (desabilite gestos) para casar com o iOS.
- `WorkoutCard` mostra "IA" por `trainingPlanId != null` e 🎯 por `isGoalAttempt == true` — não confundir.
