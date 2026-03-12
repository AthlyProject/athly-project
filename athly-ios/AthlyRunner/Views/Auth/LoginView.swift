import SwiftUI

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

                        Text("Athly Runner")
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
}
