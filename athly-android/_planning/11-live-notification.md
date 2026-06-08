# 11 — Notificação contínua de corrida (equivalente à Live Activity)

## 1. Objetivo
Espelhar a Live Activity / Dynamic Island do iOS pela **notificação contínua do Foreground Service** de
localização: mostra título do treino, tempo, distância (km) e pace (/km), atualizada ~1Hz a partir do
`RunTracker` (07). Android não tem Dynamic Island — o equivalente é a notificação ongoing do FGS.

## 2. Stack & convenções
Ver `README.md`. `NotificationCompat` + `NotificationManager`. Amarrar ao Foreground Service iniciado no `06`.
Código em `feature/run/` (notificação) + reuso do FGS do `06`.

## 3. Referência iOS (espelhar 1:1)
- `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/AthlyRunner/Services/LiveActivityManager.swift`
  — ciclo de vida: `startActivity(workoutTitle:)`, `updateActivity(elapsedSeconds:distanceMeters:
  paceSecondsPerKm:)` (chamado **1×/seg** pelo tracker), `endActivity()`. Conteúdo dirigido por
  `ContentState { elapsedSeconds: Int, distanceMeters: Double, paceSecondsPerKm: Double }` + attribute
  `workoutTitle: String`. Trata "Live Activities desativadas pelo sistema" (no Android: usuário negou
  `POST_NOTIFICATIONS`/canal desligado).
- `/Users/.../AthlyRunnerLiveActivity/AthlyRunnerAttributes.swift` — o `ContentState` e os **formatters**
  (replicar EXATO):
  - `formattedTime`: `h>0` → `%d:%02d:%02d`, senão `%02d:%02d`.
  - `formattedDistance`: `%.2f` de `distanceMeters/1000`.
  - `formattedPace`: `--:--` se `≤0 / !finite / ≥3600`, senão `%d:%02d`.
- `/Users/.../AthlyRunnerLiveActivity/AthlyRunnerLiveActivityView.swift` — layout da lock screen (o que a
  notificação deve espelhar): badge "Athly" + "acompanhando sua corrida", selo "● AO VIVO", `workoutTitle`
  (se não vazio) e **3 métricas**: TEMPO (ícone timer), DISTÂNCIA "<km> km" (ícone ruler), PACE "<pace>/km"
  (ícone speedometer). Cor de destaque neon roxo `#bf40ff`/`secondary`. (Dynamic Island compact/expanded é
  iOS-only; documentar como FUTURO via Ongoing Activity / Wear OS.)

## 4. Alvo Android (`feature/run/`)
- **Canal de notificação** (`core/...` ou no FGS do `06`): `NotificationChannel` id ex. `run_tracking`,
  **`IMPORTANCE_LOW`** (sem som/heads-up), nome "Corrida em andamento". Criar no `Application`/serviço.
- **Notificação ongoing do FGS** — construída com `NotificationCompat.Builder`:
  - `setOngoing(true)`, `setOnlyAlertOnce(true)`, `setSilent(true)`, ícone pequeno do app, `setContentIntent`
    abrindo a `MainActivity` na corrida, categoria `CATEGORY_WORKOUT`.
  - **Conteúdo espelhando a lock screen iOS:** título = `workoutTitle` (ou "Corrida"); texto/linha = "TEMPO ·
    DISTÂNCIA · PACE" formatados. Usar **`RemoteViews` (layout custom)** para o visual das 3 métricas (timer/
    km/pace) com selo "AO VIVO" e cor neon, **ou** `NotificationCompat` com `BigTextStyle`/`setContentText`
    como versão simples. Acento neon roxo `#9d25f4`/`#bf40ff` no layout custom.
- **Atualização ~1Hz** a partir do `RunTracker`: o FGS coleta o `Flow` de estado do tracker (07) e chama
  `NotificationManager.notify(id, builder.build())` no máx. 1×/seg. **Throttle** para não floodar
  (`setOnlyAlertOnce` + reuso do builder; atualizar só quando os campos formatados mudam).
- **Ciclo de vida** (espelha start/update/end): notificação criada no `startForeground(...)` do `06`,
  atualizada durante a corrida, removida no `stopForeground(STOP_FOREGROUND_REMOVE)` ao finalizar/descartar.
- **Formatters idênticos** ao iOS (`formattedTime/Distance/Pace`) — reutilizar os formatters de
  `core/common` (03/08).

### Mapeamento de plataforma
| iOS | Android |
|---|---|
| ActivityKit Live Activity (lock screen) | Notificação **ongoing** do Foreground Service |
| Dynamic Island (compact/expanded/minimal) | **sem equivalente** — FUTURO: Ongoing Activity API / Wear OS |
| `Activity.request(...)` | `startForeground(id, notification)` (FGS do `06`) |
| `activity.update(content)` 1×/seg | `NotificationManager.notify(id, ...)` ~1Hz (throttled) |
| `activity.end(.immediate)` | `stopForeground(STOP_FOREGROUND_REMOVE)` |
| "Live Activities desativadas" | `POST_NOTIFICATIONS` negado / canal `IMPORTANCE_LOW` desligado |
| `ContentState` (elapsed/dist/pace) | mesmos 3 campos passados ao builder a cada tick |

## 5. Contrato de dados
Sem endpoint. Mesmos 3 campos do `ContentState` + `workoutTitle`, vindos do estado do `RunTracker` (07).
Formatação **idêntica** ao iOS (ver `AthlyRunnerAttributes`).

## 6. Escopo
**In:** canal de notificação (low/ongoing), notificação contínua espelhando a lock screen (título/tempo/
distância/pace, selo AO VIVO), update ~1Hz a partir do tracker, remoção no fim, integração com o FGS do `06`,
gate de `POST_NOTIFICATIONS` (Android 13+). Documentar Dynamic Island como FUTURO (Ongoing Activity/Wear OS).
**Fora:** o serviço de localização em si (06); a UI in-app (08); push remoto.

## 7. Dependências
`06-location-service` (o Foreground Service e seu `startForeground`), `07-run-tracker` (o `Flow` de estado
elapsed/dist/pace + `workoutTitle`).

## 8. Critérios de aceite
- Compila. Ao iniciar uma corrida, surge a notificação ongoing **não-descartável** com título do treino (ou
  "Corrida"), tempo, distância km e pace /km, atualizando ~1×/seg.
- Os valores formatados batem com a UI in-app e com o iOS (`%02d:%02d` / `%.2f` / pace `--:--` guard).
- A notificação some ao finalizar/descartar a corrida; o FGS para corretamente.
- Em Android 13+, sem `POST_NOTIFICATIONS` o app degrada graciosamente (FGS roda; pede a permissão no fluxo de início).

## 9. Pitfalls
- **Canal `IMPORTANCE_LOW`, ongoing, não-descartável** (`setOngoing(true)`); use `setOnlyAlertOnce`/`setSilent`
  para não tocar som/vibrar a cada update (isso é trabalho do `10`, não da notificação).
- **`POST_NOTIFICATIONS` (Android 13+):** peça em runtime; sem ela, a notificação não aparece mas o FGS pode
  rodar — não crashe.
- **Janela do FGS:** `startForeground(...)` tem de ser chamado **dentro do tempo permitido** após iniciar o
  serviço, com o `foregroundServiceType=location` (manifest + `startForeground` com o tipo). Falha → ANR/crash.
- **Throttle de update:** no máx. 1Hz; `notify()` excessivo causa jank e rate-limit do sistema — reutilize o
  builder e só atualize quando os campos formatados mudam.
- **Sem Dynamic Island:** não prometa paridade visual; o equivalente é a notificação. Anote Ongoing Activity
  API / Wear OS como upgrade futuro.
- Remova com `STOP_FOREGROUND_REMOVE` (API 24+) para a notificação sumir junto do serviço.
