# Athly / Zepp — integração nativa

Alvo de homologação: Active 3 Premium + iPhone. O treino é executado pelo app nativo do relógio. Não há aplicativo Zepp OS próprio. O frontend iOS está disponível apenas em DEBUG. O backend depende de `ZEPP_ENABLED`; a configuração do App Runner habilita a conexão e o envio manual para homologação. O envio automático permanece desativado.

## Cadastro de parceiro (ação do responsável pela Athly)

Portal e requisitos: https://devopen.zepp.com/docs/getting-started/partner-onboarding

- Nome: Athly. Descrição: planejamento de corridas, envio de treinos estruturados e análise de atividades confirmadas pelo atleta.
- Solicitar Workout (envio) e Activity/FIT (recebimento). Não solicitar sono ou métricas diárias.
- Método de autorização: Web, Authorization Code com access + refresh token.
- Callback OAuth: `https://api.athlyproject.app/zepp/callback`.
- Callback de dados: `https://api.athlyproject.app/zepp/webhooks/<ZEPP_WEBHOOK_SECRET>`.
- Completar dados empresariais, contato, ícone e política de privacidade com as informações reais da Athly. Nada foi enviado à Zepp automaticamente.

## Configuração e implantação

1. Aplicar as migrações `20261115000000_zepp` , `20261117000000_zepp_backfill` e `20261118000000_zepp_candidates` no ambiente desejado. No App Runner, `npm run start:prod:migrate` aplica as migrações antes de iniciar a API. Não há alteração dos dados Garmin.
2. Configurar as variáveis `ZEPP_*` de `.env.example`. Chave de tokens: 32 bytes aleatórios em base64. Segredo do webhook: pelo menos 32 caracteres aleatórios URL-safe. Manter fora do repositório e ocultar caminho de webhook, query OAuth e headers Authorization nos logs de infraestrutura.
3. Com aprovação e credenciais, habilitar `ZEPP_ENABLED=true` em ambiente de teste. Conectar pelo iPhone; depois da página de confirmação, voltar à Athly.
4. Para testar no relógio, habilitar `ZEPP_WORKOUTS_MANUAL_ENABLED=true`, mantendo `ZEPP_WORKOUTS_VALIDATED=false` até validar unidades e comportamentos abaixo. A flag manual libera somente envios solicitados pelo usuário autenticado. A flag de validação habilita também a sincronização automática. A recepção das corridas funciona independentemente do envio de treinos.
5. Liberar produção somente após homologação; habilitar explicitamente `FeatureFlags.zeppSync` no release iOS.

Sem credenciais, os testes usam mocks. Não é possível afirmar funcionamento no relógio apenas com testes locais.

## Contratos

Rotas autenticadas pelo JWT Athly: `GET /zepp/status`, `POST /zepp/authorize {timeZone}`, `POST /zepp/sync`, `DELETE /zepp/connection`, `GET /zepp/activities`, `GET /zepp/activities/:id/fit`, `POST /zepp/activities/:id/resolve {resolution, workoutId?}`. Resoluções: `linked`, `free_run`, `dismissed`. O vínculo verifica propriedade do treino e não o conclui no backend.

OAuth usa state aleatório de uso único com 10 minutos de validade. Os tokens são AES-256-GCM. O webhook aceita o array de strings JSON servido como text/plain; exige o segredo do caminho pois a documentação atual não prevê assinatura HMAC. URLs FIT aceitas somente em `https://api-open.zepp.com/api/activity/file`, sem redirecionamento. Outra origem oficial exigirá revisão explícita.

Histórico: `POST /zepp/activities/backfill {startTime, endTime}` usa timestamps Unix em segundos e o token da conta autenticada, com intervalo passado de até 30 dias. O iOS solicita o histórico em Concluir treino/Adicionar dados, usando a mesma janela do Apple Health: dia planejado até o fim de D+2, limitada ao instante atual para o backfill. O backend chama `GET /wellness-api/rest/backfill/activities` na Zepp e retorna HTTP 202 somente quando a Zepp confirma `ACCEPTED` com um `requestId`. O comprovante, a data do pedido e eventuais erros ficam na conexão. Há intervalo mínimo persistente de um minuto entre pedidos, inclusive após falhas; pedidos aceitos para a mesma janela são reutilizados por cinco minutos. Recebimento e deduplicação usam o webhook existente. HTTP 202 confirma o pedido, não a entrega de corridas. Contrato: https://devopen.zepp.com/docs/data-apis/backfill-api.

`GET /zepp/status` também informa `historyImportAvailable`, `workoutsEnabled`, `backfillRequestedAt`, `backfillRequestId` e `backfillError`. `workoutsEnabled` exige a integração ativa e pelo menos uma das flags de envio. O app oculta o envio se ambas estiverem desativadas.

`POST /zepp/sync` envia a janela completa de hoje até hoje + 6 dias no fuso salvo da conexão. Exige conta conectada e reserva exclusiva de 120 segundos, compartilhada com o worker automático; um envio simultâneo recebe HTTP 409. Aguarda a confirmação `code: 1` da Zepp e retorna `{status: "ACCEPTED", workoutCount, startDate, endDate}`. Essa resposta confirma aceitação na nuvem, não entrega ao relógio. Falha de validação identifica o título/data do treino e não envia uma janela parcial. Erros não confirmam sucesso e liberam a reserva. O iOS permite até 90 segundos para renovação do token e envio.

No iPhone de desenvolvimento: **Perfil → Ajustes → Amazfit / Zepp → Enviar treinos planejados**. Após a confirmação, abrir o Zepp e sincronizar o relógio. Conferir no relógio cada duração, alvo e repetição antes de executar. Uma semana sem treinos agendados envia `workouts: []`, removendo os treinos anteriormente enviados na janela calculada pela Zepp. Enviar novamente atualiza toda a janela, preservando os IDs Athly.

Worker a cada 5 segundos, filas no PostgreSQL com leases de 120 segundos. Quando `ZEPP_WORKOUTS_VALIDATED=true`, a sincronização automática de treinos verifica a janela completa de sete dias a cada cinco minutos e compara hash. IDs numéricos estáveis preservam o vínculo com UUIDs Athly. FITs são deduplicados por usuário e summaryId, limitados a 50 MB e expurgados em 30 dias. Download tem timeout de 60 segundos e tentativas exponenciais até dez tentativas ou 24h. A URL é de uso único: interrupção após consumo remoto e antes da gravação local pode exigir reentrega pela Zepp.

O iOS usa o importador FIT existente, preservando dados originais, inclusive FC sem ponto GPS. As chaves locais `zepp:<id>` são separadas de Garmin. A conexão Zepp não atrasa o aviso do Apple Health. Uma decisão sobre a corrida reconhece também a contraparte equivalente que chegar depois; a seleção manual continua disponível para complementar dados. A comparação por início/duração/distância evita oferecer novamente corridas já importadas manualmente ou pelo Apple Health. Não se presume vínculo automático com um treino planejado.

## Compatibilidade e homologação obrigatória

A conversão V2 implementa duração por tempo/distância, repetições (inclusive grupos consecutivos/aninhados), alvo de pace e alvo de FC convertido para bpm pelas zonas válidas da Athly. Confirmar na API e no relógio as unidades dos campos: a documentação V2 é ambígua para distância. Passos abertos e sem alvo não têm representação V2 confirmada; geram erro visível e impedem enviar uma janela parcial. Não são substituídos por tempos/alvos fictícios. A paridade completa depende de a Zepp confirmar esses formatos.

- Conectar, cancelar autorização, renovar token, desconectar e revogar pelo Zepp.
- Executar aquecimento + 6×400m/recuperação + volta à calma; conferir duração, pace, FC, repetições e alertas. Usar alvos explícitos na primeira homologação.
- Confirmar contratos para passos abertos e sem alvo antes de liberar os treinos que os usam.
- Alterar/excluir treino e verificar janela inteira, incluindo janela vazia e mudança de fuso/dia.
- Corrida livre e treino sem celular, tela apagada, pausa e retomada; sincronizar depois. Conferir histórico Zepp, rota, FC, laps e timestamps no FIT. Resolução de timestamp de 1 segundo não garante nova leitura de sensor a cada segundo.
- Repetir webhook, desligar worker, retomar e conferir uma única atividade. Testar FIT inválido, download expirado e conta revogada.
- No iPhone: vincular, salvar livre, ignorar e repetir a mesma atividade via Apple Health/importação manual. Testar Garmin como regressão.

Monitorar filas pending/failed, idade dos downloads e `ZeppConnection.error/lastSyncAt`; não registrar tokens ou URLs assinadas. Atividades failed ficam disponíveis para diagnóstico no banco até o expurgo. O envio ao relógio não implica sucesso antes da sincronização do próprio Zepp.

## Seleção e vínculo de atividade

`GET /zepp/activities/candidates?workoutId=…&startTime=…&endTime=…&cursor=…` lista atividades pela data da corrida, com início inclusivo e fim exclusivo em segundos Unix. Retorna `items` e `nextCursor` (50 por página). Exige propriedade do workout. Inclui atividades ignoradas ou salvas como corrida livre, mas exclui as vinculadas a outro workout.

A conclusão recebe `zeppActivityId` opcional e grava o vínculo junto com o workout em uma única transação. `ZeppActivityLink` mantém a associação após o expurgo do FIT; desfazer a conclusão libera o vínculo. Um workout aceita apenas uma atividade Zepp e uma atividade só pode pertencer a um workout.

Para corridas equivalentes: Apple Health com rota tem prioridade; sem rota no Health e com rota na Zepp, somente Zepp aparece; sem rota em ambas, Health aparece. Leitura de rota inconclusiva ou correspondência ambígua mantém as opções acessíveis. As fontes carregam independentemente; o app consulta atividades a cada cinco segundos por até um minuto após o pedido de histórico. Receber o comprovante não significa que o FIT já chegou.

Homologar no iPhone: selecionar corrida em Concluir treino, repetir em Adicionar dados, conferir rota/FC e ausência de cópia indevida no Health. Reabrir o app e verificar que não há segundo aviso; desfazer conclusão e confirmar que a corrida volta a ficar disponível.
