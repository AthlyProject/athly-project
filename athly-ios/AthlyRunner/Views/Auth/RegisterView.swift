import SwiftUI

struct RegisterView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.dismiss) var dismiss

    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""

    private var passwordsMatch: Bool {
        !password.isEmpty && password == confirmPassword
    }

    private var isFormValid: Bool {
        !name.isEmpty && !email.isEmpty && passwordsMatch
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AthlyTheme.Color.backgroundDark
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: AthlyTheme.Spacing.md) {
                        VStack(spacing: 8) {
                            Text("Criar conta")
                                .font(AthlyTheme.Typography.heading(28))
                                .foregroundStyle(AthlyTheme.Color.textPrimary)

                            Text("Comece a registrar suas corridas")
                                .font(AthlyTheme.Typography.body(15))
                                .foregroundStyle(AthlyTheme.Color.textSecondary)
                        }
                        .padding(.top, AthlyTheme.Spacing.lg)

                        VStack(spacing: 12) {
                            TextField("Nome", text: $name)
                                .textFieldStyle(AthlyTextFieldStyle())
                                .textContentType(.name)

                            TextField("Email", text: $email)
                                .textFieldStyle(AthlyTextFieldStyle())
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .autocapitalization(.none)

                            SecureField("Senha", text: $password)
                                .textFieldStyle(AthlyTextFieldStyle())
                                .textContentType(.newPassword)

                            SecureField("Confirmar senha", text: $confirmPassword)
                                .textFieldStyle(AthlyTextFieldStyle())
                                .textContentType(.newPassword)

                            if !confirmPassword.isEmpty && !passwordsMatch {
                                Text("As senhas não coincidem")
                                    .font(AthlyTheme.Typography.body(12))
                                    .foregroundStyle(AthlyTheme.Color.error)
                            }

                            if let error = authViewModel.errorMessage {
                                Text(error)
                                    .font(AthlyTheme.Typography.body(12))
                                    .foregroundStyle(AthlyTheme.Color.error)
                                    .multilineTextAlignment(.center)
                            }

                            Button {
                                Task {
                                    await authViewModel.register(name: name, email: email, password: password)
                                    if authViewModel.isAuthenticated {
                                        dismiss()
                                    }
                                }
                            } label: {
                                Group {
                                    if authViewModel.isLoading {
                                        ProgressView()
                                            .tint(.white)
                                    } else {
                                        Text("Registrar")
                                    }
                                }
                            }
                            .buttonStyle(AthlyGradientButtonStyle())
                            .disabled(!isFormValid || authViewModel.isLoading)
                            .opacity(!isFormValid || authViewModel.isLoading ? 0.6 : 1)
                        }
                        .padding(.horizontal, AthlyTheme.Spacing.md)

                        Spacer()
                    }
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                        .foregroundStyle(AthlyTheme.Color.primary)
                }
            }
        }
    }
}
