# Plano de Observabilidade do Athly iOS

## Objetivo

Criar uma base de observabilidade no `athly-ios` que permita detectar, reproduzir e priorizar problemas encontrados durante testes em device real, inclusive quando o iPhone nao estiver plugado no Mac.

O foco inicial nao e analytics de produto. O foco e diagnostico tecnico:

- crashes
- erros nao fatais
- timeouts e falhas de rede
- problemas de permissao e background
- inconsistencias no fluxo de corrida
- contexto suficiente para entender o que aconteceu antes da falha

## Contexto Atual

Hoje o app tem pouca observabilidade centralizada.

- O bootstrap do app em `AthlyRunner/AthlyRunnerApp.swift` nao inicializa nenhuma camada de monitoramento.
- A rede em `AthlyRunner/Services/APIClient.swift` ainda depende de `print` em partes criticas, especialmente em erro de decode.
- O fluxo principal de corrida passa por `RunTracker.swift`, `LocationManager.swift`, `RunViewModel.swift` e `LiveActivityManager.swift`, mas quase nao gera breadcrumbs estruturados.
- Falhas de `HealthKit`, persistencia local e sincronizacao com backend sao silenciosas ou pouco contextualizadas.
- O backend esta na AWS, entao vale planejar correlacao entre erros do app e logs/request IDs do servidor.
- Firebase nao faz parte do stack atual e nao deve ser assumido no desenho.

## Decisao Recomendada

### Recomendacao principal

Usar `Sentry` no iOS como primeira camada de observabilidade do app, com uma camada propria chamada algo como `Observability` para evitar acoplamento direto do codigo de negocio ao SDK.

Essa recomendacao atende melhor o problema atual porque:

- resolve crash reporting de app mobile sem trabalho customizado de symbolication e agrupamento
- permite registrar erros nao fatais com contexto
- suporta breadcrumbs para reconstruir a sequencia de acoes antes da falha
- permite capturar spans de performance e operacoes criticas de rede
- encaixa bem em testes internos/TestFlight
- nao depende de Firebase

### Papel da AWS nessa arquitetura

O backend continua na AWS e entra como fonte complementar de diagnostico:

- logs estruturados no backend
- `request_id` por requisicao
- correlacao entre evento do iOS e request do servidor
- alarmes e dashboards do lado servidor separados do app

Em outras palavras: observabilidade do app e observabilidade do backend devem conversar, mas nao precisam nascer da mesma ferramenta.

## Alternativa AWS-first

Se a prioridade estrategica for manter o maximo possivel dentro da AWS, existe um caminho alternativo:

- app envia diagnosticos para um endpoint proprio
- esse endpoint grava eventos em SQS/S3/CloudWatch
- processamento posterior gera trilhas de erro e dashboards internos

Esse caminho nao e o recomendado para a fase 1 porque aumenta muito o trabalho:

- agrupamento de erros
- deduplicacao
- symbolication de crash
- anexos e breadcrumbs
- UI de investigacao
- retenção e busca

Faz sentido apenas se houver restricao forte de vendor externo ou exigencia de stack unificada.

## Metas da Fase Inicial

1. Saber quando o app crashou ou travou.
2. Saber em qual fluxo isso aconteceu.
3. Saber qual chamada de rede falhou e com qual contexto.
4. Saber em que estado estava uma corrida ativa.
5. Conseguir relacionar o erro do app com logs do backend na AWS.
6. Dar ao tester uma forma simples de reportar um problema com contexto.

## Sinais que Devem Ser Capturados

### Erros

- crashes fatais
- erros nao fatais capturados manualmente
- erros de decode
- erros de timeout
- erros de autorizacao
- falhas de `HealthKit`
- falhas de localizacao
- falhas na `Live Activity`
- falhas de persistencia local

### Breadcrumbs

- app abriu
- login iniciado, concluido e falhou
- sessao restaurada
- corrida iniciada, pausada, retomada, finalizada, descartada
- tentativa de salvar corrida localmente
- tentativa de salvar corrida no HealthKit
- tentativa de sincronizar corrida com backend
- geracao de plano iniciada, timeout, polling, sucesso e falha
- permissao de localizacao mudou
- `scenePhase` mudou para active/inactive/background
- atualizacao e encerramento de `Live Activity`

### Performance

- duracao de requests HTTP criticos
- requests que passam por retry apos refresh de token
- tempo de geracao de plano
- tempo de salvar corrida
- operacoes lentas no startup

## Arquitetura Proposta

### Camada 1: SDK de observabilidade no app

Adicionar o SDK via Swift Package Manager e declara-lo no `project.yml`, mantendo a integracao no nivel do app e da extensao apenas se realmente necessario.

Configuracoes esperadas:

- `dsn`
- `environment` (`debug`, `internal`, `release`)
- `release` com versao + build
- `sample rate` para tracing
- politica de anexar PII desligada por padrao

### Camada 2: wrapper interno

Criar uma camada propria com uma API pequena, por exemplo:

- `Observability.start()`
- `Observability.setUser(id:)`
- `Observability.clearUser()`
- `Observability.addBreadcrumb(...)`
- `Observability.capture(error:context:)`
- `Observability.startSpan(...)`
- `Observability.setTag(...)`

Objetivo:

- reduzir dependencia direta do codigo de negocio no provider
- facilitar troca futura de provider
- centralizar redacao, sanitizacao e convencoes de contexto

### Camada 3: correlacao com backend AWS

Padronizar um identificador por request, por exemplo:

- `X-Athly-Request-Id`
- `X-Athly-Session-Id`
- `X-Athly-Run-Id` quando existir corrida em andamento

O app envia os identificadores.
O backend registra os mesmos IDs nos logs estruturados.
Assim fica possivel seguir um problema de ponta a ponta.

## Pontos de Instrumentacao no Codigo Atual

### Boot e ciclo de vida

- `AthlyRunner/AthlyRunnerApp.swift`
- `AthlyRunner/Views/RootView.swift`

Capturar:

- inicializacao do SDK
- tags de versao/build/ambiente
- transicoes de `scenePhase`
- duracao da restauracao de sessao inicial

### Autenticacao

- `AthlyRunner/ViewModels/AuthViewModel.swift`
- `AthlyRunner/Services/APIClient.swift`

Capturar:

- login/register/logout
- refresh de token
- falhas de autenticacao
- estado de sessao restaurada

### Rede

- `AthlyRunner/Services/APIClient.swift`

Capturar:

- metodo e path
- status code
- duracao da request
- timeout
- retry apos `401`
- decode failure com tipo alvo
- resposta truncada apenas em build interna e sem PII sensivel

### Corrida e localizacao

- `AthlyRunner/ViewModels/RunViewModel.swift`
- `AthlyRunner/Services/RunTracker.swift`
- `AthlyRunner/Services/LocationManager.swift`
- `AthlyRunner/Services/LiveActivityManager.swift`
- `AthlyRunner/Services/RunStore.swift`

Capturar:

- inicio/pausa/retomada/fim/descarte de corrida
- autorizacao de localizacao
- erros de GPS
- quantidade de pontos coletados
- tentativa de salvar localmente
- tentativa de salvar no HealthKit
- tentativa de sincronizar com backend
- falha de `Live Activity`

### Plano e IA

- `AthlyRunner/ViewModels/TrainingPlanViewModel.swift`

Capturar:

- inicio da geracao
- caminho usado: `planNextWeek` vs `planFromHealth`
- timeout
- inicio e fim de polling
- sucesso/falha da carga de plano

### HealthKit

- `AthlyRunner/Services/HealthKitService.swift`
- `AthlyRunner/Services/WorkoutDetailFetcher.swift`

Capturar:

- disponibilidade do HealthKit
- autorizacao concedida/negada
- falha ao salvar treino
- falha ao buscar corridas

## Fases de Implementacao

### Fase 0: prova curta

Objetivo:

- validar SDK, DSN, simbolos e recebimento de eventos em build interna

Entregas:

- integrar provider ao projeto
- iniciar provider no app
- disparar um erro de teste manual
- validar recepcao no painel

Critério de aceite:

- um erro de teste aparece com release, build, environment e device corretos

### Fase 1: fundacao

Objetivo:

- padronizar a camada de observabilidade e o contexto global do app

Entregas:

- `Observability` wrapper
- tags globais de ambiente, release e build
- session id local por abertura do app
- user id apos login ou `getUserProfile`
- breadcrumbs de ciclo de vida

Critério de aceite:

- toda sessao interna gera contexto minimo consistente

### Fase 2: rede

Objetivo:

- tornar falhas de API investigaveis

Entregas:

- spans/breadcrumbs em `APIClient`
- captura de timeout, status code, decode error e retry
- cabecalhos de correlacao com backend

Critério de aceite:

- qualquer erro de API relevante pode ser localizado no provider e cruzado com logs da AWS

### Fase 3: fluxo de corrida

Objetivo:

- dar visibilidade aos bugs mais provaveis do app em uso real

Entregas:

- breadcrumbs do fluxo de corrida
- captura de erro em `LocationManager`
- captura de falha em `HealthKit`
- captura de falha em `Live Activity`
- contexto de sincronizacao local/remota

Critério de aceite:

- ao reproduzir uma falha de corrida em device, existe trilha suficiente para entender onde quebrou

### Fase 4: experiencia do tester

Objetivo:

- diminuir o tempo entre "deu ruim" e "agora temos contexto"

Entregas:

- tela oculta ou menu de diagnostico
- botao "Reportar problema"
- exibicao de IDs uteis: session id, request id, build, ambiente
- opcional: envio de feedback textual com screenshot

Critério de aceite:

- um tester consegue enviar um reporte util sem abrir o Xcode

### Fase 5: hardening

Objetivo:

- aumentar confiabilidade e reduzir ruido

Entregas:

- amostragem por ambiente
- filtros de ruido
- agrupamento de erros conhecidos
- politicas de retenção
- monitoramento de regressao apos releases internas

Critério de aceite:

- volume de eventos fica administravel e os principais problemas aparecem com clareza

## Dados que Devem Virar Tags ou Contexto

### Tags pequenas

- `environment`
- `release`
- `build`
- `screen`
- `flow`
- `network_path`
- `request_id`
- `session_id`
- `has_active_run`

### Contexto estruturado

- estado da corrida
- distancia e duracao atuais
- status de permissao de localizacao
- status de permissao de HealthKit
- `workoutId`
- `trainingPlanId`
- tipo de operacao (`save_run`, `plan_next_week`, `plan_from_health`)

## Privacidade e Sanitizacao

Nunca enviar:

- senha
- access token
- refresh token
- corpo completo de resposta autenticada
- email em texto puro se nao for estritamente necessario
- rota GPS completa por padrao
- payload bruto do HealthKit por padrao

Regras:

- preferir `user_id` ao inves de email
- truncar mensagens grandes
- mascarar identificadores sensiveis
- revisar todo breadcrumb que venha de rede antes de enviar

## Backlog Tecnico Sugerido

- [ ] Definir provider da fase 1
- [ ] Criar `Config/User.xcconfig` ou equivalente para segredos locais do provider
- [ ] Adicionar dependencia no `project.yml`
- [ ] Criar wrapper `Observability`
- [ ] Inicializar no `AthlyRunnerApp`
- [ ] Instrumentar `APIClient`
- [ ] Instrumentar fluxo de corrida
- [ ] Instrumentar `HealthKit` e `LocationManager`
- [ ] Criar tela oculta de diagnostico
- [ ] Definir padrao de `request_id` com backend AWS
- [ ] Ajustar logs estruturados do backend para correlacao
- [ ] Documentar politica de PII e retencao

## Perguntas em Aberto

- O provider sera SaaS externo, self-hosted ou misto?
- O app de distribuicao principal sera Debug local, TestFlight interno ou ambos?
- O backend ja retorna algum `request_id` hoje ou isso precisa ser criado?
- O time quer registrar email do tester ou apenas `user_id`?
- Queremos capturar feedback manual dentro do app ja na fase 1 ou apenas na fase 4?
- A extensao de `Live Activity` precisa enviar eventos proprios ou basta registrar falhas no app principal?

## Recomendacao Final

Para o problema atual, a melhor ordem de execucao e:

1. `Sentry` no iOS com wrapper proprio.
2. Instrumentacao de rede e fluxo de corrida.
3. Correlacao com logs do backend na AWS via `request_id`.
4. Tela simples de diagnostico para testers.
5. Revisar necessidade de uma trilha mais AWS-native apenas depois que a fase 1 estiver funcionando.

## Referencias Oficiais

- Sentry iOS: https://docs.sentry.io/platforms/apple/guides/ios/
- Sentry User Feedback: https://docs.sentry.io/platforms/apple/user-feedback/
- Sentry Logs para Apple: https://docs.sentry.io/platforms/apple/guides/ios/logs/
- Apple MetricKit: https://developer.apple.com/documentation/metrickit/mxmetricmanager/

