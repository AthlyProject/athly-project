# Geração semanal com confirmação

A primeira geração continua pertencendo ao onboarding. As gerações seguintes
exigem confirmação explícita; salvar um treino, abrir o app e o sweep periódico
não fecham semanas nem reservam novos jobs.

## Elegibilidade

- Última data de treino da semana atual: todos os treinos reais dessa data em
  `done`, `partial` ou `skipped` liberam a semana seguinte. Descansos não contam.
- Depois da virada local de domingo para segunda, uma semana atual ainda ausente
  pode ser gerada para os dias disponíveis restantes. Sem dias restantes, aguarda
  a próxima semana; não há backfill de semanas ausentes.
- Mantêm-se plano ACTIVE, autoGenerate, entitlement, contexto/fuso e flag
  WEEKLY_PLAN_AUTOMATION_ENABLED. Semanas GENERATED, LOCKED e CANCELLED são preservadas.

## Contrato

`POST /ai-planner/resume` sem `confirmed: true` é apenas consulta. Retorna
`weekStartDate`, `generation`, `started: false` e `pendingGeneration` opcional:
`{ trainingPlanId, sourceWeeklyGoalId, weekStartDate, reason }`.
O motivo é `last_workout` ou `resume`. Jobs em andamento não oferecem nova geração.
`retryFailed` isoladamente nunca inicia uma geração.

Após atualizar o contexto de saúde, confirmar enviando `confirmed: true`,
`trainingPlanId`, `weekStartDate` e, para nova tentativa, `retryFailed: true`.
O servidor revalida o alvo e a condição sob locks de plano e semanas. Mudança de
alvo ou perda de elegibilidade retorna 409; o app consulta novamente e pede nova
confirmação. Confirmações concorrentes reutilizam o job único por usuário/semana.
Só então semanas abertas são encerradas e treinos reais scheduled viram skipped.
Correções de semanas já encerradas são preservadas.

## iOS e entrega

Modal com período e lembrete de revisão, Gerar agora, Agora não e fechar.
Ao dispensar, o botão permanece na aba Plano e abre a mesma modal; ela reaparece
na próxima abertura/retorno do background. Feedback, corrida e importação têm
prioridade de apresentação. Logout limpa ofertas e invalida tarefas.
Polling, SQS, recuperação de envios e APNs existentes permanecem.

Publicar o backend antes do iOS. Clientes antigos deixam de gerar automaticamente;
precisam atualizar para confirmar. Não há migration. Jobs previamente reservados
continuam sendo processados. Android não recebe interface nesta mudança.

## Validação

`npm run build`; testes de calendário; suite PostgreSQL isolada:
`WEEKLY_AUTOMATION_TEST_DATABASE_URL=... npx jest --config test/jest-e2e.json --runInBand weekly-plan-automation`.
Nunca apontar essa variável para produção. A suite cobre consultas sem mutações,
confirmação, duplicatas, rollback, correções, datas locais, retries e fila.
iOS: WorkoutModelDateTests e builds do scheme AthlyRunner.
