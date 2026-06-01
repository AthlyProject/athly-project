import SwiftUI

/// Tela de assinatura (Athly Premium). UI pronta; as compras são feitas pelo `EntitlementManager`
/// → `PurchaseManager` (hoje um stub; o RevenueCat será plugado depois). Só é apresentada quando
/// `FeatureFlags.paywallEnabled == true` e o usuário não tem entitlement.
struct PaywallView: View {
    @EnvironmentObject var entitlementManager: EntitlementManager
    @Environment(\.dismiss) private var dismiss

    @State private var isWorking = false
    @State private var errorMessage: String?

    private let features: [(icon: String, text: String)] = [
        ("sparkles", "Planos de corrida personalizados por IA"),
        ("arrow.triangle.2.circlepath", "Replanejamento semanal adaptativo"),
        ("chart.line.uptrend.xyaxis", "Análise de evolução e zonas de esforço"),
        ("figure.run", "Blocos de treino com contagem em tempo real"),
    ]

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 24) {
                    VStack(spacing: 8) {
                        Image(systemName: "crown.fill")
                            .font(.system(size: 44))
                            .foregroundStyle(AthlyTheme.Gradient.brand)
                        Text("Athly Premium")
                            .font(AthlyTheme.Typography.heading(28))
                            .foregroundStyle(AthlyTheme.Color.textPrimary)
                        Text("7 dias grátis, depois assinatura. Cancele quando quiser.")
                            .font(AthlyTheme.Typography.body(15))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 32)

                    VStack(alignment: .leading, spacing: 14) {
                        ForEach(features, id: \.text) { feature in
                            HStack(spacing: 12) {
                                Image(systemName: feature.icon)
                                    .foregroundStyle(AthlyTheme.Color.primary)
                                    .frame(width: 28)
                                Text(feature.text)
                                    .font(AthlyTheme.Typography.body(15))
                                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                                Spacer()
                            }
                        }
                    }
                    .padding(20)
                    .background(AthlyTheme.Color.surfaceDark)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .padding(.horizontal, 16)

                    if let errorMessage {
                        Text(errorMessage)
                            .font(AthlyTheme.Typography.body(13))
                            .foregroundStyle(AthlyTheme.Color.error)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 16)
                    }

                    VStack(spacing: 12) {
                        Button {
                            Task { await subscribe() }
                        } label: {
                            HStack {
                                if isWorking { ProgressView().tint(.white) }
                                Text(isWorking ? "Processando..." : "Começar teste grátis")
                                    .font(AthlyTheme.Typography.semibold(16))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(AthlyTheme.Gradient.brand)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                        .disabled(isWorking)

                        Button {
                            Task { await restore() }
                        } label: {
                            Text("Restaurar compras")
                                .font(AthlyTheme.Typography.body(14))
                                .foregroundStyle(AthlyTheme.Color.textSecondary)
                        }
                        .disabled(isWorking)

                        Button {
                            dismiss()
                        } label: {
                            Text("Agora não")
                                .font(AthlyTheme.Typography.body(14))
                                .foregroundStyle(AthlyTheme.Color.textTertiary)
                        }
                    }
                    .padding(.horizontal, 16)

                    Text("Assinaturas gerenciadas pela App Store. O pagamento é cobrado na confirmação e renova automaticamente até ser cancelado nas configurações do Apple ID.")
                        .font(AthlyTheme.Typography.body(11))
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                        .padding(.bottom, 24)
                }
            }
        }
    }

    private func subscribe() async {
        isWorking = true
        errorMessage = nil
        do {
            try await entitlementManager.purchase()
            if entitlementManager.isEntitled { dismiss() }
        } catch {
            errorMessage = error.localizedDescription
        }
        isWorking = false
    }

    private func restore() async {
        isWorking = true
        errorMessage = nil
        do {
            try await entitlementManager.restore()
            if entitlementManager.isEntitled { dismiss() }
        } catch {
            errorMessage = error.localizedDescription
        }
        isWorking = false
    }
}
