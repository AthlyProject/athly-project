import SwiftUI
import AuthenticationServices

struct LoginView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @State private var email = ""
    @State private var password = ""
    @State private var showRegister = false

    var body: some View {
        NavigationStack {
            ZStack {
                AthlyTheme.Color.backgroundDark
                    .ignoresSafeArea()

                RadialGradient(
                    colors: [
                        AthlyTheme.Color.primary.opacity(0.12),
                        AthlyTheme.Color.backgroundDark
                    ],
                    center: .top,
                    startRadius: 0,
                    endRadius: 400
                )
                .ignoresSafeArea()

                VStack(spacing: AthlyTheme.Spacing.lg) {
                    Spacer()

                    // Logo
                    VStack(spacing: 16) {
                        Image("AthlyLogo")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 100, height: 100)
                            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))

                        Text("Athly")
                            .font(AthlyTheme.Typography.heading(34))
                            .foregroundStyle(AthlyTheme.Gradient.brand)

                        Text("Seu tracker de corrida inteligente")
                            .font(AthlyTheme.Typography.body(15))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                    }

                    // Form
                    VStack(spacing: 12) {
                        TextField("Email", text: $email)
                            .textFieldStyle(AthlyTextFieldStyle())
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)

                        SecureField("Senha", text: $password)
                            .textFieldStyle(AthlyTextFieldStyle())
                            .textContentType(.password)

                        if let error = authViewModel.errorMessage {
                            Text(error)
                                .font(AthlyTheme.Typography.body(12))
                                .foregroundStyle(AthlyTheme.Color.error)
                                .multilineTextAlignment(.center)
                        }

                        Button {
                            Task {
                                await authViewModel.login(email: email, password: password)
                            }
                        } label: {
                            Group {
                                if authViewModel.isLoading {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Text("Entrar")
                                }
                            }
                        }
                        .buttonStyle(AthlyGradientButtonStyle())
                        .disabled(email.isEmpty || password.isEmpty || authViewModel.isLoading)
                        .opacity(email.isEmpty || password.isEmpty || authViewModel.isLoading ? 0.6 : 1)

                        socialSignInSection
                    }
                    .padding(.horizontal, AthlyTheme.Spacing.md)

                    Spacer()

                    Button("Criar conta") {
                        showRegister = true
                    }
                    .font(AthlyTheme.Typography.medium(16))
                    .foregroundStyle(AthlyTheme.Color.primary)
                    .padding(.bottom, AthlyTheme.Spacing.lg)
                }
            }
            .sheet(isPresented: $showRegister) {
                RegisterView()
            }
        }
    }

    // MARK: - Login social

    private var socialSignInSection: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                dividerLine
                Text("ou continue com")
                    .font(AthlyTheme.Typography.body(12))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                    .fixedSize()
                dividerLine
            }
            .padding(.vertical, 4)

            SignInWithAppleButton(.signIn) { request in
                request.requestedScopes = [.fullName, .email]
            } onCompletion: { result in
                switch result {
                case .success(let auth):
                    guard let credential = auth.credential as? ASAuthorizationAppleIDCredential else { return }
                    Task { await authViewModel.signInWithApple(credential: credential) }
                case .failure(let error):
                    // Cancelamento do usuário não é erro exibível.
                    if (error as? ASAuthorizationError)?.code != .canceled {
                        Task { @MainActor in
                            authViewModel.errorMessage = error.localizedDescription
                        }
                    }
                }
            }
            .signInWithAppleButtonStyle(.white)
            .frame(height: 50)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
            .disabled(authViewModel.isLoading)

            Button {
                Task { await authViewModel.signInWithGoogle() }
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: "g.circle.fill")
                        .font(.system(size: 18, weight: .semibold))
                    Text("Continuar com Google")
                        .font(AthlyTheme.Typography.medium(16))
                }
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .background(AthlyTheme.Color.surfaceDark)
                .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                        .stroke(AthlyTheme.Color.textSecondary.opacity(0.25), lineWidth: 1)
                )
            }
            .disabled(authViewModel.isLoading)
        }
    }

    private var dividerLine: some View {
        Rectangle()
            .fill(AthlyTheme.Color.textSecondary.opacity(0.25))
            .frame(height: 1)
    }
}
