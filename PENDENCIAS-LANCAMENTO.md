# Pendências de lançamento (do seu lado — não-código)

Itens que **eu não consigo fazer** (precisam de consoles externos, segredos, DB real ou device)
e que ficaram pendentes durante a implementação do MVP1. Organizados por prioridade.

---

## 🔴 Bloqueadores de deploy / dados

- [ ] **Rodar as migrações no banco** (não apliquei — o `DATABASE_URL` aponta para `db:5432`, host do
      Docker Compose, inacessível do meu ambiente). No deploy roda via `prisma migrate deploy`; valide
      antes localmente com `npm run db:migrate`. Migrações novas:
  - `20260530140000_add_user_subscription` (campos de assinatura — WS3)
  - `20260530120000_add_run_session` **+** `20260601120000_drop_run_session` — a persistência
    própria de corrida foi **revertida** (modelo HealthKit-first); no deploy o `migrate deploy`
    cria e dropa a tabela em sequência (no-op líquido). Não precisa fazer nada manual.
- [ ] **Variáveis de ambiente em produção**: garantir `JWT_SECRET`, `GEMINI_API_KEY`, `DATABASE_URL`,
      AWS SES (`AWS_REGION`, `SES_SENDER_EMAIL`), `ADMIN_EMAILS`, `PAYWALL_ENABLED`, `REVENUECAT_WEBHOOK_AUTH`
      (ver `athly-backend/.env.example`).

## 🔴 App Store (submissão pública)

- [ ] **Criar as páginas de Privacidade e Termos** na landing e confirmar as URLs — o iOS aponta para
      `https://athlyproject.app/privacy` e `https://athlyproject.app/terms` (links quebrados = rejeição).
      Se a rota for outra, me avise que eu ajusto no `ProfileView`.
- [ ] **`DEVELOPMENT_TEAM`**: preencher em `athly-ios/project.yml` (hoje vazio) para assinar/submeter.
- [ ] **Nutrition label (privacidade)** no App Store Connect — o `PrivacyInfo.xcprivacy` é um espelho;
      a fonte oficial é o ASC.
- [ ] **Testar "Excluir conta" ponta a ponta** contra o backend rodando (apaga o usuário + cascade).

## 🔴 Strava (segurança)

- [ ] **Revogar as credenciais reais do Strava** que ainda estão no `.env` local (gitignored):
      `STRAVA_CLIENT_ID/SECRET/ACCESS_TOKEN`. O Strava foi removido do código; revogue no painel do Strava.
- [ ] *(opcional)* Regenerar o client OpenAPI do frontend (`npm run generate:client`) contra o backend
      atualizado para limpar os models Strava mortos em `athly-frontend/src/client/`.
- [ ] *(opcional, MVP2)* Dropar as colunas dormentes de Strava no DB (`strava_activity_id`,
      `strava_athlete_id`, enum `IntegrationType.strava`) se quiser.

## 🟡 Paywall / RevenueCat (ligar quando configurado)

> Hoje o backend so bloqueia quando `PAYWALL_ENABLED=true` chega ao processo em producao.
> Decisão de gating: **trial backend de 14 dias → tudo pago**.

- [ ] **App Store Connect**: criar os 4 produtos de assinatura no grupo `Athly Basic`, sem trial Apple:
      `com.athly.runner.basic.monthly`, `com.athly.runner.basic.yearly`,
      `com.athly.runner.founder.monthly`, `com.athly.runner.founder.yearly`.
- [ ] **RevenueCat**: criar o projeto, o *entitlement* `basic`, as offerings `default` e `founder`, e gerar as **API keys**
      (iOS public key + segredo do webhook). Todos os 4 produtos devem liberar o entitlement `basic`.
- [ ] **Backend**: setar `REVENUECAT_WEBHOOK_AUTH` e `PAYWALL_ENABLED=true`; garantir que essas keys
      estao mapeadas no App Runner (`apprunner.yaml`/config do servico); apontar o webhook do
      RevenueCat para `.../billing/revenuecat/webhook`.
- [ ] **iOS**: trocar `REVENUECAT_API_KEY` pela public SDK key `appl_...` do app iOS no RevenueCat.
      O SDK, `PurchaseManager`, `Purchases.logIn(user.id)` e `FeatureFlags.paywallEnabled = true`
      já estão integrados.
- [ ] **Validar em sandbox StoreKit**: usar usuario nao-admin e fora do trial backend de 14 dias;
      comprar → webhook marca `active` → `/ai-planner` libera; sem assinar → `/ai-planner`
      retorna 403 e o app mostra o paywall.

## 🟡 Verificações manuais (precisam de device/DB real)

- [ ] **Histórico via HealthKit** (device real): finalizar uma corrida → ela é gravada no Apple Health
      e aparece na aba Histórico; corridas de outras fontes (Watch/Garmin/outros apps) também aparecem;
      sobrevive a reinstalar o app. (Persistência própria de corrida foi removida — modelo HealthKit-first.)
- [ ] **Notificações locais**: com permissão concedida, o lembrete dispara às 7h do dia do treino
      (testar com data/hora próxima); desligar o toggle cancela os pendentes.
- [ ] **Calorias** variam conforme o peso do usuário (editar peso no perfil e comparar).
- [ ] **Tokens no Keychain** (não mais em UserDefaults) — sessão persiste após reinstalar/atualizar.

---

### Contexto de verificação que JÁ fiz (automático)
- Backend: `tsc -p tsconfig.build.json` → exit 0 em todos os WS.
- Frontend: `npm run build` → exit 0.
- iOS: `xcodebuild` (simulador) → BUILD SUCCEEDED em todos os WS.
- O que **não** consegui: rodar o backend/DB (Docker), testes em device real, e qualquer console externo
  (App Store Connect, RevenueCat, Strava, DNS da landing).
