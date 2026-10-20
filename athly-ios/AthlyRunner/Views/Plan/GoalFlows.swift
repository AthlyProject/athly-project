import SwiftUI

/// Etapa do fluxo de meta do onboarding, apresentado numa única tela cheia (avaliação → análise),
/// para não fechar e reabrir a tela entre as duas.
enum GoalFlowStage: String, Identifiable {
    case assessment
    case analysis
    var id: String { rawValue }
}

/// Onboarding: avaliação (cria a meta) e, em seguida, a análise da meta antes da 1ª semana.
/// Reaberto em `.analysis` quando o atleta saiu do app com a meta definida e sem plano.
struct OnboardingGoalFlowView: View {
    @State private var stage: GoalFlowStage
    @StateObject private var analysisVM = GoalAnalysisViewModel(mode: .onboarding, detailedLimit: 5)
    let onAssessmentCompleted: () -> Void
    let onFinish: (GoalAnalysisViewModel.Outcome) -> Void

    init(
        startAt stage: GoalFlowStage,
        onAssessmentCompleted: @escaping () -> Void,
        onFinish: @escaping (GoalAnalysisViewModel.Outcome) -> Void
    ) {
        _stage = State(initialValue: stage)
        self.onAssessmentCompleted = onAssessmentCompleted
        self.onFinish = onFinish
    }

    var body: some View {
        switch stage {
        case .assessment:
            AssessmentView {
                onAssessmentCompleted()
                withAnimation(.easeOut(duration: 0.25)) { stage = .analysis }
            }
        case .analysis:
            GoalAnalysisView(viewModel: analysisVM, onFinish: onFinish)
                .transition(.opacity)
        }
    }
}

/// Troca de meta no meio do ciclo: editar a meta (as perguntas do onboarding) e ver a análise
/// antes de confirmar. A meta só muda ao confirmar.
struct GoalChangeFlowView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var form: GoalFormState
    @State private var analysisVM: GoalAnalysisViewModel?
    let onFinish: (GoalAnalysisViewModel.Outcome) -> Void

    init(current: ParsedGoal?, onFinish: @escaping (GoalAnalysisViewModel.Outcome) -> Void) {
        _form = State(initialValue: GoalFormState(parsedGoal: current))
        self.onFinish = onFinish
    }

    var body: some View {
        ZStack {
            if let analysisVM {
                GoalAnalysisView(viewModel: analysisVM, onFinish: { outcome in
                    onFinish(outcome)
                    dismiss()
                }, onBack: { self.analysisVM = nil })
                .transition(.move(edge: .trailing))
            } else {
                editor
            }
        }
        .animation(.easeOut(duration: 0.25), value: analysisVM == nil)
    }

    private var editor: some View {
        NavigationStack {
            ZStack {
                AthlyTheme.Color.backgroundDark.ignoresSafeArea()
                VStack(spacing: 0) {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 18) {
                            Text("A meta nova vale a partir da próxima semana gerada. As semanas que você já recebeu continuam como estão.")
                                .font(AthlyTheme.Typography.body(12))
                                .foregroundStyle(AthlyTheme.Color.textSecondary)

                            section("Distância") {
                                GoalDistanceGrid(selection: $form.objectiveDistance)
                            }
                            section("Tipo de meta") {
                                VStack(spacing: 8) {
                                    GoalTypeSelector(objectiveType: $form.objectiveType, targetTimeText: $form.targetTimeText)
                                    GoalEventDateCard(hasEventDate: $form.hasEventDate, eventDate: $form.eventDate)
                                        .padding(.top, 8)
                                }
                            }
                        }
                        .padding(AthlyTheme.Spacing.sm)
                    }
                    footer
                }
            }
            .navigationTitle("Alterar meta")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
            }
        }
    }

    private func section<Content: View>(_ title: LocalizedStringKey, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(AthlyTheme.Typography.semibold(13))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            content()
        }
    }

    private var footer: some View {
        VStack(spacing: 8) {
            if let message = form.validationMessage, !form.objectiveDistance.isEmpty {
                Text(message)
                    .font(AthlyTheme.Typography.body(11))
                    .foregroundStyle(AthlyTheme.Color.textTertiary)
            }
            Button {
                analysisVM = GoalAnalysisViewModel(mode: .change(form.draft), detailedLimit: 7)
            } label: {
                Text("Ver análise da meta").frame(maxWidth: .infinity)
            }
            .buttonStyle(AthlyGradientButtonStyle())
            .disabled(form.validationMessage != nil)
        }
        .padding(.horizontal, AthlyTheme.Spacing.sm)
        .padding(.vertical, 12)
        .background(AthlyTheme.Color.backgroundDark)
    }
}
