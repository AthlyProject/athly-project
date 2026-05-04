import SwiftUI

struct WorkoutCompletionSheet: View {
    let workout: WorkoutModel
    var initialStep: Step = .healthKit
    let onComplete: (HealthKitRunItem?) -> Void
    let onDismiss: () -> Void

    // MARK: - Step machine

    enum Step {
        case healthKit
        case feedback
    }

    @State private var step: Step
    @State private var selectedRun: HealthKitRunItem? = nil

    init(workout: WorkoutModel, initialStep: Step = .healthKit, onComplete: @escaping (HealthKitRunItem?) -> Void, onDismiss: @escaping () -> Void) {
        self.workout = workout
        self.initialStep = initialStep
        self.onComplete = onComplete
        self.onDismiss = onDismiss
        _step = State(initialValue: initialStep)
    }

    // HealthKit loading
    @State private var todayRuns: [HealthKitRunItem] = []
    @State private var isLoading = true
    @State private var loadError: String?

    // Feedback form
    @State private var completed: Bool = true
    @State private var effort: Int = 5
    @State private var fatigue: Int = 5
    @State private var isSubmitting = false

    private let calendar = Calendar.current

    var body: some View {
        NavigationStack {
            ZStack {
                AthlyTheme.Color.backgroundDark
                    .ignoresSafeArea()

                if step == .healthKit {
                    if isLoading {
                        loadingView
                    } else {
                        healthKitContent
                    }
                } else {
                    feedbackContent
                }
            }
            .navigationTitle(step == .healthKit ? "Concluir Treino" : "Como foi o treino?")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    if step == .feedback {
                        Button("Voltar") { step = .healthKit }
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                    } else {
                        Button("Cancelar") { onDismiss() }
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                    }
                }
            }
        }
        .task { await loadCandidateRuns() }
    }

    // MARK: - Loading

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .tint(AthlyTheme.Color.primary)
            Text("Buscando corridas no Apple Health…")
                .font(AthlyTheme.Typography.body(15))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
        }
    }

    // MARK: - Step 1: HealthKit selection

    private var healthKitContent: some View {
        ScrollView {
            VStack(spacing: AthlyTheme.Spacing.sm) {
                workoutSummaryCard

                if let error = loadError {
                    errorView(error)
                } else if !todayRuns.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Image(systemName: "heart.fill")
                                .foregroundStyle(AthlyTheme.Color.primary)
                            Text("Corridas próximas a \(formattedWorkoutDate)")
                                .font(AthlyTheme.Typography.semibold(15))
                                .foregroundStyle(AthlyTheme.Color.textPrimary)
                        }
                        .padding(.horizontal, AthlyTheme.Spacing.sm)

                        Text("Selecione a corrida que corresponde a este treino (até 2 dias após o planejado):")
                            .font(AthlyTheme.Typography.body(13))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                            .padding(.horizontal, AthlyTheme.Spacing.sm)

                        ForEach(todayRuns) { run in
                            healthRunCard(run)
                        }
                    }
                } else {
                    noRunsView
                }

                Divider()
                    .background(AthlyTheme.Color.borderDark)
                    .padding(.horizontal, AthlyTheme.Spacing.sm)

                Button {
                    selectedRun = nil
                    step = .feedback
                } label: {
                    HStack {
                        Image(systemName: "checkmark.circle")
                        Text("Apenas marcar como concluído")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                    .background(AthlyTheme.Color.surfaceDark)
                    .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                            .stroke(AthlyTheme.Color.borderDark, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .padding(.horizontal, AthlyTheme.Spacing.sm)
            }
            .padding(.vertical, AthlyTheme.Spacing.sm)
        }
        .scrollContentBackground(.hidden)
    }

    // MARK: - Step 2: Feedback

    private var feedbackContent: some View {
        ScrollView {
            VStack(spacing: AthlyTheme.Spacing.sm) {
                // Header
                VStack(spacing: 8) {
                    Text(completed ? "🎉" : "💪")
                        .font(.system(size: 48))
                    Text(completed ? "Parabéns!" : "Bom trabalho!")
                        .font(AthlyTheme.Typography.heading(22))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                    Text("Conta como foi o seu treino")
                        .font(AthlyTheme.Typography.body(14))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)

                // Status
                completionStatusCard

                // Effort
                effortCard

                // Fatigue
                fatigueCard

                // Submit
                VStack(spacing: 12) {
                    Button {
                        Task { await submitFeedback() }
                    } label: {
                        HStack {
                            if isSubmitting {
                                ProgressView().tint(.white).scaleEffect(0.85)
                            } else {
                                Image(systemName: "chart.bar.fill")
                            }
                            Text(isSubmitting ? "Enviando…" : "Enviar feedback")
                        }
                    }
                    .buttonStyle(AthlyGradientButtonStyle())
                    .disabled(isSubmitting)

                    Button {
                        onComplete(selectedRun)
                    } label: {
                        Text("Pular por agora")
                            .font(AthlyTheme.Typography.body(15))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, AthlyTheme.Spacing.sm)
                .padding(.top, 4)
            }
            .padding(AthlyTheme.Spacing.sm)
        }
        .scrollContentBackground(.hidden)
    }

    // MARK: - Completion Status Card

    private var completionStatusCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Conseguiu completar?")
                .font(AthlyTheme.Typography.semibold(15))
                .foregroundStyle(AthlyTheme.Color.textPrimary)

            HStack(spacing: 12) {
                completionButton(label: "Sim", emoji: "✓", selected: completed) {
                    completed = true
                }
                completionButton(label: "Não", emoji: "✗", selected: !completed) {
                    completed = false
                }
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyCard()
        .padding(.horizontal, AthlyTheme.Spacing.sm)
    }

    private func completionButton(label: String, emoji: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Text(emoji)
                    .font(.system(size: 28))
                Text(label)
                    .font(AthlyTheme.Typography.semibold(15))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                selected
                    ? AthlyTheme.Gradient.brand
                    : LinearGradient(colors: [AthlyTheme.Color.surfaceDark], startPoint: .leading, endPoint: .trailing)
            )
            .foregroundStyle(selected ? Color.white : AthlyTheme.Color.textSecondary)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous)
                    .stroke(selected ? Color.clear : AthlyTheme.Color.borderDark, lineWidth: 1)
            )
            .scaleEffect(selected ? 1.03 : 1.0)
            .animation(.spring(response: 0.3), value: selected)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Effort Card

    private var effortCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Nível de Esforço")
                .font(AthlyTheme.Typography.semibold(15))
                .foregroundStyle(AthlyTheme.Color.textPrimary)

            VStack(spacing: 8) {
                HStack {
                    Text(effortEmoji)
                        .font(.system(size: 36))
                    Spacer()
                    Text("\(effort)/10")
                        .font(.custom("SpaceGrotesk-Bold", size: 28))
                        .foregroundStyle(AthlyTheme.Color.primary)
                }

                Slider(value: Binding(
                    get: { Double(effort) },
                    set: { effort = Int($0) }
                ), in: 1...10, step: 1)
                .tint(AthlyTheme.Color.primary)

                HStack {
                    Text("Fácil")
                    Spacer()
                    Text("Moderado")
                    Spacer()
                    Text("Intenso")
                }
                .font(AthlyTheme.Typography.body(11))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyCard()
        .padding(.horizontal, AthlyTheme.Spacing.sm)
    }

    // MARK: - Fatigue Card

    private var fatigueCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Nível de Fadiga")
                .font(AthlyTheme.Typography.semibold(15))
                .foregroundStyle(AthlyTheme.Color.textPrimary)

            VStack(spacing: 8) {
                HStack {
                    Text(fatigueEmoji)
                        .font(.system(size: 36))
                    Spacer()
                    Text("\(fatigue)/10")
                        .font(.custom("SpaceGrotesk-Bold", size: 28))
                        .foregroundStyle(AthlyTheme.Color.secondary)
                }

                Slider(value: Binding(
                    get: { Double(fatigue) },
                    set: { fatigue = Int($0) }
                ), in: 1...10, step: 1)
                .tint(AthlyTheme.Color.secondary)

                HStack {
                    Text("Energizado")
                    Spacer()
                    Text("Normal")
                    Spacer()
                    Text("Exausto")
                }
                .font(AthlyTheme.Typography.body(11))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyCard()
        .padding(.horizontal, AthlyTheme.Spacing.sm)
    }

    // MARK: - Submit

    private func submitFeedback() async {
        isSubmitting = true
        defer { isSubmitting = false }
        let feedback = WorkoutFeedbackRequest(completed: completed, effort: effort, fatigue: fatigue)
        try? await APIClient.shared.submitWorkoutFeedback(workoutId: workout.id, feedback: feedback)
        onComplete(selectedRun)
    }

    // MARK: - Workout Summary Card

    private var workoutSummaryCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: workout.sportType.sfSymbol)
                    .foregroundStyle(AthlyTheme.Color.primary)
                Text(workout.title)
                    .font(AthlyTheme.Typography.semibold(16))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                Spacer()
            }
            if let desc = workout.description, !desc.isEmpty {
                Text(desc)
                    .font(AthlyTheme.Typography.body(13))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                    .lineLimit(2)
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyCard()
        .padding(.horizontal, AthlyTheme.Spacing.sm)
    }

    // MARK: - HealthKit Run Card

    private func healthRunCard(_ run: HealthKitRunItem) -> some View {
        Button {
            selectedRun = run
            step = .feedback
        } label: {
            VStack(spacing: 0) {
                HStack(spacing: 12) {
                    VStack(spacing: 2) {
                        Image(systemName: "figure.run")
                            .font(.system(size: 18))
                            .foregroundStyle(AthlyTheme.Color.primary)
                        Text(timeString(run.startDate))
                            .font(AthlyTheme.Typography.body(11))
                            .foregroundStyle(AthlyTheme.Color.textTertiary)
                        if let label = relativeDayLabel(for: run.startDate) {
                            Text(label)
                                .font(AthlyTheme.Typography.body(10))
                                .foregroundStyle(AthlyTheme.Color.primary)
                        }
                    }
                    .frame(width: 52)

                    HStack(spacing: 0) {
                        metricCell(value: run.formattedDistance, label: "km")
                        metricDivider
                        metricCell(value: run.formattedDuration, label: "tempo")
                        metricDivider
                        metricCell(value: "\(run.formattedPace)/km", label: "pace")
                    }
                    .frame(maxWidth: .infinity)

                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(AthlyTheme.Color.primary.opacity(0.6))
                }
                .padding(14)
            }
            .background(
                ZStack {
                    AthlyTheme.Color.surfaceCard
                    LinearGradient(
                        colors: [AthlyTheme.Color.primary.opacity(0.06), Color.clear],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous)
                    .stroke(AthlyTheme.Color.primary.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, AthlyTheme.Spacing.sm)
    }

    private func metricCell(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.custom("SpaceGrotesk-Bold", size: 16).monospacedDigit())
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Text(label)
                .font(AthlyTheme.Typography.body(11))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }

    private var metricDivider: some View {
        Rectangle()
            .fill(AthlyTheme.Color.borderDark)
            .frame(width: 1, height: 32)
    }

    // MARK: - Empty / Error states

    private var noRunsView: some View {
        VStack(spacing: 16) {
            Image(systemName: "heart.slash")
                .font(.system(size: 40))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
            Text("Nenhuma corrida encontrada entre \(formattedWorkoutDate) e os 2 dias seguintes")
                .font(AthlyTheme.Typography.semibold(16))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Text("Se você correu, verifique se o Apple Health está ativado nas configurações do app.")
                .font(AthlyTheme.Typography.body(14))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(32)
        .frame(maxWidth: .infinity)
        .athlyCard()
        .padding(.horizontal, AthlyTheme.Spacing.sm)
    }

    private func errorView(_ error: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 32))
                .foregroundStyle(AthlyTheme.Color.warning)
            Text("Erro ao acessar o Apple Health")
                .font(AthlyTheme.Typography.semibold(15))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Text(error)
                .font(AthlyTheme.Typography.body(13))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .athlyCard()
        .padding(.horizontal, AthlyTheme.Spacing.sm)
    }

    // MARK: - Load HealthKit

    /// Janela: dia do treino + 2 dias depois (D, D+1, D+2). Esconde corridas já linkadas a outros treinos.
    private func loadCandidateRuns() async {
        isLoading = true
        defer { isLoading = false }

        let service: any HealthKitRunningWorkoutsProviding = {
            #if targetEnvironment(simulator)
            return MockHealthKitService()
            #else
            return HealthKitService()
            #endif
        }()

        guard service.isHealthDataAvailable else {
            loadError = "Apple Health não disponível neste dispositivo."
            return
        }

        do {
            try await service.requestReadAuthorization()
            let allRuns = try await service.fetchLatestRunningWorkouts(limit: 30)

            let windowStart = calendar.startOfDay(for: workout.parsedDate)
            guard let windowEnd = calendar.date(byAdding: .day, value: 3, to: windowStart) else {
                todayRuns = []
                return
            }

            let inWindow = allRuns.filter { $0.startDate >= windowStart && $0.startDate < windowEnd }
            let orphanIds = Set(RunWorkoutLinkStore.shared.allOrphanCandidates(healthKitUUIDs: inWindow.map { $0.id }))
            todayRuns = inWindow
                .filter { orphanIds.contains($0.id) }
                .sorted { $0.startDate < $1.startDate }
        } catch {
            loadError = error.localizedDescription
        }
    }

    // MARK: - Helpers

    private var formattedWorkoutDate: String {
        let df = DateFormatter()
        df.dateStyle = .short
        df.timeStyle = .none
        df.locale = Locale(identifier: "pt_BR")
        return df.string(from: workout.parsedDate)
    }

    private var effortEmoji: String {
        switch effort {
        case ...3: return "😌"
        case 4...6: return "💪"
        case 7...8: return "🔥"
        default: return "😤"
        }
    }

    private var fatigueEmoji: String {
        switch fatigue {
        case ...3: return "⚡"
        case 4...6: return "😅"
        case 7...8: return "😰"
        default: return "😵"
        }
    }

    private func timeString(_ date: Date) -> String {
        let df = DateFormatter()
        df.dateFormat = "HH:mm"
        return df.string(from: date)
    }

    /// Mostra "+1 dia" / "+2 dias" quando a corrida não é do mesmo dia do treino prescrito.
    /// Retorna nil quando é o próprio dia (caso comum, evita poluir o card).
    private func relativeDayLabel(for runStart: Date) -> String? {
        let workoutDay = calendar.startOfDay(for: workout.parsedDate)
        let runDay = calendar.startOfDay(for: runStart)
        let days = calendar.dateComponents([.day], from: workoutDay, to: runDay).day ?? 0
        switch days {
        case 1: return "+1 dia"
        case 2: return "+2 dias"
        default: return nil
        }
    }
}
