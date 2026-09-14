import SwiftUI

/// Passo 3 (final) do fluxo de "esqueci minha senha": define a nova senha usando o código já
/// confirmado em `VerifyResetCodeView`.
struct ResetPasswordView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.dismiss) private var dismiss

    let email: String
    let code: String
    /// Chamado após redefinir a senha com sucesso e o usuário fechar a tela — fecha todo o
    /// fluxo de "esqueci minha senha" (não só este passo) e volta para o login.
    let onFinished: () -> Void

    @State private var newPassword = ""
    @State private var showPassword = false
    @State private var didSucceed = false

    private var isFormValid: Bool {
        newPassword.count >= 8
    }

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark.ignoresSafeArea()
            RadialGradient(
                colors: [AthlyTheme.Color.secondary.opacity(0.14), .clear],
                center: .topLeading, startRadius: 0, endRadius: 280
            )
            .ignoresSafeArea()

            if didSucceed {
                successContent
            } else {
                formContent
            }
        }
    }

    // MARK: - Form

    private var formContent: some View {
        ScrollView {
            VStack(spacing: 0) {
                // Back + heading
                HStack(alignment: .center, spacing: 10) {
                    Button { dismiss() } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                            .frame(width: 34, height: 34)
                            .background(AthlyTheme.Color.surfaceCard)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .buttonStyle(.plain)

                    VStack(alignment: .leading, spacing: 1) {
                        Text("Nova senha")
                            .font(AthlyTheme.Typography.heading(20))
                            .foregroundStyle(AthlyTheme.Color.textPrimary)
                        Text("Escolha uma nova senha para sua conta")
                            .font(AthlyTheme.Typography.body(12))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                    }
                    Spacer()
                }
                .padding(.top, 8)
                .padding(.bottom, 18)

                // New password
                passwordSection
                    .padding(.bottom, 4)

                // Error
                if let error = authViewModel.errorMessage {
                    Text(error)
                        .font(AthlyTheme.Typography.body(12))
                        .foregroundStyle(AthlyTheme.Color.error)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 8)
                        .padding(.bottom, 8)
                }

                // Primary CTA
                Button {
                    Task {
                        let success = await authViewModel.resetPassword(
                            email: email, code: code, newPassword: newPassword
                        )
                        if success { didSucceed = true }
                    }
                } label: {
                    Group {
                        if authViewModel.isLoading {
                            ProgressView().tint(.white).scaleEffect(0.85)
                        } else {
                            Text("Redefinir senha")
                                .font(AthlyTheme.Typography.semibold(14))
                        }
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(AthlyTheme.Gradient.brand)
                    .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
                    .opacity((!isFormValid || authViewModel.isLoading) ? 0.55 : 1)
                }
                .buttonStyle(.plain)
                .disabled(!isFormValid || authViewModel.isLoading)
                .padding(.top, 14)
            }
            .padding(.horizontal, 20)
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationBarBackButtonHidden()
        .onDisappear { authViewModel.errorMessage = nil }
    }

    private var passwordSection: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(String(localized: "Nova senha").uppercased())
                .font(AthlyTheme.Typography.label())
                .foregroundStyle(AthlyTheme.Color.textTertiary)
                .kerning(0.8)

            HStack {
                Group {
                    if showPassword {
                        TextField("", text: $newPassword)
                    } else {
                        SecureField("", text: $newPassword)
                    }
                }
                .font(AthlyTheme.Typography.body(13))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .textContentType(.newPassword)

                Button { showPassword.toggle() } label: {
                    Image(systemName: showPassword ? "eye.slash" : "eye")
                        .font(.system(size: 14))
                        .foregroundStyle(newPassword.isEmpty ? AthlyTheme.Color.textTertiary : AthlyTheme.Color.primary)
                }
                .buttonStyle(.plain)
            }
            .padding(.vertical, 11)
            .padding(.horizontal, 13)
            .background(AthlyTheme.Color.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                    .stroke(AthlyTheme.Color.borderMid, lineWidth: 1)
            )

            if !newPassword.isEmpty && newPassword.count < 8 {
                Text("A senha deve ter pelo menos 8 caracteres")
                    .font(AthlyTheme.Typography.body(10))
                    .foregroundStyle(AthlyTheme.Color.error)
            }
        }
    }

    // MARK: - Success

    private var successContent: some View {
        VStack(spacing: 14) {
            Spacer()
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 52))
                .foregroundStyle(AthlyTheme.Color.primary)
            Text("Senha atualizada")
                .font(AthlyTheme.Typography.heading(20))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Text("Sua senha foi redefinida. Faça login novamente com a nova senha.")
                .font(AthlyTheme.Typography.body(13))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()

            Button {
                onFinished()
            } label: {
                Text("Ir para o login")
                    .font(AthlyTheme.Typography.semibold(14))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(AthlyTheme.Gradient.brand)
                    .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 20)
            .padding(.bottom, 28)
        }
    }
}
