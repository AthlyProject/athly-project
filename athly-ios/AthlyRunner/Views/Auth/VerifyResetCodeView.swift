import SwiftUI

/// Passo 2 do fluxo de "esqueci minha senha": confirma o código de 6 dígitos enviado por email
/// antes de avançar para a tela de nova senha (`ResetPasswordView`).
struct VerifyResetCodeView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.dismiss) private var dismiss

    let email: String
    /// Fecha todo o fluxo de "esqueci minha senha" (não só este passo) e volta para o login.
    let onFinished: () -> Void

    @State private var code = ""
    @State private var codeVerified = false

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark.ignoresSafeArea()
            RadialGradient(
                colors: [AthlyTheme.Color.secondary.opacity(0.14), .clear],
                center: .topLeading, startRadius: 0, endRadius: 280
            )
            .ignoresSafeArea()

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
                            Text("Digite o código")
                                .font(AthlyTheme.Typography.heading(20))
                                .foregroundStyle(AthlyTheme.Color.textPrimary)
                            Text("Enviamos um código para \(email)")
                                .font(AthlyTheme.Typography.body(12))
                                .foregroundStyle(AthlyTheme.Color.textSecondary)
                                .lineLimit(1)
                                .truncationMode(.middle)
                        }
                        Spacer()
                    }
                    .padding(.top, 8)
                    .padding(.bottom, 18)

                    // Code
                    authField(label: String(localized: "Código")) {
                        TextField("", text: $code)
                            .font(AthlyTheme.Typography.body(13))
                            .foregroundStyle(AthlyTheme.Color.textPrimary)
                            .keyboardType(.numberPad)
                            .textContentType(.oneTimeCode)
                            .onChange(of: code) { newValue in
                                code = String(newValue.filter(\.isNumber).prefix(6))
                            }
                    }
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
                            let success = await authViewModel.verifyResetCode(email: email, code: code)
                            if success { codeVerified = true }
                        }
                    } label: {
                        Group {
                            if authViewModel.isLoading {
                                ProgressView().tint(.white).scaleEffect(0.85)
                            } else {
                                Text("Continuar")
                                    .font(AthlyTheme.Typography.semibold(14))
                            }
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(AthlyTheme.Gradient.brand)
                        .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
                        .opacity((code.count != 6 || authViewModel.isLoading) ? 0.55 : 1)
                    }
                    .buttonStyle(.plain)
                    .disabled(code.count != 6 || authViewModel.isLoading)
                    .padding(.top, 14)
                }
                .padding(.horizontal, 20)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .navigationBarBackButtonHidden()
        .navigationDestination(isPresented: $codeVerified) {
            ResetPasswordView(email: email, code: code, onFinished: onFinished)
        }
        .onDisappear { authViewModel.errorMessage = nil }
    }

    // MARK: - Helpers

    private func authField<Content: View>(label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label.uppercased())
                .font(AthlyTheme.Typography.label())
                .foregroundStyle(AthlyTheme.Color.textTertiary)
                .kerning(0.8)
            content()
                .padding(.vertical, 11)
                .padding(.horizontal, 13)
                .background(AthlyTheme.Color.surfaceCard)
                .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                        .stroke(AthlyTheme.Color.borderMid, lineWidth: 1)
                )
        }
    }
}
