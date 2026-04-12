import SwiftUI

struct WorkoutCompletionSheet: View {
    let workout: WorkoutModel
    let onComplete: (HealthKitRunItem?) -> Void
    let onDismiss: () -> Void

    @State private var todayRuns: [HealthKitRunItem] = []
    @State private var isLoading = true
    @State private var loadError: String?

    private let calendar = Calendar.current

    var body: some View {
        NavigationStack {
            ZStack {
                AthlyTheme.Color.backgroundDark
                    .ignoresSafeArea()

                if isLoading {
                    VStack(spacing: 16) {
                        ProgressView()
                            .tint(AthlyTheme.Color.primary)
                        Text("Buscando corridas no Apple Health…")
                            .font(AthlyTheme.Typography.body(15))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                    }
                } else {
                    content
                }
            }
            .navigationTitle("Concluir Treino")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { onDismiss() }
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }
            }
        }
        .task { await loadTodayRuns() }
    }

    // MARK: - Content

    private var content: some View {
        ScrollView {
            VStack(spacing: AthlyTheme.Spacing.sm) {
                // Workout summary header
                workoutSummaryCard

                if let error = loadError {
                    errorView(error)
                } else if todayRuns.isEmpty {
                    noRunsView
                } else {
                    // HealthKit runs list
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Image(systemName: "heart.fill")
                                .foregroundStyle(AthlyTheme.Color.primary)
                            Text("Corridas de hoje no Apple Health")
                                .font(AthlyTheme.Typography.semibold(15))
                                .foregroundStyle(AthlyTheme.Color.textPrimary)
                        }
                        .padding(.horizontal, AthlyTheme.Spacing.sm)

                        Text("Selecione qual corrida corresponde ao treino prescrito:")
                            .font(AthlyTheme.Typography.body(13))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                            .padding(.horizontal, AthlyTheme.Spacing.sm)

                        ForEach(todayRuns) { run in
                            healthRunCard(run)
                        }
                    }
                }

                // Fallback: just mark as done
                Divider()
                    .background(AthlyTheme.Color.borderDark)
                    .padding(.horizontal, AthlyTheme.Spacing.sm)

                Button {
                    onComplete(nil)
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
            onComplete(run)
        } label: {
            VStack(spacing: 0) {
                HStack(spacing: 12) {
                    // Time icon
                    VStack(spacing: 2) {
                        Image(systemName: "figure.run")
                            .font(.system(size: 18))
                            .foregroundStyle(AthlyTheme.Color.primary)
                        Text(timeString(run.startDate))
                            .font(AthlyTheme.Typography.body(11))
                            .foregroundStyle(AthlyTheme.Color.textTertiary)
                    }
                    .frame(width: 44)

                    // Metrics
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
            Text("Nenhuma corrida encontrada hoje")
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

    // MARK: - Load

    private func loadTodayRuns() async {
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
            try await service.requestAuthorization()
            let allRuns = try await service.fetchLatestRunningWorkouts(limit: 30)
            todayRuns = allRuns.filter { calendar.isDateInToday($0.startDate) }
        } catch {
            loadError = error.localizedDescription
        }
    }

    // MARK: - Formatters

    private func timeString(_ date: Date) -> String {
        let df = DateFormatter()
        df.dateFormat = "HH:mm"
        return df.string(from: date)
    }
}
