# 07 — RunTracker + SplitCalculator

## 1. Objetivo
Máquina de estados da corrida (idle/running/paused/finished) que calcula distância, tempo, pace ao vivo e
médio, ganho de elevação, calorias, splits por km e progressão da playlist de segmentos — mais o
`SplitCalculator` com constantes **idênticas** ao iOS.

## 2. Stack & convenções
Ver `README.md`. Tudo em `domain/run/`. Classe pura (sem Compose); `StateFlow` para métricas. Coroutines +
Flow. Sem dependência de UI.

## 3. Referência iOS (espelhar 1:1 — LER OS DOIS POR INTEIRO)
- `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/AthlyRunner/Services/RunTracker.swift`
- `/Users/.../AthlyRunner/Services/SplitCalculator.swift`
> **RunTracker:** estado `idle/running/paused/finished`. Em `start()`: zera tudo, inicia tracking +
> timer 1s + assina o `locationUpdates` (todos os pontos), e dispara o cue `boundary(to: playlist.first)`.
> `pause()`/`resume()` somam `pausedDuration`. `stop()` calcula duração final (`now - start - paused`), pace
> final (`dur / km`), monta `RunResult` (com `buildSplits()` = `SplitCalculator.kmSplits`) e reseta.
> - **Distância** (`processNewLocation`): só conta se `state==running`. Para cada ponto: append em
>   `locations`/rota/altitude. Com `lastLocation`: `delta=distância`, `dt=Δtimestamp`,
>   `impliedSpeed=delta/dt`; se `impliedSpeed > maxPlausibleSpeed (7.0)` → **descarta o ponto sem atualizar
>   `lastLocation`** (salto de GPS). Senão soma `delta` em `distanceMeters`.
> - **Elevação:** se `altitude-lastAlt > 0.5` → soma em `elevationGain` (só positivo).
> - **Pace ao vivo:** janela deslizante de **20s** sobre os fixes de GPS. Se o gap até o último da janela
>   `> paceGapResetSeconds (6)` → **zera a janela** (não cruza buraco de GPS). Mantém só os fixes ≤20s;
>   com ≥2 fixes, `windowDist>5` e `windowTime>0` → `currentPace = windowTime/windowDist*1000`.
> - **Pace médio:** `elapsedTime / (distanceMeters/1000)`.
> - **Split ao vivo:** `currentKm = Int(dist/1000)`; ao virar o km, atualiza `currentSplitKm`.
> - **Calorias** (no tick): `(distanceKm) * userWeightKg * 1.036` (peso default 70).
> - **Tempo** (tick 1s): `elapsed = now - start - paused`; só roda em `running`.
> - **Segmentos** (`checkSegmentBoundary`, chamado no tick e por ponto): para o segmento ativo, por `end.by`:
>   - `distanceM`: `done=dist-segStartDist`, `remaining=end.value-done`. Se `!countdownFired && pace>0 &&
>     remaining>0` e `eta = remaining*pace/1000 <= 3.5s` → dispara `countdown3`. Se `done>=end.value` →
>     `advanceSegment`.
>   - `durationSec`: `done=elapsed-segStartElapsed`, `remaining=end.value-done`. Se `!countdownFired &&
>     remaining>0 && remaining<=3.0s` → `countdown3`. Se `done>=end.value` → `advanceSegment`.
>   - `reps`: só skip manual.
>   - `advanceSegment(skipped)`: `activeSegmentIndex++`, reseta `countdownFired`, `segStartDist=dist`,
>     `segStartElapsed=elapsed`. `isSetDone = !skipped && setIndex!=nil && setIndex==setTotal`. Se for fim de
>     set → cue `setComplete(label, setTotal)` e, **após 1.4s**, `boundary(to: próximo)`. Senão →
>     `boundary(to: próximo)` imediato. `skipSegment()` chama `advanceSegment(skipped:true)`.
> - **RunResult:** startDate, endDate, distanceMeters, durationSeconds, averagePaceSecondsPerKm,
>   elevationGainMeters, caloriesBurned, locations[], splits[].
>
> **SplitCalculator** (algoritmo único, idêntico ao usado no Health): constantes **maxPlausibleSpeed=7.0**,
> **gapCapSeconds=6.0**, **stationarySpeed=0.5**, **startMovementMeters=20.0**, **minTrailingMeters=50.0**.
> `normalize()`: ordena por timestamp; para cada ponto `dt>0`, `impliedSpeed=delta/dt`; se
> `impliedSpeed>maxPlausibleSpeed` → **ignora sem avançar `lastGood`**; `timeStep = (dt>gapCapSeconds &&
> impliedSpeed<stationarySpeed) ? 0 : dt` (parado/pausa não conta tempo; blackout correndo conta); acumula
> `cumDistance`/`cumTime`. `kmSplits()`: **âncora** = primeiro sample com `distance>=startMovementMeters`
> (descarta tempo parado inicial); `runDistance=last-anchor`; exige `>=minTrailingMeters`. Para cada km
> cheio, fronteira `anchor.distance + km*1000`, **interpola** (data/movingTime/altitude) por distância;
> split tem `distanceMeters=1000`, `durationSeconds=max(0, atTime-prevTime)`. Km parcial final só se
> `leftover>=minTrailingMeters`. `paceSecondsPerKm = dur/(dist/1000)`.

## 4. Alvo Android (`domain/run/`)
### `RunTracker.kt`
- Classe (injetável, escopo da corrida) com `StateFlow<RunMetrics>` contendo: `state`
  (idle/running/paused/finished), `distanceMeters`, `elapsedSeconds`, `currentPaceSecPerKm`,
  `averagePaceSecPerKm`, `elevationGain`, `calories`, `currentSplitKm`, `activeSegmentIndex`,
  `routePoints: List<LatLng/RoutePoint>`, `currentAltitude`.
- Dirigido pelo `Flow<Location>` (06) + um **ticker de 1s** (coroutine/`flow{}` ou `ticker`). `start/pause/
  resume/stop/discard`, `loadPlaylist(WorkoutSegments?)` (= `flatten()`, 03), `skipSegment()`.
- Replica **todas** as fórmulas/constantes acima: filtro de salto (7.0 m/s), elevação (0.5m), pace janela 20s
  com reset em gap >6s, pace médio, calorias `km*pesoKg*1.036`, detecção de km, máquina de segmentos
  (countdown ETA 3.5s distância / 3.0s duração, boundary no início, setComplete com delay 1.4s).
- `stop()` retorna `RunResult` (mesmos campos) com `splits = SplitCalculator.kmSplits(locations)`.
- **Emite eventos de cue** para o `CueOrchestrator` (prompt 10): `Countdown3`, `Boundary(activeSegment)`,
  `SetComplete(label, total)`. Defina o tipo `RunCue` (sealed) aqui; o orquestrador real é o 10.

### `SplitCalculator.kt`
- `object`/companion com as **mesmas constantes**. `fun kmSplits(locations: List<RoutePoint/Location>):
  List<KmSplit>` (03) — porta exata de `normalize`/`interpolate`/`kmSplits` (âncora de primeiro movimento,
  exclusão de pausa/gap, interpolação linear de fronteiras de km, km parcial final).

### Mapeamento de plataforma
| iOS | Android |
|---|---|
| `Timer.scheduledTimer(1s)` | coroutine ticker 1s (`flow{ while… delay(1000) }`) |
| `@Published` métricas | campos de um `RunMetrics` em `StateFlow` |
| `CLLocation.distance(from:)` | `Location.distanceTo()` / Haversine sobre `RoutePoint` |
| `locationUpdates` (Combine) | `Flow<Location>` (06) |
| `CueOrchestrator.shared.fire(...)` | emitir `RunCue` para o CueOrchestrator (10) |
| `Date()` / `TimeInterval` | `System.currentTimeMillis()` / segundos `Double` |

## 5. Contrato de dados
Sem rede. Consome `Flow<Location>` (06) e `WorkoutSegments`/`ActiveSegment` (03); produz `RunMetrics`,
`RunResult`, `KmSplit` (03) e `RunCue` (para o 10).

## 6. Escopo
**In:** `RunTracker` (state machine + métricas + segmentos + cues) e `SplitCalculator` portado exato, com
**testes unitários** do SplitCalculator. **Fora:** UI da corrida (08), TTS/sons reais (10), notificação viva
(11), persistência/salvar (09).

## 7. Dependências
`03-domain-models`, `06-location-service`.

## 8. Critérios de aceite
- Compila. Métricas atualizam ao consumir um fluxo de pontos; pause exclui o tempo parado.
- Máquina de segmentos avança nas fronteiras, dispara countdown na ETA correta (3.5s dist / 3.0s dur),
  boundary no início e `setComplete` no fim de set (com delay de 1.4s antes do próximo boundary).
- **TESTES UNITÁRIOS do `SplitCalculator`** espelhando a validação do iOS, no mínimo:
  - **standing start excluído**: tempo parado antes de `startMovementMeters (20m)` não conta no km 1.
  - **pausa/gap excluído**: gap grande com `impliedSpeed<0.5` não soma tempo (`timeStep=0`).
  - **salto de GPS rejeitado**: ponto com `impliedSpeed>7.0` é ignorado (não infla distância nem pula `lastGood`).
  - fronteiras de km por interpolação; km parcial final só com `leftover>=50m`; pace por split = `dur/(dist/1000)`.

## 9. Pitfalls
- **Constantes exatas**: 7.0 / 6.0 / 0.5 / 20.0 / 50.0 / janela 20s / elevação 0.5 / calorias ×1.036 / ETA
  3.5 (dist) e 3.0 (dur) / delay setComplete 1.4s. Qualquer divergência muda os números vs iOS.
- Salto de GPS: **não avançar `lastLocation`/`lastGood`** ao descartar (medir o próximo a partir do último bom).
- Pace ao vivo: **zerar a janela** quando o gap > 6s (senão cruza o buraco e mostra pace lento).
- `checkSegmentBoundary` roda **tanto no tick quanto por ponto** — não disparar countdown/boundary duplicado
  (use `countdownFired`).
- Tempo/elapsed sempre `now - start - paused` e só em `running`; calorias usam o **peso real** do usuário (04).
- Manter o `SplitCalculator` como **algoritmo único** (mesmo usado depois na rota do Health Connect, 12) —
  não criar uma segunda versão divergente.
