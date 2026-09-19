import SwiftUI
import RevenueCatUI

/// Ajustes do app (design v2): lembretes, assinatura, integrações, admin, sobre e o acesso
/// à tela de conta. Tudo que era configuração dentro do perfil mora aqui.
struct SettingsView: View {
    let userProfile: UserProfile?

    @EnvironmentObject var authViewModel: AuthViewModel
    @EnvironmentObject var planVM: TrainingPlanViewModel
    @EnvironmentObject var entitlementManager: EntitlementManager

    @State private var profile: UserProfile?
    @State private var remindersEnabled = true
    @State private var showCustomerCenter = false

    private static let adminEmails: Set<String> = [
        "alexandrefonseca998@gmail.com",
    ]

    init(userProfile: UserProfile?) {
        self.userProfile = userProfile
        _profile = State(initialValue: userProfile)
    }

    private var isAdminUser: Bool {
        guard let email = profile?.email else { return false }
        return Self.adminEmails.contains(email.lowercased())
    }

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark
                .ignoresSafeArea()

            RadialGradient(
                colors: [AthlyTheme.Color.primary.opacity(0.12), .clear],
                center: .init(x: 0.0, y: 0.0),
                startRadius: 0, endRadius: 220
            )
            .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 6) {
                    AthlySectionLabel("Lembretes")
                    remindersGroup

                    AthlySectionLabel("Assinatura")
                    subscriptionCard

                    AthlySectionLabel("Integrações")
                    integrationsGroup

                    if isAdminUser {
                        AthlySectionLabel("Admin")
                        adminGroup
                    }

                    AthlySectionLabel("Sobre")
                    aboutGroup

                    AthlySectionLabel("Conta")
                    accountGroup

                    logoutButton
                        .padding(.top, 14)
                }
                .padding(AthlyTheme.Spacing.sm)
            }
            .scrollContentBackground(.hidden)
            .athlyTabBarContentClearance()
        }
        .navigationTitle("Ajustes")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadProfileIfNeeded() }
        .onAppear { remindersEnabled = NotificationService.shared.isEnabled }
        .sheet(isPresented: $showCustomerCenter) {
            CustomerCenterView()
        }
    }

    // MARK: - Lembretes

    private var remindersGroup: some View {
        AthlyListGroup {
            AthlyListRow(
                systemImage: "bell.badge",
                title: Text("Lembretes de treino"),
                subtitle: Text("Notificação no dia do treino agendado")
            ) {
                Toggle("", isOn: $remindersEnabled)
                    .toggleStyle(AthlyToggleTrackStyle())
                    .accessibilityLabel(Text("Lembretes de treino"))
                    .onChange(of: remindersEnabled) { newValue in
                        Task { await NotificationService.shared.setEnabled(newValue, workouts: planVM.allWorkouts) }
                    }
            }
        }
    }

    // MARK: - Assinatura

    private var subscriptionCard: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 9) {
                AthlyIconTile(
                    systemImage: "crown.fill",
                    tint: AthlyTheme.Color.secondary,
                    size: 30
                )

                VStack(alignment: .leading, spacing: 2) {
                    Text(subscriptionTitle)
                        .font(AthlyTheme.Typography.semibold(15))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)

                    HStack(spacing: 5) {
                        Circle()
                            .fill(subscriptionStatusColor)
                            .frame(width: 5, height: 5)
                        Text(subscriptionStatus)
                            .font(AthlyTheme.Typography.semibold(11))
                            .foregroundStyle(subscriptionStatusColor)
                    }
                }

                Spacer(minLength: 0)
            }

            Text(subscriptionDescription)
                .font(AthlyTheme.Typography.body(11))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            Button {
                showCustomerCenter = true
            } label: {
                Text("Gerenciar assinatura")
                    .font(AthlyTheme.Typography.semibold(13))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(AthlyTheme.Gradient.brand)
                    .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous))
                    .shadow(color: AthlyTheme.Color.primaryGlow, radius: 10, y: 4)
            }
            .buttonStyle(.plain)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .athlySurface(border: AthlyTheme.Gradient.brand.opacity(0.5))
    }

    // MARK: - Integrações

    private var integrationsGroup: some View {
        AthlyListGroup {
            NavigationLink {
                HealthKitRunsView(showsPlanTab: false)
            } label: {
                AthlyListRow(
                    systemImage: "heart.fill",
                    tint: AthlyTheme.Color.success,
                    title: Text("Apple Health"),
                    subtitle: Text("Importar corridas do Apple Health")
                ) {
                    AthlyChevron()
                }
            }
            .buttonStyle(.plain)

            AthlyRowDivider()

            NavigationLink {
                ConnectedAccountsView(profile: profile) { updated in profile = updated }
            } label: {
                AthlyListRow(
                    systemImage: "link",
                    title: Text("Contas conectadas"),
                    subtitle: Text(connectedAccountsSummary)
                ) {
                    AthlyChevron()
                }
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Admin

    private var adminGroup: some View {
        AthlyListGroup {
            NavigationLink {
                AdminView()
            } label: {
                AthlyListRow(
                    systemImage: "wrench.and.screwdriver.fill",
                    tint: AthlyTheme.Color.secondary,
                    title: Text("Relatório de dados/IA"),
                    subtitle: Text("Visível apenas para administradores")
                ) {
                    AthlyChevron()
                }
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Sobre

    private var aboutGroup: some View {
        AthlyListGroup {
            AthlyListRow(title: Text("Versão")) {
                AthlyRowValue(text: Bundle.main.appVersionDisplay, color: AthlyTheme.Color.textTertiary)
            }

            AthlyRowDivider()

            NavigationLink {
                PrivacyPolicyView()
            } label: {
                AthlyListRow(title: Text("Política de Privacidade")) { AthlyChevron() }
            }
            .buttonStyle(.plain)

            AthlyRowDivider()

            NavigationLink {
                SupportView()
            } label: {
                AthlyListRow(title: Text("Suporte")) { AthlyChevron() }
            }
            .buttonStyle(.plain)

            AthlyRowDivider()

            Link(destination: URL(string: "https://athlyproject.app/terms")!) {
                AthlyListRow(title: Text("Termos de Uso")) {
                    Image(systemName: "arrow.up.right")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                }
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Conta

    private var accountGroup: some View {
        AthlyListGroup {
            NavigationLink {
                AccountSettingsView()
            } label: {
                AthlyListRow(
                    systemImage: "person.crop.circle",
                    tint: AthlyTheme.Color.textSecondary,
                    iconBackground: AthlyTheme.Color.backgroundAlt,
                    title: Text("Conta"),
                    subtitle: Text("Sessão e exclusão da conta")
                ) {
                    AthlyChevron()
                }
            }
            .buttonStyle(.plain)
        }
    }

    private var logoutButton: some View {
        AthlyWideButton {
            authViewModel.logout()
        } label: {
            Image(systemName: "rectangle.portrait.and.arrow.right")
                .font(.system(size: 13, weight: .semibold))
            Text("Sair da conta")
        }
    }

    // MARK: - Derivados

    private var subscriptionTitle: String {
        entitlementManager.isEntitled ? String(localized: "Athly Pro") : String(localized: "Plano gratuito")
    }

    private var subscriptionStatus: String {
        if let days = entitlementManager.trialDaysRemaining {
            return String(localized: "Teste · \(days) dias restantes")
        }
        return entitlementManager.isEntitled
            ? String(localized: "Assinatura ativa")
            : String(localized: "Sem assinatura ativa")
    }

    private var subscriptionStatusColor: Color {
        if entitlementManager.trialDaysRemaining != nil { return AthlyTheme.Color.warning }
        return entitlementManager.isEntitled ? AthlyTheme.Color.success : AthlyTheme.Color.textTertiary
    }

    private var subscriptionDescription: String {
        if entitlementManager.trialDaysRemaining != nil {
            return String(localized: "Ao fim do teste, assine para continuar com todos os recursos.")
        }
        return entitlementManager.isEntitled
            ? String(localized: "Sua assinatura é cobrada e gerenciada pela App Store.")
            : String(localized: "Assine para desbloquear todos os recursos do Athly.")
    }

    private var connectedAccountsSummary: String {
        var parts: [String] = []
        parts.append(
            profile?.appleLinked == true
                ? String(localized: "Apple vinculada")
                : String(localized: "Apple não vinculada")
        )
        parts.append(
            profile?.googleLinked == true
                ? String(localized: "Google vinculada")
                : String(localized: "Google não vinculada")
        )
        return parts.joined(separator: " · ")
    }

    private func loadProfileIfNeeded() async {
        guard profile == nil else { return }
        profile = try? await APIClient.shared.getUserProfile()
    }
}
