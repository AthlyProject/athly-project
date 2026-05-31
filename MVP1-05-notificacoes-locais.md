# MVP1 · 🟡 Workstream 5 — Notificações locais (engajamento)

> Decisão: lembretes via **notificação local no iOS** no MVP1 (sem push server-side / APNs, que
> fica para o MVP2). Cobre o essencial de engajamento sem infra de backend.

## Objetivo
Lembrar o usuário dos treinos agendados com notificações locais no iPhone, agendadas a partir do
plano e dos dias de treino, sem dependência de backend.

## Repos / arquivos afetados

### iOS (`athly-ios`) — novo `Services/NotificationService.swift`
- Pedir autorização `UNUserNotificationCenter` (alert/sound/badge) no onboarding (ou na 1ª vez que
  fizer sentido).
- Agendar notificações locais para o treino do dia/próximo, com base no plano (workouts `scheduled`)
  e nos `availableDays`/dias de treino do usuário.
- **Reagendar** quando o plano muda (nova semana gerada, treino concluído/pulado): cancelar
  pendentes e re-criar.
- Toggle em `Views/Profile/ProfileView.swift` (ou Settings) para ligar/desligar lembretes.
- Deep-link opcional: tocar na notificação abre o treino/dashboard.

## Checklist
- [x] `NotificationService` com request de permissão + agendamento/cancelamento
- [x] Agendamento a partir dos workouts `scheduled` futuros (lembrete às 7h do dia do treino, exclui `other`)
- [x] Reagendamento ao gerar nova semana e ao concluir/pular treino (via `loadData` + pós-geração)
- [x] Toggle de lembretes no perfil (persistido em `UserMetrics`/UserDefaults; pede permissão ao ligar)
- [ ] (Opcional) deep-link da notificação para o treino do dia — *não feito (opcional)*

## Critérios de aceite / verificação
- [ ] Com permissão concedida e dias definidos, o lembrete **dispara** no horário esperado
      (testar com data/hora próxima)
- [ ] Desligar o toggle cancela as notificações pendentes
- [ ] Gerar nova semana reagenda corretamente (sem duplicatas)
- [ ] iOS `xcodebuild` → BUILD SUCCEEDED

## Dependências / observações
- Sem dependência de backend (é tudo local). Push server-side (APNs) + resumo semanal são MVP2.
- Definir a regra de horário do lembrete (ex.: manhã do dia do treino, ou X horas antes).
