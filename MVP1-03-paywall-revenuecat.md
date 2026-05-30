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

## Checklist
- [ ] Produtos + trial criados no App Store Connect
- [ ] App configurado no RevenueCat (entitlement "premium", offerings)
- [ ] iOS: SDK integrado + `PurchaseManager` (compra/restauração/estado `isPremium`)
- [ ] iOS: tela de paywall + gatilho na fronteira de gating
- [ ] Backend: webhook RevenueCat atualiza status de assinatura no usuário
- [ ] Backend: `SubscriptionGuard` protegendo endpoints premium
- [ ] Fronteira de gating **decidida** (ver observações) e implementada

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
