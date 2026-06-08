# 22 — Billing + Paywall (stub)

## 1. Objetivo
Espelhar o entitlement/paywall do iOS no estado **stubbed**: fonte única de verdade do premium (fail-open
enquanto o paywall está desligado), interface de compras com impl stub, feature flag e a tela de paywall.
**Baixa prioridade** — não integrar billing real ainda.

## 2. Stack & convenções
Ver `README.md`. Tudo em `feature/paywall/`. Coroutines/Flow + Compose. Sem SDK de billing nesta fatia.

## 3. Referência iOS (espelhar 1:1)
- `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/AthlyRunner/Services/FeatureFlags.swift`
  — `static let paywallEnabled = false`. Com `false`, todo o gating é **fail-open** (ninguém bloqueado).
- `/Users/.../AthlyRunner/Services/PurchaseManager.swift`
  — `protocol PurchaseManager`: `hasActiveEntitlement() -> Bool`, `purchaseDefaultProduct()`, `restorePurchases()`.
    `StubPurchaseManager`: `hasActiveEntitlement = false`; compra/restore lançam `PurchaseError.notConfigured`
    ("Assinaturas ainda não estão disponíveis nesta versão.").
- `/Users/.../AthlyRunner/Services/EntitlementManager.swift`
  — `@Published isEntitled` (default `true`). `canUsePremium = !paywallEnabled || isEntitled`.
    `refresh()`: se `!paywallEnabled` → `isEntitled = true` e retorna; senão `isEntitled = await hasActiveEntitlement()`.
    `purchase()`/`restore()` chamam o `PurchaseManager` e dão `refresh()`. Trial de 7 dias e assinatura também
    são validados no **backend (SubscriptionGuard)** — o paywall do cliente é cosmético enquanto desligado.
- `/Users/.../AthlyRunner/Views/Paywall/PaywallView.swift`
  — UI "Athly Premium": ícone coroa (gradiente brand), título, subtítulo "7 dias grátis, depois assinatura.
    Cancele quando quiser.", lista de 4 features (strings pt-BR exatas — ver abaixo), CTA "Começar teste grátis"
    (→ `subscribe()`/`purchase()`, "Processando..." enquanto trabalha), "Restaurar compras" (→ `restore()`),
    "Agora não" (dismiss), rodapé legal. Erros inline via `errorMessage`.
  - Features (manter idênticas): "Planos de corrida personalizados por IA"; "Replanejamento semanal adaptativo";
    "Análise de evolução e zonas de esforço"; "Blocos de treino com contagem em tempo real".

## 4. Alvo Android
### `feature/paywall/FeatureFlags.kt`
- `object FeatureFlags { const val PAYWALL_ENABLED = false }`. Fail-open enquanto `false`.

### `feature/paywall/PurchaseManager.kt`
- `interface PurchaseManager { suspend fun hasActiveEntitlement(): Boolean; suspend fun purchaseDefaultProduct();
  suspend fun restorePurchases() }`.
- `StubPurchaseManager`: `hasActiveEntitlement() = false`; compra/restore lançam exceção com a mesma mensagem.
- **Nota (não implementar agora):** plugar **RevenueCat Android** (`com.revenuecat.purchases:purchases`) ou
  **Google Play Billing** depois, implementando esta interface sem mudar o resto do app.

### `feature/paywall/EntitlementManager.kt` (`@Singleton`, injeta `PurchaseManager`)
- `StateFlow<Boolean> isEntitled` (default `true`). `canUsePremium = !PAYWALL_ENABLED || isEntitled.value`.
  `refresh()`: se `!PAYWALL_ENABLED` → `isEntitled = true`; senão `= hasActiveEntitlement()`. `purchase()`/`restore()` → delega + `refresh()`.

### `feature/paywall/ui/PaywallScreen.kt` + `PaywallViewModel.kt`
- Composable espelhando a `PaywallView` (mesmas strings/ordem/CTAs), `isWorking`/`errorMessage` no UiState.
  Só é exibida quando `PAYWALL_ENABLED == true` e sem entitlement (cosmético até lá). Ícone coroa → Material
  `Icons.Filled` equivalente; gradiente brand do design system (01).

### Mapeamento de plataforma
- `RevenueCat iOS`/`StoreKit` → **RevenueCat Android** (`Purchases`) / **Play Billing** (futuro).
- `@Published` → `StateFlow`; `ObservableObject` → `@Singleton` + Hilt.

## 5. Contrato de dados
Sem novos endpoints nesta fatia. O entitlement real é validado server-side (SubscriptionGuard, trial de 7 dias)
no backend — o cliente só reflete; nenhuma chamada de billing nesta fatia (stub retorna `false`).

## 6. Escopo
**In:** `FeatureFlags`, `PurchaseManager` (interface + stub), `EntitlementManager` (StateFlow), `PaywallScreen`
(UI fiel). Mirror exato do estado stubbed do iOS.
**Fora:** integração real de billing (RevenueCat/Play Billing), gating efetivo de telas, recibos/validação.

## 7. Dependências
`01-design-system` (tema/gradiente/tipografia), `05-navigation-shell` (apresentar o paywall quando habilitado).

## 8. Critérios de aceite
- Compila; com `PAYWALL_ENABLED = false`, `EntitlementManager.isEntitled = true` e `canUsePremium = true` (fail-open) —
  nada é bloqueado.
- `StubPurchaseManager.hasActiveEntitlement()` retorna `false`; `purchaseDefaultProduct()`/`restorePurchases()`
  lançam a exceção com a mensagem "Assinaturas ainda não estão disponíveis nesta versão.".
- `PaywallScreen` renderiza com as 4 features e CTAs em pt-BR idênticos; "Agora não" fecha; erros aparecem inline.

## 9. Pitfalls
- **Fail-open** enquanto desligado: nunca bloquear recursos com `PAYWALL_ENABLED = false`; o gating definitivo é server-side.
- O paywall do cliente é **cosmético** até ligar; o entitlement real é validado pelo `SubscriptionGuard` no backend.
- Não adicionar o SDK de billing agora (baixa prioridade) — manter a interface limpa p/ plugar RevenueCat/Play Billing depois.
- Manter strings/ordem/CTAs idênticos ao iOS para fidelidade quando o paywall for ligado.
