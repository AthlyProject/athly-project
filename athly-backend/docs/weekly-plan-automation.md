# Geração automática de semanas de treino

Implementa a issue #12 usando o mesmo `AiPlannerService.planFromHealth`, Gemini,
SQS, polling e notificações APNs já existentes. Não altera prompts ou critérios
do planejamento. A primeira geração continua disponível pelo fluxo atual.

## Gatilhos

- Ao concluir (`done`/`partial`) ou pular manualmente o último treino pela data
  agendada, fecha a semana. Se houver vários treinos nessa data, todos precisam
  estar em estado terminal. Descansos (`sportType=other`) não contam. Nesse fechamento,
  marca os treinos reais ainda `scheduled` como `skipped` e reserva a geração da
  segunda-feira seguinte na mesma transação, com motivo `last_workout`.
- Ao autenticar ou voltar ao app, a retomada gera os dias disponíveis restantes da
  semana atual quando ela ainda não tiver sido gerada. Sem dias restantes, aguarda
  uma abertura na semana seguinte; não antecipa a próxima semana.
- Não há fechamento por horário no domingo. O worker verifica a cada minuto apenas
  para recuperar fechamentos pelo último treino finalizado e envios pendentes à fila.
  A passagem do tempo, sozinha, não altera treinos nem inicia gerações.
- Só são elegíveis planos `ACTIVE`, `autoGenerate=true`, com entitlement válido
  pelas regras atuais e um contexto de saúde sincronizado pelo app atualizado.
  Sem contexto/fuso, não há suposição nem backfill de semanas anteriores à adesão.
- Desvincular/corrigir um treino de uma semana fechada continua permitido. Não
  reabre a semana nem cancela ou refaz a próxima geração.
- Reagendamento só dentro da mesma semana de segunda a domingo (iOS e API).

## Dados e entrega

`POST /ai-planner/health-context` recebe o DTO atual do planner, `timeZone` e
`capturedAt`. Guarda até 20 corridas e 7 sessões detalhadas. Um upload antigo não
substitui uma captura mais recente. UUIDs identificam corridas já conhecidas;
execuções e métricas salvas no backend complementam o snapshot antes de gerar.
O fuso local também determina se uma corrida de domingo à noite pertence à semana.

O iOS sincroniza ao autenticar, voltar ao foreground e receber um `HKObserverQuery`
de workouts, com background delivery. Complete/skip também incluem uma captura
quando disponível. Falha de leitura, dados protegidos ou rede adiam a sincronização;
o backend usa o último snapshot disponível. Não há silent push. A entrega do HealthKit em aparelho
continua sujeita ao sistema operacional e às permissões do usuário.

A resposta de complete/skip inclui `nextWeekGeneration` quando fecha uma semana.
O app mostra o aviso e acompanha o job existente. `GET
/ai-planner/plan-from-health/generations/latest` permite descobrir a geração de
outro dispositivo ou de uma recuperação em background, mesmo se a notificação não chegar. Erros da geração
aparecem separados dos erros ao salvar o treino. O push de conclusão existente
continua sendo criado junto com a persistência dos treinos.

`closedAt` e o lock da semana serializam os gatilhos e as alterações de treino.
A unicidade de job por usuário/semana e a reserva de dispatch evitam reenvios normais.
Se SQS falhar, o job fica pendente no banco e o worker tenta publicar novamente.
Duplicatas do SQS são aceitas, mas o consumer precisa adquirir um lease para executar.
Há heartbeat, backoff e até 3 tentativas. Um worker que perde o lease não pode
persistir o resultado nem sobrescrever o status do novo worker. Depois de `FAILED`,
o endpoint async existente permite tentativa explícita para a mesma `weekStartDate`.

## Ativação

1. Usar Node 22.12+ (validado com 22.22.0), instalar dependências e gerar Prisma.
2. Aplicar `prisma migrate deploy` antes de iniciar o backend atualizado. A migration
   `20260914160000_weekly_plan_automation` é aditiva; jobs anteriores mantêm o registro
   de que já foram enviados à fila.
3. Manter SQS e APNs configurados como no fluxo existente. Nenhuma fila nova é exigida.
4. Publicar o iOS com o entitlement
   `com.apple.developer.healthkit.background-delivery`; o perfil de assinatura deve
   incluir essa capacidade. O projeto Xcode e `project.yml` estão atualizados.
5. No App Runner, criar a chave `WEEKLY_PLAN_AUTOMATION_ENABLED` dentro do segredo
   `prod/BackEnd/Athly`, com valor textual `true` para habilitar ou `false` para
   desabilitar. O `apprunner.yaml` referencia essa chave em `run.secrets`.
   Fazer um novo deploy do backend após alterar o valor: o App Runner carrega os
   segredos durante o deploy. Criar a chave sem referenciá-la na configuração do
   serviço não a disponibiliza ao backend. Em desenvolvimento local, configurar
   a variável no ambiente; o padrão em `.env.example` e no código permanece `false`.

Desabilitar a flag interrompe novos fechamentos automáticos e retomadas. Jobs já reservados
continuam sendo enviados/processados. A flag não desfaz `skipped` nem semanas geradas.
O log `weekly_plan_closed` informa motivo, semana alvo, generationId e idade do
snapshot em segundos; não registra o conteúdo de saúde. Monitorar também erros de
closure/dispatch, jobs `FAILED` e leases expirados.

A remoção do gatilho de domingo exige deploy do backend atualizado em todas as
instâncias; não exige migration nem novo build do iOS. Registros históricos com
`closureReason=sunday` e jobs já enfileirados são preservados, inclusive os que
anteciparam uma semana pela regra anterior. A alteração não ativa a flag.

## Validação

- `npm test -- --runInBand`: testes unitários, incluindo horário local/DST.
- `npm run build` e `npx tsc --noEmit`.
- Integração com banco PostgreSQL descartável, migrado antes da execução:

  ```sh
  WEEKLY_AUTOMATION_TEST_DATABASE_URL='<URL do banco isolado de teste>' \
    npx jest --config test/jest-e2e.json --runInBand weekly-plan-automation
  ```

  Esse teste só usa a variável dedicada, cria usuários próprios e os remove ao
  terminar. Não usar um banco de produção. Cobre concorrência real, rollback,
  elegibilidade, snapshot, conclusão, ausência de fechamento por horário,
  retomada restrita à semana atual e recuperação/duplicatas da fila;
  Gemini/SQS são substituídos por doubles, sem chamadas externas.

- iOS: testes do scheme `AthlyRunner` e builds para simulador e dispositivo.
- Em aparelho assinado: autorizar HealthKit/notificações, concluir o último treino,
  conferir snackbar e push, gravar uma corrida com app em background e observar a
  sincronização, testar bloqueio/desbloqueio do aparelho, reabertura após domingo e
  acesso sem rede. Validar a geração real e APNs no ambiente de homologação.

Android não entra nesta mudança.

## Retomada ao abrir o app

Após login ou retorno ao foreground, o iOS compartilha uma única tarefa de
sincronização + `POST /ai-planner/resume`. O body aceita apenas `retryFailed`
(opcional, `false`). A resposta contém `weekStartDate`, `generation` (mesmo contrato
de status existente, ou `null`) e `started`. O observador HealthKit não chama esse
endpoint. Logout cancela a tarefa e impede que seu resultado atualize outra sessão.

A retomada exige a mesma flag/eligibilidade da automação e pelo menos uma semana
anterior gerada com treinos reais. Sem contexto de saúde salvo, aguarda nova
sincronização. Uma falha de atualização pode usar o snapshot anterior. O onboarding
continua responsável pela primeira geração.

O backend calcula o alvo no fuso salvo: apenas a semana atual, com os dias
disponíveis de hoje até domingo. Domingo permanece elegível após 23h, até a virada
local para segunda-feira. Sem dias disponíveis restantes, retorna
`{ weekStartDate: null, generation: null, started: false }`, sem alterar semanas,
treinos ou jobs, inclusive em uma tentativa explícita de retry. Uma
semana alvo `GENERATED`, `LOCKED` ou `CANCELLED` é preservada; um esqueleto `PLANNED`
permite gerar. Nunca são criadas semanas para preencher o período de ausência.

Ao reservar a retomada, semanas `GENERATED` anteriores à segunda-feira atual e
que ainda estejam abertas recebem `closedAt`/`closureReason=resume`. Apenas seus
treinos reais `scheduled` viram `skipped`. Semanas bloqueadas, conclusões, treinos
parciais, descansos e correções em semanas já fechadas são preservados. Fechamento e
reserva são atômicos, com lock do plano antes dos locks de semana, compartilhado com
os outros gatilhos. A entrada inclui também as corridas da semana atual.

O payload JSON persiste `resumeWindow` com semana, fuso, dias elegíveis e data mínima.
O consumer avança a data mínima se executar em outro dia, mantendo a semana do job.
Uma janela sem dias restantes, inclusive após a virada local de semana, termina
como `FAILED` imediatamente, sem transferir o job para outra semana e sem gastar três
tentativas no gerador. A reabertura reaproveita o job; não reseta falhas da mesma
semana. O botão **Tentar novamente** envia `retryFailed=true`, recalcula a janela e
usa os dados disponíveis mais recentes. A fila, os prompts e o push são os existentes.

Não há migration adicional para a retomada. Ativar a flag somente depois que todas
as instâncias do backend estiverem atualizadas, pois consumidores antigos não
interpretam a janela parcial salva no payload. Validar em aparelho a abertura após
um período sem treinos, o aviso, a conclusão/push e o retry explícito. Monitorar o
evento `weekly_plan_resumed`, com motivo, semana alvo e generationId.
