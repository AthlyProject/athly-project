# MVP1 · 🔴 Workstream 3 — Monetização / paywall (RevenueCat)

> Decisão: **RevenueCat** como camada sobre o IAP da Apple. O pagamento sempre passa pelo
> StoreKit/IAP (obrigatório pela Apple, Guideline 3.1.1); o RevenueCat cuida de validação,
> entitlements, webhooks e analytics. Migrar para StoreKit 2 nativo próprio fica como opção futura.

## Objetivo
Lançar o MVP com assinatura paga: paywall no iOS via RevenueCat e gating dos recursos premium no
backend, reaproveitando o `RoleEnum` existente.

## Repos / arquivos afetados

### App Store Connect
- Criar produtos de assinatura (ex.: mensal/anual) + **trial**.
- Configurar o app no RevenueCat (API keys, offerings, entitlement "premium").

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
- **Guard de assinatura** (`SubscriptionGuard`) nos endpoints premium (ex.: `/ai-planner/*`).

## Decisão de gating
**Trial de 7 dias, depois tudo pago.** Backend: entitlement = `paywall OFF` OU dentro de
`createdAt + 7d` OU assinatura ativa não expirada. **Abordagem: scaffold com `PAYWALL_ENABLED=false`
(fail-open)** — toda a infra está pronta e dormente; ligar quando o RevenueCat/ASC estiverem prontos.

## Checklist
- [ ] Produtos + trial criados no App Store Connect *(externo — você)*
- [ ] App configurado no RevenueCat (entitlement "premium", offerings, API keys) *(externo — você)*
- [~] iOS: `PurchaseManager` (protocolo + `StubPurchaseManager`) — **SDK real do RevenueCat plugado depois**
- [x] iOS: `PaywallView` + `EntitlementManager` + gate em `PlanView` (atrás de `FeatureFlags.paywallEnabled`, hoje false)
- [x] Backend: webhook `POST /billing/revenuecat/webhook` atualiza assinatura do usuário
- [x] Backend: `SubscriptionGuard` em `/ai-planner/*` (fail-open via `PAYWALL_ENABLED`)
- [x] Fronteira de gating decidida (trial 7d → pago) e implementada no backend

> **Para ativar (depois):** criar produtos no ASC + projeto RevenueCat → setar `REVENUECAT_WEBHOOK_AUTH`
> e `PAYWALL_ENABLED=true` no backend → adicionar o SDK do RevenueCat (SPM) no iOS implementando
> `PurchaseManager`, chamar `Purchases.logIn(userId)` (app_user_id = id do usuário Athly) e
> `FeatureFlags.paywallEnabled = true`.

## Critérios de aceite / verificação
- [ ] Compra em **sandbox StoreKit** libera o recurso pago no app
- [ ] Webhook do RevenueCat chega ao backend e marca o usuário como premium
- [ ] Endpoint premium retorna 402/403 para não-assinante e 200 para assinante
- [ ] Cancelar/expirar (sandbox) → recurso volta a bloquear após o webhook
- [ ] "Restaurar compras" recupera assinatura em novo install
- [ ] iOS `xcodebuild` → BUILD SUCCEEDED; backend `tsc` → exit 0

## Dependências / observações
- **Decisão de produto pendente:** o que é grátis vs pago. Sugestão — onboarding + 1ª semana
  grátis; replanejamento semanal e uso contínuo atrás do paywall.
- Independente dos outros workstreams, mas o guard deve cobrir endpoints que possam surgir no WS4.
- iOS 16.1 suporta StoreKit 2 (lançado no iOS 15); só as views de paywall nativas exigem iOS 17+.
