import SwiftUI

struct RegisterView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.dismiss) var dismiss

    @State private var name = ""
    @State private var userName = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var dateOfBirth = Date()
    @State private var weightText = ""
    @State private var heightText = ""

    private var passwordsMatch: Bool {
        !password.isEmpty && password == confirmPassword
    }

    private var isFormValid: Bool {
        !name.isEmpty && !userName.isEmpty && !email.isEmpty && passwordsMatch
        && !weightText.isEmpty && !heightText.isEmpty
    }

    private var dateOfBirthString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: dateOfBirth)
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
                            TextField("Nome completo", text: $name)
                                .textFieldStyle(AthlyTextFieldStyle())
                                .textContentType(.name)

                            TextField("Username", text: $userName)
                                .textFieldStyle(AthlyTextFieldStyle())
                                .textContentType(.username)
                                .autocapitalization(.none)

                            TextField("Email", text: $email)
                                .textFieldStyle(AthlyTextFieldStyle())
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .autocapitalization(.none)

                            SecureField("Senha (mínimo 8 caracteres)", text: $password)
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

                            DatePicker("Data de nascimento", selection: $dateOfBirth, displayedComponents: .date)
                                .datePickerStyle(.compact)
                                .foregroundStyle(AthlyTheme.Color.textPrimary)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 12)

                            TextField("Peso (kg)", text: $weightText)
                                .textFieldStyle(AthlyTextFieldStyle())
                                .keyboardType(.decimalPad)

                            TextField("Altura (cm)", text: $heightText)
                                .textFieldStyle(AthlyTextFieldStyle())
                                .keyboardType(.decimalPad)

                            if let error = authViewModel.errorMessage {
                                Text(error)
                                    .font(AthlyTheme.Typography.body(12))
                                    .foregroundStyle(AthlyTheme.Color.error)
                                    .multilineTextAlignment(.center)
                            }

                            Button {
                                Task {
                                    let weight = Double(weightText) ?? 0
                                    let height = Double(heightText) ?? 0
                                    await authViewModel.register(
                                        email: email,
                                        userName: userName,
                                        name: name,
                                        password: password,
                                        confirmPassword: confirmPassword,
                                        dateOfBirth: dateOfBirthString,
                                        weight: weight,
                                        height: height
                                    )
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
