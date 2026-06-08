# 21 — Lembretes locais de treino

## 1. Objetivo
Notificações locais que lembram o usuário do treino do dia: agenda uma notificação às 7:00 da manhã de cada
dia de treino agendado futuro (do plano), reagendando quando o plano muda. Sem backend.

## 2. Stack & convenções
Ver `README.md`. Tudo em `core/notifications/`. Coroutines + DataStore. WorkManager/AlarmManager + `NotificationManager`.

## 3. Referência iOS (espelhar 1:1)
- `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/AthlyRunner/Services/NotificationService.swift`
  — singleton `@MainActor`:
  - `isEnabled` persistido em `UserDefaults` (key `athly_workout_reminders_enabled`), **default `true`**.
  - `reminderHour = 7` (07:00), `maxScheduled = 12` (limite de pendentes).
  - `requestAuthorization()` (alert/sound/badge); `requestAuthorizationIfNeeded()` só se `.notDetermined`.
  - `setEnabled(enabled, workouts)`: salva flag; se liga → pede permissão e `reschedule`; se desliga → `cancelAll`.
  - `reschedule(workouts)`: `cancelAll()` primeiro; só prossegue se `isEnabled` **e** permissão concedida.
    Filtra workouts: `status == .scheduled` **e** `sportType != .other`; calcula `reminderDate` (mesmo dia do
    treino às 07:00) e mantém só `fireDate > now`; ordena por data asc; pega os primeiros `maxScheduled` (12).
    Para cada: notificação com `title = "Treino de hoje"`, `body = workout.title`, som default, identificador
    `"workout-<id>"`, trigger de calendário (year/month/day/hour/minute, não repete).
  - `cancelAll()`: remove todas as pendentes.
  - `reminderDate(for:)`: components year/month/day de `workout.parsedDate` + hour=7, minute=0.
- Disparadores no app: `ProfileView` (toggle, 20) e mudanças de plano (`TrainingPlanViewModel`, 14/15)
  chamam `reschedule`/`setEnabled`. `WorkoutModel.parsedDate` = data parseada do workout.

## 4. Alvo Android
### `core/notifications/WorkoutReminderScheduler.kt`
- API espelhando o iOS: `isEnabled(): Flow<Boolean>` (default `true`), `setEnabled(enabled, workouts)`,
  `reschedule(workouts)`, `cancelAll()`. `enabled` persistido em **DataStore** (key `athly_workout_reminders_enabled`).
- Constantes idênticas: `REMINDER_HOUR = 7`, `MAX_SCHEDULED = 12`.
- `reschedule`: cancela tudo; aborta se `!enabled` ou sem permissão `POST_NOTIFICATIONS`; filtra
  `status == SCHEDULED && sportType != OTHER`; `fireDate` = data do workout às 07:00 local; mantém futuros;
  ordena asc; cap 12. Agenda um trigger por workout (id estável `"workout-<id>"`).
- **Agendamento**: preferir **`AlarmManager.setExactAndAllowWhileIdle`** (07:00 exato, sobrevive ao Doze) com
  `BroadcastReceiver` que posta a notificação; alternativa `WorkManager` com `OneTimeWorkRequest` por dia se
  exatidão não for crítica. Decidir e documentar no plano.

### `core/notifications/ReminderReceiver.kt` (se AlarmManager)
- `BroadcastReceiver` que monta a notificação (canal Athly), `title = "Treino de hoje"`, `text = <workout.title>`,
  ícone do app, autoCancel, deep-link p/ o detalhe do treino (17) opcional.

### `core/notifications/NotificationChannels.kt`
- Cria o canal `workout_reminders` ("Lembretes de treino", importância default) no boot do app.

### Permissão & manifest
- `POST_NOTIFICATIONS` (runtime, **Android 13+**) — pedir no toggle (20) e/ou após gerar o 1º plano (espelha
  `requestAuthorizationIfNeeded`). `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` se usar AlarmManager exato (Android 12+/13+).
- Receivers e (se preciso) `RECEIVE_BOOT_COMPLETED` para reagendar após reboot.

### Mapeamento de plataforma
- `UNUserNotificationCenter` → `NotificationManager` + `WorkManager`/`AlarmManager`.
- `UNCalendarNotificationTrigger` → `AlarmManager` (set exato) ou `WorkManager` (delay calculado).
- `UserDefaults` (flag) → **DataStore**. `removeAllPendingNotificationRequests` → cancelar alarms/work agendados.

## 5. Contrato de dados
Sem backend. Entrada = lista de workouts do plano (domínio, 03/14): cada um com `id`, `parsedDate`/data,
`status` (`SCHEDULED`), `sportType` (excluir `OTHER`), `title`. Flag local em DataStore.

## 6. Escopo
**In:** scheduler, canal, permissão runtime, persistência da flag, reagendar em mudanças de plano, cap 12,
exclusão de `OTHER`, só futuros, conteúdo "Treino de hoje" + título.
**Fora:** UI do toggle (vive no 20), notificações remotas/push, Live notification de corrida (11).

## 7. Dependências
`03-domain-models` (WorkoutModel/SportType/status), `14-plan-data` (fonte dos workouts + reagendar ao mudar),
`20-profile-settings` (toggle que liga/desliga).

## 8. Critérios de aceite
- Compila; ligar o toggle pede `POST_NOTIFICATIONS` (Android 13+) e agenda lembretes às 07:00 dos próximos
  dias de treino agendados, no máximo 12, excluindo `OTHER` e datas passadas.
- Notificação mostra "Treino de hoje" + título do workout; identificador estável evita duplicatas.
- Mudar o plano (14) reagenda (cancela e recria) sem duplicar; desligar o toggle cancela tudo.
- Flag persiste entre execuções (DataStore), default ligado.
- (AlarmManager) o lembrete dispara no horário mesmo com o app fechado / em Doze.

## 9. Pitfalls
- **Exact alarm**: Android 12+ exige `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` e o usuário pode revogar — checar
  `canScheduleExactAlarms()` e cair p/ WorkManager (inexato) se negado.
- **Doze/standby** pode atrasar; usar `setExactAndAllowWhileIdle`. Reagendar após reboot (`BOOT_COMPLETED`)
  pois alarms não persistem.
- **Idempotência**: sempre `cancelAll` antes de reagendar; usar ids determinísticos (`workout-<id>`) para não acumular.
- Sem `POST_NOTIFICATIONS` (Android 13+) o agendamento não deve postar — abortar como o iOS faz quando a permissão não foi concedida.
- Fuso/horário: calcular 07:00 **local** a partir da data do workout (cuidado com `parsedDate` sem hora).
