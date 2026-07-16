import SwiftUI
import RevenueCat

struct AthlyPaywallView: View {
    let founderEligible: Bool
    let onPurchaseCompleted: (CustomerInfo) -> Void
    let onRestoreCompleted: (CustomerInfo) -> Void

    @State private var offering: Offering?
    @State private var selectedPackage: Package?
    @State private var didFinishLoading = false
    @State private var isPurchasing = false
    @State private var isRestoring = false
    @State private var errorMessage: String?

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                AthlyTheme.Color.backgroundDark
                    .ignoresSafeArea()

                if didFinishLoading {
                    if let offering, !orderedPackages(from: offering).isEmpty {
                        paywallContent(for: offering)
                    } else {
                        unavailableState
                    }
                } else {
                    ProgressView()
                        .tint(AthlyTheme.Color.primary)
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                            .frame(width: 34, height: 34)
                            .background(AthlyTheme.Color.surfaceCard)
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .task(id: founderEligible) {
                await loadOffering()
            }
        }
    }

    private func paywallContent(for offering: Offering) -> some View {
        let packages = orderedPackages(from: offering)

        return ScrollView {
            VStack(spacing: 20) {
                hero

                VStack(spacing: 10) {
                    ForEach(packages, id: \.identifier) { package in
                        packageButton(package)
                    }
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(AthlyTheme.Typography.body(13))
                        .foregroundStyle(AthlyTheme.Color.error)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .padding(12)
                        .background(AthlyTheme.Color.error.opacity(0.10))
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }

                Button {
                    Task { await purchaseSelectedPackage() }
                } label: {
                    HStack(spacing: 8) {
                        if isPurchasing {
                            ProgressView()
                                .tint(.white)
                                .scaleEffect(0.85)
                        } else {
                            Image(systemName: "checkmark.seal.fill")
                        }
                        Text(isPurchasing ? "Confirmando..." : ctaTitle)
                    }
                }
                .buttonStyle(AthlyGradientButtonStyle())
                .disabled(selectedPackage == nil || isPurchasing || isRestoring)

                Button {
                    Task { await restorePurchases() }
                } label: {
                    HStack(spacing: 8) {
                        if isRestoring {
                            ProgressView()
                                .tint(AthlyTheme.Color.primary)
                                .scaleEffect(0.85)
                        } else {
                            Image(systemName: "arrow.clockwise")
                        }
                        Text(isRestoring ? "Restaurando..." : "Restaurar compra")
                    }
                    .font(AthlyTheme.Typography.semibold(14))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                }
                .buttonStyle(.plain)
                .disabled(isPurchasing || isRestoring)

                legalText
            }
            .padding(.horizontal, AthlyTheme.Spacing.sm)
            .padding(.top, 20)
            .padding(.bottom, 28)
        }
        .scrollContentBackground(.hidden)
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 12) {
                Image("AthlyLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 54, height: 54)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                VStack(alignment: .leading, spacing: 4) {
                    Text(founderEligible ? "Athly Founder" : "Athly Basic")
                        .font(AthlyTheme.Typography.heading(26))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                    Text("Planos inteligentes para evoluir sem improviso.")
                        .font(AthlyTheme.Typography.body(14))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }
            }

            VStack(spacing: 12) {
                featureRow(icon: "sparkles", text: "Semanas de treino geradas com base no seu histórico.")
                featureRow(icon: "heart.text.square", text: "Carga ajustada ao que você realmente correu.")
                featureRow(icon: "chart.line.uptrend.xyaxis", text: "Análise objetiva de evolução e aderência.")
            }
        }
        .padding(18)
        .athlyInsightCard()
    }

    private func featureRow(icon: String, text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(AthlyTheme.Color.primary)
                .frame(width: 22)
            Text(text)
                .font(AthlyTheme.Typography.body(14))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
    }

    private func packageButton(_ package: Package) -> some View {
        let selected = package.identifier == selectedPackage?.identifier

        return Button {
            withAnimation(.easeOut(duration: 0.18)) {
                selectedPackage = package
                errorMessage = nil
            }
        } label: {
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .stroke(selected ? AthlyTheme.Color.primary : AthlyTheme.Color.glassBorder, lineWidth: 2)
                        .frame(width: 22, height: 22)
                    if selected {
                        Circle()
                            .fill(AthlyTheme.Color.primary)
                            .frame(width: 12, height: 12)
                    }
                }

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text(packageTitle(package))
                            .font(AthlyTheme.Typography.semibold(16))
                            .foregroundStyle(AthlyTheme.Color.textPrimary)
                        if package.packageType == .annual {
                            Text("Melhor valor")
                                .font(AthlyTheme.Typography.semibold(11))
                                .foregroundStyle(AthlyTheme.Color.backgroundDark)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(AthlyTheme.Color.primary)
                                .clipShape(Capsule())
                        }
                    }
                    Text(packageSubtitle(package))
                        .font(AthlyTheme.Typography.body(13))
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                }

                Spacer(minLength: 8)

                Text(package.localizedPriceString)
                    .font(AthlyTheme.Typography.semibold(17))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            .padding(16)
            .background(selected ? AthlyTheme.Color.primary.opacity(0.12) : AthlyTheme.Color.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(selected ? AthlyTheme.Color.primary : AthlyTheme.Color.glassBorder, lineWidth: selected ? 1.5 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var legalText: some View {
        VStack(spacing: 8) {
            Text("A assinatura e cobrada pela Apple e renova automaticamente ate ser cancelada. Voce pode cancelar nas configuracoes da App Store.")
                .font(AthlyTheme.Typography.body(11))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 16) {
                Link("Termos", destination: URL(string: "https://athlyproject.app/terms")!)
                Link("Privacidade", destination: URL(string: "https://athlyproject.app/privacy")!)
            }
            .font(AthlyTheme.Typography.semibold(12))
            .foregroundStyle(AthlyTheme.Color.primary)
        }
    }

    private var unavailableState: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 34))
                .foregroundStyle(AthlyTheme.Color.warning)
            Text("Assinaturas indisponíveis")
                .font(AthlyTheme.Typography.heading(22))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Text("Nao foi possivel carregar os planos agora. Confira a configuracao da App Store e tente novamente.")
                .font(AthlyTheme.Typography.body(14))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
            Button("Tentar novamente") {
                Task { await loadOffering() }
            }
            .buttonStyle(AthlyGradientButtonStyle())
            .padding(.horizontal, AthlyTheme.Spacing.sm)
        }
    }

    private var ctaTitle: String {
        guard let selectedPackage else { return "Continuar" }
        return "Continuar com \(packageTitle(selectedPackage).lowercased())"
    }

    private func orderedPackages(from offering: Offering) -> [Package] {
        let preferred = [offering.annual, offering.monthly].compactMap { $0 }
        let preferredIDs = Set(preferred.map(\.identifier))
        return preferred + offering.availablePackages.filter { !preferredIDs.contains($0.identifier) }
    }

    private func packageTitle(_ package: Package) -> String {
        switch package.packageType {
        case .annual:
            return "Plano anual"
        case .monthly:
            return "Plano mensal"
        default:
            return package.storeProduct.localizedTitle.isEmpty ? "Plano Athly" : package.storeProduct.localizedTitle
        }
    }

    private func packageSubtitle(_ package: Package) -> String {
        switch package.packageType {
        case .annual:
            return "Acesso por 12 meses"
        case .monthly:
            return "Acesso mensal flexivel"
        default:
            return "Acesso Basic"
        }
    }

    @MainActor
    private func loadOffering() async {
        didFinishLoading = false
        offering = nil
        selectedPackage = nil
        errorMessage = nil

        guard Purchases.isConfigured else {
            didFinishLoading = true
            errorMessage = "RevenueCat nao esta configurado nesta build."
            return
        }

        let desiredOffering = founderEligible ? "founder" : "default"
        let offerings = try? await Purchases.shared.offerings()
        let loadedOffering = offerings?.offering(identifier: desiredOffering) ?? offerings?.current
        offering = loadedOffering
        selectedPackage = loadedOffering.flatMap { orderedPackages(from: $0).first }
        didFinishLoading = true
    }

    @MainActor
    private func purchaseSelectedPackage() async {
        guard let selectedPackage else { return }
        isPurchasing = true
        errorMessage = nil

        do {
            let result = try await Purchases.shared.purchase(package: selectedPackage)
            if !result.userCancelled {
                onPurchaseCompleted(result.customerInfo)
                dismiss()
            }
        } catch {
            errorMessage = "Nao foi possivel concluir a compra. Tente novamente."
        }

        isPurchasing = false
    }

    @MainActor
    private func restorePurchases() async {
        isRestoring = true
        errorMessage = nil

        do {
            let info = try await Purchases.shared.restorePurchases()
            onRestoreCompleted(info)
            dismiss()
        } catch {
            errorMessage = "Nao foi possivel restaurar a compra. Tente novamente."
        }

        isRestoring = false
    }
}
