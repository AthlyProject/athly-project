# MVP1 · 🔴 Workstream 3 — Monetização / paywall (RevenueCat)

> Decisão: **RevenueCat** como camada sobre o IAP da Apple. O pagamento sempre passa pelo
> StoreKit/IAP (obrigatório pela Apple, Guideline 3.1.1); o RevenueCat cuida de validação,
> entitlements, webhooks e analytics. Migrar para StoreKit 2 nativo próprio fica como opção futura.

## Objetivo
Lançar o MVP com assinatura paga: paywall no iOS via RevenueCat e gating dos recursos pagos no
backend, reaproveitando o `RoleEnum` existente.

## Repos / arquivos afetados

### App Store Connect
- Criar produtos de assinatura Basic e Founder (mensal/anual) + **trial**.
- Configurar o app no RevenueCat (API keys, offerings, entitlement `basic`).

### iOS (`athly-ios`, target 16.1)
- Adicionar SDK do RevenueCat (sobre StoreKit 2).
- `Services/PurchaseManager.swift` (novo): configurar SDK, carregar offerings, comprar, restaurar,
  observar `customerInfo` e expor `isPremium`.
- `EntitlementManager`/estado observável que libera/bloqueia recursos pagos.
- Tela de **Paywall** (UI à mão — as `SubscriptionStoreView` nativas são iOS 17+; ou usar o paywall
  do RevenueCat). Gatilho na fronteira de gating definida.
- "Restaurar compras" no `ProfileView`/Settings.

### Backend (`athly-backend`)
- Reusar enum **`RoleEnum` (STANDARD/PREMIUM/ADMIN)** (hoje ocioso) ou adicionar campo de status de
  assinatura ao `User`.
- Endpoint de **webhook do RevenueCat** (`POST /billing/revenuecat/webhook`) que valida o evento e
  atualiza o status de assinatura do usuário (renovação, cancelamento, expiração, billing issue).
- **Guard de assinatura** (`SubscriptionGuard`) nos endpoints pagos (ex.: `/ai-planner/*`).

## Decisão de gating
**Trial de 7 dias, depois tudo pago.** Backend: entitlement = `paywall OFF` OU dentro de
`createdAt + 7d` OU assinatura ativa não expirada. Usuários cujo e-mail está em `waitlist_entries`
veem a oferta Founder. **Abordagem: scaffold com `PAYWALL_ENABLED=false` (fail-open)** — toda a
infra está pronta e dormente; ligar quando o RevenueCat/ASC estiverem prontos.

## Produtos / ofertas
- App Store subscription group: `Athly Basic`
- Entitlement RevenueCat comum: `basic`
- Offering padrão: `default`
  - `com.athly.runner.basic.monthly`
  - `com.athly.runner.basic.yearly`
- Offering founder: `founder` (somente para e-mails em `waitlist_entries`)
  - `com.athly.runner.founder.monthly`
  - `com.athly.runner.founder.yearly`

## Checklist
- [ ] Produtos Basic + Founder + trial criados no App Store Connect *(externo — você)*
- [ ] App configurado no RevenueCat (entitlement `basic`, offerings `default`/`founder`, API keys) *(externo — você)*
- [x] iOS: `PurchaseManager` real com RevenueCat SDK, `Purchases.logIn(userId)` e observer de entitlement
- [x] iOS: `RevenueCatUI.PaywallView` + `EntitlementManager` + gate em `PlanView`
- [x] Backend: webhook `POST /billing/revenuecat/webhook` atualiza assinatura do usuário
- [x] Backend: `SubscriptionGuard` em `/ai-planner/*` (fail-open via `PAYWALL_ENABLED`)
- [x] Fronteira de gating decidida (trial 7d → pago) e implementada no backend

> **Para ativar (depois):** criar produtos no ASC + projeto RevenueCat → setar `REVENUECAT_API_KEY`
> no iOS com a public SDK key `appl_...` → setar `REVENUECAT_WEBHOOK_AUTH` e `PAYWALL_ENABLED=true`
> no backend. O app já chama `Purchases.logIn(userId)` usando o id do usuário Athly como `app_user_id`.

## Critérios de aceite / verificação
- [ ] Compra em **sandbox StoreKit** libera o recurso pago no app
- [ ] Webhook do RevenueCat chega ao backend e marca o usuário como assinante ativo
- [ ] Endpoint pago retorna 402/403 para não-assinante e 200 para assinante
- [ ] Cancelar/expirar (sandbox) → recurso volta a bloquear após o webhook
- [ ] "Restaurar compras" recupera assinatura em novo install
- [ ] iOS `xcodebuild` → BUILD SUCCEEDED; backend `tsc` → exit 0

## Dependências / observações
- **Decisão de produto pendente:** o que é grátis vs pago. Sugestão — onboarding + 1ª semana
  grátis; replanejamento semanal e uso contínuo atrás do paywall.
- Independente dos outros workstreams, mas o guard deve cobrir endpoints que possam surgir no WS4.
- iOS 16.1 suporta StoreKit 2 (lançado no iOS 15); só as views de paywall nativas exigem iOS 17+.
