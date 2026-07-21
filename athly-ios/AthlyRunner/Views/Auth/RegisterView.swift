import SwiftUI

struct RegisterView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.dismiss) var dismiss

    @State private var email = ""
    @State private var password = ""

    private var isFormValid: Bool {
        !email.isEmpty && !password.isEmpty
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
                            TextField("Email", text: $email)
                                .textFieldStyle(AthlyTextFieldStyle())
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .autocapitalization(.none)

                            SecureField("Senha (mínimo 8 caracteres)", text: $password)
                                .textFieldStyle(AthlyTextFieldStyle())
                                .textContentType(.newPassword)

                            if let error = authViewModel.errorMessage {
                                Text(error)
                                    .font(AthlyTheme.Typography.body(12))
                                    .foregroundStyle(AthlyTheme.Color.error)
                                    .multilineTextAlignment(.center)
                            }

                            Button {
                                Task {
                                    await authViewModel.register(email: email, password: password)
                                    if authViewModel.isAuthenticated { dismiss() }
                                }
                            } label: {
                                Group {
                                    if authViewModel.isLoading {
                                        ProgressView().tint(.white)
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
