# Configuracao App Store + RevenueCat

Guia operacional para configurar assinaturas do Athly no App Store Connect e no
RevenueCat.

## Estado atual do projeto

- Bundle ID do app iOS: `com.athly.runner`.
- Bundle ID da Live Activity: `com.athly.runner.liveactivity`.
- SDK RevenueCat: `purchases-ios-spm` `5.78.0`.
- O app configura o SDK em `AthlyRunnerApp.swift` usando `REVENUECAT_API_KEY`.
- A key atual em `athly-ios/Config/Config.xcconfig` e `test_...`; nao submeter para review assim.
- O app usa `Purchases.logIn(userId)` com o id do usuario Athly como `app_user_id`.
- Entitlement esperado no RevenueCat: `basic`.
- Offerings esperadas no RevenueCat: `default` e `founder`.
- Backend recebe webhook em `POST /billing/revenuecat/webhook`.
- Backend libera acesso se `PAYWALL_ENABLED=false`, admin, trial backend de 14 dias, ou assinatura ativa.

## Decisao antes de criar os produtos

O codigo atual ja implementa trial backend de 14 dias (`createdAt + 14d`). Para o primeiro lancamento,
a configuracao mais limpa e:

- nao criar periodo gratuito/oferta introdutoria no App Store Connect;
- deixar o trial como regra do backend;
- fazer o usuario assinar quando sair do trial backend.

Se voce tambem criar trial Apple de 14 dias, o usuario pode ganhar 14 dias no backend e mais 14 dias na
assinatura Apple. Isso pode ser valido como decisao comercial, mas nao e o comportamento mais direto.

## Produtos esperados

Todos devem ficar no mesmo subscription group, porque sao variacoes do mesmo acesso pago.

| Produto | ID do produto exato | Duracao | Oferta no RevenueCat | Pacote |
| --- | --- | --- | --- | --- |
| Basic Mensal | `com.athly.runner.basic.monthly` | 1 mes | `default` | Mensal |
| Basic Anual | `com.athly.runner.basic.yearly` | 1 ano | `default` | Anual |
| Founder Mensal | `com.athly.runner.founder.monthly` | 1 mes | `founder` | Mensal |
| Founder Anual | `com.athly.runner.founder.yearly` | 1 ano | `founder` | Anual |

Observacao: Founder fica oculto pelo app para quem nao esta na waitlist, mas nao e uma barreira de
seguranca da App Store. Se a oferta Founder precisar ser rigidamente exclusiva, use Offer Codes ou
Promotional Offers em vez de produto publico separado.

## App Store Connect

Os nomes abaixo estao em portugues. Quando eu colocar o nome em ingles entre parenteses, e so para
voce reconhecer a tela caso o App Store Connect apareca parcialmente traduzido.

1. Entre no App Store Connect e clique em `Negocios` no menu superior.
   Dentro dessa area, confira as abas `Contratos`, `Impostos` e `Informacoes bancarias`
   (`Business > Agreements / Tax / Banking`).
   Sem isso, produtos podem nao aparecer corretamente no sandbox/RevenueCat.
   Se voce nao ve `Negocios`, provavelmente sua conta nao tem permissao financeira suficiente; nesse
   caso, entre com o Apple ID titular da conta ou peca acesso ao titular/admin.

2. Confirme o app `Athly` com Bundle ID `com.athly.runner`.
   Se ele ainda aparecer como `Athly Runner`, voce pode mudar o nome em
   `Apps > Athly Runner > Geral > Informacoes do app`.
   O Bundle ID aparece na mesma tela, em `Informacoes gerais > ID do pacote`.
   Tambem da para conferir no projeto local em `athly-ios/Config/Config.xcconfig`:
   `ATHLY_BUNDLE_ID = com.athly.runner`.

3. Va em `Apps > Athly > Monetizacao > Assinaturas`.
   Se voce ainda nao renomeou no App Store Connect, o caminho temporario sera
   `Apps > Athly Runner > Monetizacao > Assinaturas`.

4. Crie o grupo de assinaturas:
   - Nome de referencia (`Reference Name`): `Athly Basic`
   - Localizacao da App Store / nome de exibicao: `Athly`
   - Descricao: `Acesso aos planos e recursos pagos do Athly.`

5. Dentro do grupo `Athly Basic`, crie os 4 produtos da tabela acima.
   Para cada produto:
   - Nome de referencia: nome humano, por exemplo `Athly Basic Monthly`.
   - ID do produto (`Product ID`): use exatamente o ID da tabela.
   - Duracao: `1 mes` ou `1 ano`.
   - Preco: decisao sua.
   - Disponibilidade: os paises desejados.
   - Informacoes para revisao: suba screenshot do paywall e uma nota curta explicando o acesso pago.
   - Localizacoes: pelo menos `pt-BR` e, se for lancar fora do Brasil, `en-US`.

6. Niveis de assinatura:
   - Coloque os 4 produtos no mesmo nivel, porque todos desbloqueiam o mesmo entitlement `basic`.
   - Mensal/anual/founder sao diferencas de duracao/preco/oferta, nao tiers de acesso.

7. Notificacoes do servidor da App Store (`App Store Server Notifications`):
   - Use a URL fornecida pela RevenueCat, nao o endpoint do backend do Athly.
   - Configure Producao e Sandbox com a URL da RevenueCat.
   - Use Versao 2.

8. Testador sandbox:
   - `Usuarios e acesso > Sandbox > +`.
   - Use um e-mail que nao seja Apple Account real.
   - No iPhone de teste, faca login em `Ajustes > App Store > Conta Sandbox`.

## RevenueCat

1. Crie/abra o projeto `Athly`.

2. Adicione app iOS:
   - App name: `Athly`
   - Bundle ID: `com.athly.runner`

3. Configure credenciais Apple:
   - Para RevenueCat SDK iOS 5.x / StoreKit 2, configure a In-App Purchase Key.
   - App Store Connect: `Usuarios e acesso > Integracoes > Compras dentro do app` ou `Compras no app`.
   - Gere a key, baixe o `.p8`, copie Key ID e Issuer ID.
   - RevenueCat: app iOS > In-app purchase key configuration > envie `.p8`, Key ID e Issuer ID.
   - App Store Connect API Key e recomendada para importar produtos/precos automaticamente.

4. Importe ou crie os produtos no RevenueCat:
   - `Product catalog > Products > App Store`
   - Importe os 4 Product IDs da tabela.

5. Crie o entitlement:
   - `Product catalog > Entitlements > + New`
   - Identifier: `basic`
   - Anexe os 4 produtos ao entitlement `basic`.

6. Crie as offerings:
   - Offering `default`: packages Monthly e Annual com os produtos Basic.
   - Offering `founder`: packages Monthly e Annual com os produtos Founder.
   - Marque `default` como Default Offering.

7. Configure os Paywalls no RevenueCat:
   - Crie um paywall para `default`.
   - Crie um paywall para `founder` ou reutilize o mesmo layout com os produtos Founder.
   - O app ja usa `RevenueCatUI.PaywallView`.

8. Configure Webhook do RevenueCat para o backend:
   - RevenueCat: `Integrations > Webhooks > Add new configuration`.
   - URL: `https://api.athlyproject.app/billing/revenuecat/webhook`
   - Authorization header: escolha um valor longo, por exemplo `Bearer <segredo-longo>`.
   - Backend production env: `REVENUECAT_WEBHOOK_AUTH=Bearer <segredo-longo>`.
   - Envie eventos de Sandbox e Producao durante a fase de teste.

9. Customer Center:
   - O app usa `CustomerCenterView()` em Perfil > Gerenciar assinatura.
   - Confirme se seu plano RevenueCat habilita Customer Center; se nao habilitar, precisamos trocar
     essa tela por um fallback para gerenciamento nativo da Apple.

## Config do app iOS

Para testar localmente sem mexer no arquivo versionado, coloque em `athly-ios/Config/User.xcconfig`:

```xcconfig
REVENUECAT_API_KEY = appl_sua_public_ios_sdk_key
```

Antes de enviar para App Review, a build de Release nao pode usar key `test_...`. Use a public SDK
key iOS (`appl_...`) do app Apple no RevenueCat.

## Config do backend

Em producao, depois de validar produtos, paywall e webhook:

```env
PAYWALL_ENABLED=true
REVENUECAT_WEBHOOK_AUTH=Bearer <mesmo-valor-configurado-no-RevenueCat>
```

Enquanto `PAYWALL_ENABLED=false`, o backend libera todo mundo e o app nao deve mostrar paywall,
porque `/billing/entitlement` retorna liberado.

## Teste de ponta a ponta

1. Use um usuario Athly que nao seja admin e que ja tenha passado do trial de 14 dias, ou ajuste esse
   usuario no banco para simular trial expirado.

2. Rode o app no device com:
   - Bundle ID `com.athly.runner`;
   - RevenueCat key `appl_...`;
   - Conta Sandbox logada em `Ajustes > App Store > Conta Sandbox`.

3. No app, va em `Plano > Gerar Proxima Semana`.
   - Sem entitlement, deve abrir o paywall.

4. Compre um produto sandbox.
   - RevenueCat Customer deve mostrar `App User ID` igual ao id do usuario Athly.
   - Entitlement `basic` deve ficar ativo.
   - Backend deve receber webhook e atualizar `subscriptionStatus=active`.
   - `GET /billing/entitlement` deve retornar `entitled=true`.

5. Teste restauracao:
   - Apague/reinstale o app, faca login com o mesmo usuario Athly.
   - `Purchases.logIn(userId)` deve recuperar a assinatura.

6. Teste expiracao/cancelamento sandbox:
   - Aguarde a assinatura sandbox expirar ou cancele.
   - RevenueCat deve enviar webhook.
   - Backend deve voltar a bloquear quando `subscriptionExpiresAt` passar.

## Fontes oficiais

- Apple: Offer auto-renewable subscriptions  
  https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions
- Apple: App Store Server Notifications  
  https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/enter-server-urls-for-app-store-server-notifications
- Apple: Sandbox testing  
  https://developer.apple.com/help/app-store-connect/test-in-app-purchases/overview-of-testing-in-sandbox
- RevenueCat: Configuring Products  
  https://www.revenuecat.com/docs/projects/configuring-products
- RevenueCat: In-App Purchase Key Configuration  
  https://www.revenuecat.com/docs/service-credentials/itunesconnect-app-specific-shared-secret/in-app-purchase-key-configuration
- RevenueCat: Webhooks  
  https://www.revenuecat.com/docs/integrations/webhooks
