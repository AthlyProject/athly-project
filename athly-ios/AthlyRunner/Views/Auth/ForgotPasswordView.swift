import SwiftUI

struct ForgotPasswordView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var codeSent = false

    var body: some View {
        NavigationStack {
            ZStack {
                AthlyTheme.Color.backgroundDark.ignoresSafeArea()
                RadialGradient(
                    colors: [AthlyTheme.Color.primary.opacity(0.12), .clear],
                    center: .top, startRadius: 0, endRadius: 300
                )
                .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 0) {
                        // Close
                        HStack {
                            Button { dismiss() } label: {
                                Image(systemName: "xmark")
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                                    .frame(width: 30, height: 30)
                                    .background(AthlyTheme.Color.surfaceCard)
                                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            Spacer()
                        }
                        .padding(.top, 8)
                        .padding(.bottom, 4)

                        // Heading
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Esqueceu sua senha?")
                                .font(AthlyTheme.Typography.heading(20))
                                .foregroundStyle(AthlyTheme.Color.textPrimary)
                            Text("Informe seu email e enviaremos um código para redefinir sua senha")
                                .font(AthlyTheme.Typography.body(12))
                                .foregroundStyle(AthlyTheme.Color.textSecondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 20)
                        .padding(.bottom, 18)

                        // Email
                        authField(label: String(localized: "Email")) {
                            HStack {
                                TextField("", text: $email)
                                    .font(AthlyTheme.Typography.body(13))
                                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                                    .textContentType(.emailAddress)
                                    .keyboardType(.emailAddress)
                                    .autocapitalization(.none)
                                    .autocorrectionDisabled()
                                Image(systemName: "envelope")
                                    .font(.system(size: 14))
                                    .foregroundStyle(AthlyTheme.Color.textTertiary)
                            }
                        }
                        .padding(.bottom, 16)

                        // Error
                        if let error = authViewModel.errorMessage {
                            Text(error)
                                .font(AthlyTheme.Typography.body(12))
                                .foregroundStyle(AthlyTheme.Color.error)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.bottom, 8)
                        }

                        // Primary CTA
                        Button {
                            Task {
                                let success = await authViewModel.requestPasswordReset(email: email)
                                if success { codeSent = true }
                            }
                        } label: {
                            Group {
                                if authViewModel.isLoading {
                                    ProgressView().tint(.white).scaleEffect(0.85)
                                } else {
                                    Text("Enviar código")
                                        .font(AthlyTheme.Typography.semibold(14))
                                }
                            }
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                            .background(AthlyTheme.Gradient.brand)
                            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
                            .shadow(color: AthlyTheme.Color.primary.opacity(0.20), radius: 16, y: 4)
                            .opacity((email.isEmpty || authViewModel.isLoading) ? 0.55 : 1)
                        }
                        .buttonStyle(.plain)
                        .disabled(email.isEmpty || authViewModel.isLoading)
                        .padding(.bottom, 14)
                    }
                    .padding(.horizontal, 20)
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .navigationBarBackButtonHidden()
            .navigationDestination(isPresented: $codeSent) {
                VerifyResetCodeView(email: email, onFinished: { dismiss() })
            }
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
