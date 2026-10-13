---
tags: [tipo/integracao, integracao/zepp, integracao/amazfit, contexto/produto]
status: research
created: 2026-10-12
---

# Zepp/Amazfit — API oficial de atividades

Pesquisa em 12/10/2026. O usuário encerrou a frente do Mini App no relógio e
confirmou que a importação manual FIT e o problema de duplicação já estão
resolvidos. Esta investigação trata da obtenção automática de atividades pela
nuvem Zepp. Nenhum cadastro, pedido de parceria ou contato foi enviado.

Em 13/10/2026, o diretório local `athly-amazfit` foi removido a pedido do usuário.
Esta pesquisa da integração oficial permanece como referência de produto.

## Resultado

Há um caminho oficial documentado para receber atividades em FIT, condicionado
à aprovação de parceiro. A especificação contempla os dados procurados pelo
Athly. Ainda não houve autenticação ou download real pela API com o Athly;
documentação não equivale à validação do Active 3 Premium e da conta do usuário.

Fluxo proposto: relógio → sincronização Zepp → nuvem Zepp → notificação ao
backend Athly → download FIT → consumo pelo Athly iOS. O Apple Health não é
intermediário dessa obtenção. Continua sendo necessário sincronizar com Zepp.
O [guia inicial](https://devopen.zepp.com/docs/getting-started/quick-start)
descreve OAuth e a entrega de atividades por notificação seguida de download.

## Dados documentados

| Necessidade | Campos/mensagens FIT |
| --- | --- |
| Rota temporal | Record: timestamp, position_lat, position_long, condicionados a GPS |
| FC temporal | Record: timestamp, heart_rate, condicionado ao sensor |
| Duração | Session: total_timer_time e total_elapsed_time |
| Voltas/splits | Lap, incluindo origem por marcadores do aparelho ou divisão por distância |
| Pausas | Event: start, stop, stop_all |

A documentação também identifica o sistema de coordenadas com
`zepp_coord_system` (WGS-84 ou GCJ-02). Validar a interpretação no consumidor.
Não presumir presença de todos os campos em qualquer atividade ou modelo.
[Especificação Zepp FIT](https://devopen.zepp.com/docs/resources/fit-file/fit-spec).

## Acesso e cadastro

O [onboarding](https://devopen.zepp.com/docs/getting-started/partner-onboarding)
exige verificação empresarial aprovada para produção, cadastro do aplicativo e
aprovação de permissões. Pede nome/endereço da organização e contato; o aplicativo
precisa de callbacks OAuth e de dados, além de ícone PNG 216×216. Depois são
obtidos Client ID e Client Secret. O link oficial de cadastro é o
[console business](https://console.zepp.com/?partner=business).

O appId 1130872 do protótipo identifica o Mini App; não é evidência de que o Athly
já tenha credenciais OAuth ou aprovação para Data Services.

## Contratos para uma futura prova de integração

- **Autorização:** usar code flow e validar state; solicitar access e refresh por
  `token=["access","refresh"]` codificado na URL. A troca ocorre no servidor em
  `POST https://auth.zepp.com/v2/oauth2/access_token`, com segredo no backend.
  [Fluxo](https://devopen.zepp.com/docs/authentication/authorization-flow),
  [troca](https://devopen.zepp.com/docs/authentication/token-exchange).
- **Renovação:** `/v2/oauth2/refresh_token` exige também o Bearer access token
  segundo o contrato publicado; persistir os novos tokens retornados.
  [Refresh](https://devopen.zepp.com/docs/authentication/refresh-token).
- **Notificação:** POST text/plain contendo array de strings JSON. Desserializar
  cada string e ler activityFiles. Responder 2xx em até 30 s e processar em fila.
  summaryId identifica a entrega para deduplicação. O contrato atual não exige
  assinatura/HMAC para novos parceiros.
  [Activity Events](https://devopen.zepp.com/docs/webhook/activity-events).
- **Arquivo:** GET na callbackURL fornecida, com Bearer do usuário; token da URL
  é de uso único e expira em 24 h. Preservar o binário em armazenamento privado
  antes de depender de releituras.
  [Download FIT](https://devopen.zepp.com/docs/data-apis/download-fit-file).
- **Histórico:** GET `/wellness-api/rest/backfill/activities` com início/fim Unix
  em segundos, janela máxima de 30 dias por pedido. Retorna 202 e entrega pelo
  canal assíncrono. Isso não estabelece retenção total de apenas 30 dias. Há
  limite padrão de 50 pedidos/hora; a descrição do escopo por app/usuário merece
  confirmação no ambiente concedido.
  [Backfill](https://devopen.zepp.com/docs/data-apis/backfill-api).

Proposta de implementação, ainda não executada: registrar a entrega duravelmente
antes do ACK, deduplicar por integração/usuário/summaryId e aceitar downloads
somente de destinos HTTPS Zepp aprovados, sem encaminhar Bearer a outros hosts.
A ausência de assinatura torna relevante confirmar com o suporte a autenticação
do callback e os domínios regionais; não basta confiar em userId enviado no POST.
Não registrar tokens nem callbackURLs completas em logs.

## Encaixe no Athly

`athly-ios/AthlyRunner/Services/WorkoutImportService.swift` já usa FITSwiftSDK e
interpreta rota, FC, voltas, pausas e tempos ativo/total. A proposta é reutilizar
esse leitor para arquivos baixados, validando compatibilidade com amostras reais
da API. Isso não reabre o problema de importação manual informado como resolvido.

O modelo `Integration` do backend já tem campos de tokens e expiração, mas o
enum atual não contém Zepp e a identidade externa existente é específica do
Strava. Uma implementação precisará representar identidade Zepp, permissões,
revogação e entregas de atividades. Esta pesquisa não alterou código de execução.

Critério proposto para decidir pela implementação: aprovar o acesso, conectar a
conta de teste e obter um FIT via API de uma corrida existente. Comparar início,
rota, FC, voltas, pausas e durações com o arquivo exportado manualmente. Depois,
validar uma entrega nova, duplicada, renovação de token e desconexão.

## Questões ainda abertas para a Zepp

Não encontrei confirmação pública suficiente de custos, prazo de aprovação,
aceitação de desenvolvedor individual, sandbox sem empresa, abrangência da conta
brasileira, compatibilidade específica Active 3 Premium, retenção histórica,
prazo de entrega e recuperação de downloads consumidos/interrompidos. Também
falta confirmar permissões exatas e condições para o Athly aparecer na lista de
contas de terceiros do Zepp. OAuth disponível não demonstra essa listagem.

Contato indicado na documentação:
`open-api-support@zepp.com`.
[Suporte oficial](https://devopen.zepp.com/docs/resources/api-errors-and-support).

### Rascunho de contato — não enviado

Subject: Athly integration — Activity FIT API partner access

Hello Zepp Open Platform team,

We are developing Athly, a running training application, and would like to
integrate Activity Events, FIT download and historical backfill through user
OAuth authorization. Our initial test device is an Amazfit Active 3 Premium,
used with a Zepp account in Brazil.

Could you clarify:

1. Partner eligibility, required company documents, availability of a testing
   environment, fees and expected review timeline for a small independent app.
2. Support for this device/account region and the permissions needed to obtain
   GPS records, timestamped heart-rate samples, laps and pause/resume events.
3. Historical retention, callback delivery latency, approved download domains,
   webhook authentication and recovery after an interrupted one-time FIT download.
4. Whether appearing in Zepp's third-party accounts list requires separate approval.

Our goal is to synchronize completed activities directly from Zepp into Athly.
We already support FIT import and would first validate API-provided files using
our own consenting test account.

Thank you.

## Achado adicional: treinos planejados

A documentação atual também descreve
`POST /users/-/workouts?version=2.0.0` para enviar treinos ao Zepp em janelas
completas de sete dias. Isso supera a conclusão documental de julho de que não
havíamos encontrado endpoint. Habilitação e execução no Active 3 Premium ainda
precisam ser confirmadas; não fazem parte da prova de recebimento de atividades.
[Workout API](https://devopen.zepp.com/docs/data-apis/workout-api).
