import SwiftUI
import AuthenticationServices

struct LoginView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var email        = ""
    @State private var password     = ""
    @State private var showPassword = false
    @State private var showRegister = false

    var body: some View {
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

                    // Logo
                    logoBlock
                        .padding(.vertical, 20)

                    // Heading
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Entrar")
                            .font(AthlyTheme.Typography.heading(20))
                            .foregroundStyle(AthlyTheme.Color.textPrimary)
                        Text("Continue de onde parou")
                            .font(AthlyTheme.Typography.body(12))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.bottom, 18)

                    // Email
                    authField(label: "Email") {
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
                    .padding(.bottom, 9)

                    // Password
                    authField(label: "Senha") {
                        HStack {
                            Group {
                                if showPassword {
                                    TextField("", text: $password)
                                } else {
                                    SecureField("", text: $password)
                                }
                            }
                            .font(AthlyTheme.Typography.body(13))
                            .foregroundStyle(AthlyTheme.Color.textPrimary)
                            .textContentType(.password)
                            Button { showPassword.toggle() } label: {
                                Image(systemName: showPassword ? "eye.slash" : "eye")
                                    .font(.system(size: 14))
                                    .foregroundStyle(password.isEmpty ? AthlyTheme.Color.textTertiary : AthlyTheme.Color.primary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.bottom, 4)

                    // Forgot password
                    HStack {
                        Spacer()
                        Button("Esqueceu sua senha?") { }
                            .font(AthlyTheme.Typography.semibold(11))
                            .foregroundStyle(AthlyTheme.Color.primary)
                            .buttonStyle(.plain)
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
                        Task { await authViewModel.login(email: email, password: password) }
                    } label: {
                        Group {
                            if authViewModel.isLoading {
                                ProgressView().tint(.white).scaleEffect(0.85)
                            } else {
                                Text("Entrar")
                                    .font(AthlyTheme.Typography.semibold(14))
                            }
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(AthlyTheme.Gradient.brand)
                        .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
                        .shadow(color: AthlyTheme.Color.primary.opacity(0.20), radius: 16, y: 4)
                        .opacity((email.isEmpty || password.isEmpty || authViewModel.isLoading) ? 0.55 : 1)
                    }
                    .buttonStyle(.plain)
                    .disabled(email.isEmpty || password.isEmpty || authViewModel.isLoading)
                    .padding(.bottom, 14)

                    authDivider("ou continue com")
                        .padding(.bottom, 10)

                    socialButtons
                        .padding(.bottom, 14)

                    // Footer
                    HStack(spacing: 4) {
                        Text("Não tem conta?")
                            .font(AthlyTheme.Typography.body(12))
                            .foregroundStyle(AthlyTheme.Color.textTertiary)
                        Button("Criar conta") { showRegister = true }
                            .font(AthlyTheme.Typography.semibold(12))
                            .foregroundStyle(AthlyTheme.Color.primary)
                            .buttonStyle(.plain)
                    }
                    .padding(.bottom, 28)
                }
                .padding(.horizontal, 20)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .sheet(isPresented: $showRegister) { RegisterView() }
    }

    // MARK: - Sub-views

    private var logoBlock: some View {
        VStack(spacing: 10) {
            Image("AthlyLogo")
                .resizable()
                .scaledToFit()
                .frame(width: 54, height: 54)
                .clipShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
                .shadow(color: AthlyTheme.Color.primary.opacity(0.28), radius: 12, y: 6)
            Text("Athly")
                .font(AthlyTheme.Typography.heading(20))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Text("Bem-vindo de volta")
                .font(AthlyTheme.Typography.body(11))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
        }
    }

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

    private func authDivider(_ label: String) -> some View {
        HStack(spacing: 10) {
            Rectangle().fill(AthlyTheme.Color.borderMid).frame(height: 1)
            Text(label)
                .font(AthlyTheme.Typography.body(10))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
                .fixedSize()
                .kerning(0.5)
                .textCase(.uppercase)
            Rectangle().fill(AthlyTheme.Color.borderMid).frame(height: 1)
        }
    }

    private var socialButtons: some View {
        VStack(spacing: 8) {
            SignInWithAppleButton(.signIn) { request in
                request.requestedScopes = [.fullName, .email]
            } onCompletion: { result in
                switch result {
                case .success(let auth):
                    guard let credential = auth.credential as? ASAuthorizationAppleIDCredential else { return }
                    Task { await authViewModel.signInWithApple(credential: credential) }
                case .failure(let error):
                    if (error as? ASAuthorizationError)?.code != .canceled {
                        Task { @MainActor in authViewModel.errorMessage = error.localizedDescription }
                    }
                }
            }
            .signInWithAppleButtonStyle(.white)
            .frame(height: 44)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))

            Button {
                Task { await authViewModel.signInWithGoogle() }
            } label: {
                HStack(spacing: 9) {
                    Image(systemName: "g.circle.fill")
                        .font(.system(size: 16, weight: .semibold))
                    Text("Continuar com Google")
                        .font(AthlyTheme.Typography.semibold(13))
                }
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(AthlyTheme.Color.surfaceCard)
                .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                        .stroke(AthlyTheme.Color.borderMid, lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
        }
    }
}
