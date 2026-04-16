import SwiftUI

struct CreatePlanView: View {
    @EnvironmentObject var planVM: TrainingPlanViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var goalText: String = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String? = nil
    @State private var parsedGoal: ParsedGoal? = nil
    @State private var showConfirmation = false

    private let suggestions = [
        "Quero correr 5km sem parar",
        "Quero completar uma meia maratona em 6 meses",
        "Quero melhorar meu tempo no 10km para menos de 50 min",
        "Quero começar a correr e ter mais disposição",
        "Quero preparar para minha primeira maratona",
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                AthlyTheme.Color.backgroundDark.ignoresSafeArea()

                if showConfirmation, let goal = parsedGoal {
                    confirmationView(goal)
                } else {
                    inputView
                }
            }
            .navigationTitle("Novo Plano")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }
            }
        }
    }

    // MARK: - Input View

    private var inputView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AthlyTheme.Spacing.md) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    Text("Qual é o seu objetivo?")
                        .font(AthlyTheme.Typography.heading(22))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                    Text("Descreva em suas palavras o que você quer conquistar correndo.")
                        .font(AthlyTheme.Typography.body(15))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }
                .padding(.top, 8)

                // Text input
                VStack(alignment: .leading, spacing: 8) {
                    TextEditor(text: $goalText)
                        .frame(minHeight: 120, maxHeight: 180)
                        .padding(12)
                        .background(AthlyTheme.Color.surfaceCard)
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous)
                                .stroke(goalText.isEmpty ? AthlyTheme.Color.textTertiary.opacity(0.3) : AthlyTheme.Color.primary.opacity(0.5), lineWidth: 1)
                        )
                        .scrollContentBackground(.hidden)

                    Text("\(goalText.count)/500")
                        .font(AthlyTheme.Typography.body(12))
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }

                // Suggestions
                VStack(alignment: .leading, spacing: 10) {
                    Text("Exemplos")
                        .font(AthlyTheme.Typography.semibold(13))
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                        .textCase(.uppercase)
                        .kerning(0.5)

                    ForEach(suggestions, id: \.self) { suggestion in
                        Button {
                            goalText = suggestion
                        } label: {
                            HStack {
                                Image(systemName: "lightbulb.fill")
                                    .font(.system(size: 12))
                                    .foregroundStyle(AthlyTheme.Color.primary.opacity(0.7))
                                Text(suggestion)
                                    .font(AthlyTheme.Typography.body(14))
                                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                                    .multilineTextAlignment(.leading)
                                Spacer()
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(AthlyTheme.Color.surfaceCard)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }

                // Error
                if let error = errorMessage {
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: "exclamationmark.circle.fill")
                            .foregroundStyle(AthlyTheme.Color.error)
                        Text(error)
                            .font(AthlyTheme.Typography.body(14))
                            .foregroundStyle(AthlyTheme.Color.error)
                    }
                    .padding(14)
                    .background(AthlyTheme.Color.error.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }

                // Submit button
                Button {
                    Task { await submitGoal() }
                } label: {
                    HStack(spacing: 8) {
                        if isSubmitting {
                            ProgressView()
                                .tint(.white)
                                .scaleEffect(0.85)
                            Text("Interpretando objetivo...")
                        } else {
                            Image(systemName: "sparkles")
                            Text("Criar meu plano")
                        }
                    }
                }
                .buttonStyle(AthlyGradientButtonStyle())
                .disabled(goalText.count < 10 || isSubmitting)
                .padding(.top, 8)
            }
            .padding(AthlyTheme.Spacing.sm)
        }
        .scrollContentBackground(.hidden)
    }

    // MARK: - Confirmation View

    private func confirmationView(_ goal: ParsedGoal) -> some View {
        VStack(spacing: AthlyTheme.Spacing.md) {
            Spacer()

            VStack(spacing: 16) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(AthlyTheme.Color.success)

                Text("Objetivo entendido!")
                    .font(AthlyTheme.Typography.heading(22))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)

                Text(goal.summary)
                    .font(AthlyTheme.Typography.semibold(17))
                    .foregroundStyle(AthlyTheme.Color.primary)
                    .multilineTextAlignment(.center)

                VStack(spacing: 8) {
                    if let distance = goal.targetDistance {
                        detailRow(icon: "flag.fill", text: "Distância alvo: \(distance)")
                    }
                    if let time = goal.targetTime {
                        detailRow(icon: "clock.fill", text: "Tempo alvo: \(time)")
                    }
                    if let eventName = goal.eventName {
                        detailRow(icon: "calendar", text: "Evento: \(eventName)")
                    }
                    if let level = goal.experienceLevel {
                        let levelMap = ["beginner": "Iniciante", "intermediate": "Intermediário", "advanced": "Avançado"]
                        detailRow(icon: "chart.bar.fill", text: "Nível: \(levelMap[level] ?? level)")
                    }
                }
                .padding(16)
                .background(AthlyTheme.Color.surfaceCard)
                .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous))
            }
            .padding(AthlyTheme.Spacing.sm)
            .athlyCard()
            .padding(.horizontal, AthlyTheme.Spacing.sm)

            Spacer()

            VStack(spacing: 12) {
                Button {
                    Task {
                        await planVM.generateNextWeekWithHealth()
                        dismiss()
                    }
                } label: {
                    HStack {
                        if planVM.isGenerating {
                            ProgressView().tint(.white).scaleEffect(0.85)
                            Text("Gerando treinos...")
                        } else {
                            Image(systemName: "sparkles")
                            Text("Gerar primeira semana de treinos")
                        }
                    }
                }
                .buttonStyle(AthlyGradientButtonStyle())
                .disabled(planVM.isGenerating)

                Button {
                    dismiss()
                } label: {
                    Text("Fazer isso depois")
                        .font(AthlyTheme.Typography.body(15))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }
                .buttonStyle(.plain)
            }
            .padding(AthlyTheme.Spacing.sm)
        }
    }

    private func detailRow(icon: String, text: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 13))
                .foregroundStyle(AthlyTheme.Color.primary)
                .frame(width: 20)
            Text(text)
                .font(AthlyTheme.Typography.body(14))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
            Spacer()
        }
    }

    // MARK: - Actions

    private func submitGoal() async {
        guard goalText.count >= 10 else { return }
        isSubmitting = true
        errorMessage = nil

        do {
            let response = try await APIClient.shared.createGoal(CreateGoalRequest(goalText: goalText))
            parsedGoal = response.parsedGoal
            withAnimation { showConfirmation = true }
        } catch APIError.serverError(let code, let message) {
            if code == 422 {
                // Extract message from JSON if possible
                if let data = message.data(using: .utf8),
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let msg = json["message"] as? String {
                    errorMessage = msg
                } else {
                    errorMessage = "Objetivo não reconhecido como corrida. Tente descrever uma meta relacionada a correr."
                }
            } else {
                errorMessage = "Erro ao processar objetivo. Tente novamente."
            }
        } catch {
            errorMessage = "Erro de conexão. Verifique sua internet e tente novamente."
        }

        isSubmitting = false
    }
}
