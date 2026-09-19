import SwiftUI

/// Conta (design v2): sessão e zona de risco, com o alerta destrutivo de exclusão.
struct AccountSettingsView: View {
    @EnvironmentObject var authViewModel: AuthViewModel

    @State private var showDeleteConfirmation = false
    @State private var isDeletingAccount = false
    @State private var deleteError: String?

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark
                .ignoresSafeArea()

            RadialGradient(
                colors: [AthlyTheme.Color.error.opacity(0.10), .clear],
                center: .init(x: 1.0, y: 0.85),
                startRadius: 0, endRadius: 220
            )
            .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 6) {
                    AthlySectionLabel("Sessão")
                    AthlyListGroup {
                        Button {
                            authViewModel.logout()
                        } label: {
                            AthlyListRow(
                                systemImage: "rectangle.portrait.and.arrow.right",
                                tint: AthlyTheme.Color.textSecondary,
                                iconBackground: AthlyTheme.Color.backgroundAlt,
                                title: Text("Sair da conta"),
                                subtitle: Text("Encerra a sessão neste dispositivo")
                            )
                        }
                        .buttonStyle(.plain)
                    }

                    AthlySectionLabel("Zona de risco", color: AthlyTheme.Color.error)
                    AthlyListGroup(border: AthlyTheme.Color.error.opacity(0.22)) {
                        Button {
                            showDeleteConfirmation = true
                        } label: {
                            AthlyListRow(
                                systemImage: "trash",
                                tint: AthlyTheme.Color.error,
                                title: Text("Excluir conta"),
                                titleColor: AthlyTheme.Color.error,
                                subtitle: Text("Apaga plano, treinos e histórico")
                            ) {
                                if isDeletingAccount {
                                    ProgressView()
                                        .tint(AthlyTheme.Color.error)
                                        .scaleEffect(0.8)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                        .disabled(isDeletingAccount)
                    }

                    Text("A exclusão é permanente e não pode ser desfeita. Todos os seus dados são removidos dos nossos servidores.")
                        .font(AthlyTheme.Typography.body(11))
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 4)
                        .padding(.top, 6)

                    if let deleteError {
                        Text(deleteError)
                            .font(AthlyTheme.Typography.body(11))
                            .foregroundStyle(AthlyTheme.Color.error)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 4)
                    }
                }
                .padding(AthlyTheme.Spacing.sm)
            }
            .scrollContentBackground(.hidden)
            .athlyTabBarContentClearance()
        }
        .navigationTitle("Conta")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Excluir conta", isPresented: $showDeleteConfirmation) {
            Button("Cancelar", role: .cancel) {}
            Button("Excluir", role: .destructive) {
                Task { await deleteAccount() }
            }
        } message: {
            Text("Isso apaga permanentemente sua conta e todos os seus dados (plano, treinos e histórico). Esta ação não pode ser desfeita.")
        }
    }

    private func deleteAccount() async {
        isDeletingAccount = true
        deleteError = nil
        let ok = await authViewModel.deleteAccount()
        isDeletingAccount = false
        if !ok {
            deleteError = authViewModel.errorMessage ?? String(localized: "Não foi possível excluir a conta. Tente novamente.")
        }
        // Em caso de sucesso, authViewModel.isAuthenticated vira false e a RootView volta ao login.
    }
}
