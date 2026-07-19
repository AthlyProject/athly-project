import SwiftUI

/// Etapa exibida após o primeiro login social (Apple/Google): coleta data de nascimento, peso e
/// altura — dados que o provedor não fornece mas que o app precisa antes do questionário.
struct ProfileCompletionView: View {
    @EnvironmentObject var authViewModel: AuthViewModel

    @State private var dateOfBirth = Date()
    @State private var weightText = ""
    @State private var heightText = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    private var isFormValid: Bool {
        !weightText.isEmpty && !heightText.isEmpty
        && Double(weightText.replacingOccurrences(of: ",", with: ".")) != nil
        && Double(heightText.replacingOccurrences(of: ",", with: ".")) != nil
    }

    private var dateOfBirthString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: dateOfBirth)
    }

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: AthlyTheme.Spacing.md) {
                    VStack(spacing: 8) {
                        Text("Complete seu perfil")
                            .font(AthlyTheme.Typography.heading(28))
                            .foregroundStyle(AthlyTheme.Color.textPrimary)

                        Text("Só mais alguns dados para montar seus treinos")
                            .font(AthlyTheme.Typography.body(15))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, AthlyTheme.Spacing.lg)

                    VStack(spacing: 12) {
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

                        if let error = errorMessage {
                            Text(error)
                                .font(AthlyTheme.Typography.body(12))
                                .foregroundStyle(AthlyTheme.Color.error)
                                .multilineTextAlignment(.center)
                        }

                        Button {
                            Task { await submit() }
                        } label: {
                            Group {
                                if isSubmitting {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Text("Continuar")
                                }
                            }
                        }
                        .buttonStyle(AthlyGradientButtonStyle())
                        .disabled(!isFormValid || isSubmitting)
                        .opacity(!isFormValid || isSubmitting ? 0.6 : 1)
                    }
                    .padding(.horizontal, AthlyTheme.Spacing.md)

                    Spacer()
                }
            }
        }
    }

    private func submit() async {
        guard let weight = Double(weightText.replacingOccurrences(of: ",", with: ".")),
              let height = Double(heightText.replacingOccurrences(of: ",", with: ".")) else {
            errorMessage = "Informe peso e altura válidos."
            return
        }

        isSubmitting = true
        errorMessage = nil
        do {
            let request = UpdateProfileRequest(
                weight: weight,
                height: height,
                dateOfBirth: dateOfBirthString
            )
            _ = try await APIClient.shared.updateProfile(request)
            UserMetrics.weightKg = weight
            authViewModel.markProfileCompleted()
        } catch {
            errorMessage = error.localizedDescription
        }
        isSubmitting = false
    }
}
