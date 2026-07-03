import SwiftUI

struct HealthKitRunsView: View {
    private let title: String
    private let showsPlanTab: Bool

    @EnvironmentObject private var planVM: TrainingPlanViewModel

    @StateObject private var viewModel: HealthKitRunsViewModel = {
        #if targetEnvironment(simulator)
        return HealthKitRunsViewModel(healthKitService: MockHealthKitService())
        #else
        return HealthKitRunsViewModel(healthKitService: HealthKitService())
        #endif
    }()

    @State private var selectedTab: HistoryTab

    init(title: String = "Corridas do Apple Health", showsPlanTab: Bool = true) {
        self.title = title
        self.showsPlanTab = showsPlanTab
        _selectedTab = State(initialValue: showsPlanTab ? .plan : .healthKit)
    }

    private enum HistoryTab: String, CaseIterable {
        case plan = "Plano"
        case healthKit = "HealthKit"
    }

    private struct PrescribedRun: Identifiable {
        let workout: WorkoutModel
        let run: HealthKitRunItem

        var id: String { workout.id }
    }

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark
                .ignoresSafeArea()

            RadialGradient(
                colors: [
                    AthlyTheme.Color.primary.opacity(0.14),
                    Color.clear
                ],
                center: .init(x: 0.05, y: 0.0),
                startRadius: 0,
                endRadius: 200
            )
            .ignoresSafeArea()

            RadialGradient(
                colors: [
                    AthlyTheme.Color.secondary.opacity(0.08),
                    Color.clear
                ],
                center: .init(x: 1.0, y: 1.0),
                startRadius: 0,
                endRadius: 160
            )
            .ignoresSafeArea()

            if viewModel.isLoading {
                ProgressView()
                    .tint(AthlyTheme.Color.primary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if viewModel.isHealthUnavailable {
                healthUnavailableContent
            } else if let message = viewModel.errorMessage {
                errorContent(message: message)
            } else {
                content
            }

            #if DEBUG
            if let message = viewModel.zeppDiagnosticMessage {
                debugDiagnosticBanner(message)
                    .padding(.horizontal, AthlyTheme.Spacing.sm)
                    .padding(.bottom, AthlyTheme.Spacing.md)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                    .transition(.opacity)
                    .allowsHitTesting(false)
            }
            #endif
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            #if DEBUG
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    Task { await viewModel.runZeppDiagnostic() }
                } label: {
                    if viewModel.isRunningZeppDiagnostic {
                        ProgressView()
                            .tint(AthlyTheme.Color.primary)
                    } else {
                        Image(systemName: "waveform.path.ecg")
                    }
                }
                .disabled(viewModel.isRunningZeppDiagnostic)
                .accessibilityLabel("Rodar diagnostico Zepp")
            }
            #endif
        }
        .task { await loadData() }
    }

    private var content: some View {
        VStack(spacing: 0) {
            if showsPlanTab {
                Picker("Historico", selection: $selectedTab) {
                    ForEach(HistoryTab.allCases, id: \.self) { tab in
                        Text(tab.rawValue).tag(tab)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, AthlyTheme.Spacing.sm)
                .padding(.top, 8)
                .padding(.bottom, 12)
            }

            if selectedTab == .plan && showsPlanTab {
                prescribedRunsContent
            } else {
                healthKitRunsContent
            }
        }
    }

    private var healthKitRunsContent: some View {
        Group {
            if viewModel.isEmptyAfterLoad {
                emptyContent
            } else if !viewModel.runs.isEmpty {
                healthKitRunsList
            } else {
                ProgressView()
                    .tint(AthlyTheme.Color.primary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }

    private var prescribedRunsContent: some View {
        Group {
            if planVM.isLoading && planVM.allWorkouts.isEmpty {
                ProgressView()
                    .tint(AthlyTheme.Color.primary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if prescribedRuns.isEmpty {
                emptyPrescribedContent
            } else {
                prescribedRunsList
            }
        }
    }

    private var healthKitRunsList: some View {
        ScrollView {
            LazyVStack(spacing: AthlyTheme.Spacing.sm) {
                ForEach(viewModel.runs) { run in
                    NavigationLink {
                        HealthKitRunDetailView(item: run)
                    } label: {
                        HealthKitRunCard(item: run)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(AthlyTheme.Spacing.sm)
        }
        .athlyTabBarContentClearance()
        .scrollContentBackground(.hidden)
        .refreshable { await refreshData() }
    }

    private var prescribedRunsList: some View {
        ScrollView {
            LazyVStack(spacing: AthlyTheme.Spacing.sm) {
                ForEach(prescribedRuns) { item in
                    NavigationLink {
                        HealthKitRunDetailView(item: item.run, prescribedWorkout: item.workout)
                    } label: {
                        PrescribedRunCard(workout: item.workout, item: item.run)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(AthlyTheme.Spacing.sm)
        }
        .athlyTabBarContentClearance()
        .scrollContentBackground(.hidden)
        .refreshable { await refreshData() }
    }

    private var prescribedRuns: [PrescribedRun] {
        var runsById: [String: HealthKitRunItem] = [:]
        for run in viewModel.allKnownRuns {
            runsById[run.id] = run
        }

        return planVM.allWorkouts.compactMap { workout in
            guard workout.status == .done || workout.status == .partial,
                  let uuid = healthKitUUID(for: workout),
                  let run = runsById[uuid] else {
                return nil
            }
            return PrescribedRun(workout: workout, run: run)
        }
        .sorted { $0.run.startDate > $1.run.startDate }
    }

    private var linkedHealthKitUUIDs: [String] {
        planVM.allWorkouts.compactMap { healthKitUUID(for: $0) }
    }

    private func healthKitUUID(for workout: WorkoutModel) -> String? {
        workout.appleHealthWorkoutUUID
            ?? RunWorkoutLinkStore.shared.healthKitUUID(forAthlyWorkoutId: workout.id)
    }

    private func loadData() async {
        if showsPlanTab {
            await planVM.loadData()
        }
        await viewModel.loadWorkouts()
        if showsPlanTab {
            await viewModel.ensureRunItems(workoutUUIDs: linkedHealthKitUUIDs)
        }
    }

    private func refreshData() async {
        await loadData()
    }

    private var emptyContent: some View {
        VStack(spacing: 12) {
            Image(systemName: "figure.run")
                .font(.system(size: 48))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
            Text("Nenhuma corrida encontrada")
                .font(AthlyTheme.Typography.semibold(17))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Text("Nao ha corridas no Apple Health neste dispositivo. No simulador pode nao haver dados.")
                .font(AthlyTheme.Typography.body(15))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyPrescribedContent: some View {
        VStack(spacing: 12) {
            Image(systemName: "list.clipboard")
                .font(.system(size: 48))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
            Text("Nenhum treino prescrito com corrida vinculada")
                .font(AthlyTheme.Typography.semibold(17))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Text("Quando um treino do plano for concluido com uma corrida do Apple Health, ele aparece aqui com o prescrito e o executado.")
                .font(AthlyTheme.Typography.body(15))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var healthUnavailableContent: some View {
        VStack(spacing: AthlyTheme.Spacing.md) {
            Image(systemName: "heart.slash")
                .font(.system(size: 48))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
            Text("Apple Health indisponivel")
                .font(AthlyTheme.Typography.heading(18))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Text("O Health nao esta disponivel neste dispositivo (por exemplo, no simulador). Use um iPhone fisico para testar.")
                .font(AthlyTheme.Typography.body(14))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            Button("Tentar novamente") {
                viewModel.retry()
            }
            .buttonStyle(AthlyGradientButtonStyle())
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorContent(message: String) -> some View {
        VStack(spacing: AthlyTheme.Spacing.md) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundStyle(AthlyTheme.Color.warning)
            Text("Erro ao carregar")
                .font(AthlyTheme.Typography.heading(18))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Text(message)
                .font(AthlyTheme.Typography.body(14))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            Button("Tentar novamente") {
                viewModel.retry()
            }
            .buttonStyle(AthlyGradientButtonStyle())
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    #if DEBUG
    private func debugDiagnosticBanner(_ message: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "waveform.path.ecg")
                .foregroundStyle(AthlyTheme.Color.primary)
            Text(message)
                .font(AthlyTheme.Typography.body(12))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(AthlyTheme.Color.surfaceDark.opacity(0.96))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AthlyTheme.Color.glassBorder, lineWidth: 1)
        )
    }
    #endif
}

// MARK: - Card (estilo Fitness + Athly)

struct HealthKitRunCard: View {
    let item: HealthKitRunItem

    private var dateTimeText: String {
        if Calendar.current.isDateInToday(item.startDate) {
            item.startDate.formatted(date: .omitted, time: .shortened)
        } else {
            item.startDate.formatted(date: .abbreviated, time: .shortened)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(dateTimeText)
                        .font(AthlyTheme.Typography.body(13))
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                    HStack(spacing: 6) {
                        Image(systemName: "figure.run")
                            .font(.caption)
                            .foregroundStyle(AthlyTheme.Color.primary)
                        Text("Corrida")
                            .font(AthlyTheme.Typography.semibold(17))
                            .foregroundStyle(AthlyTheme.Color.textPrimary)
                    }
                }
                Spacer()
            }

            HStack(alignment: .top, spacing: 0) {
                mainStat(value: item.formattedDuration, label: "Duracao")
                Rectangle()
                    .fill(AthlyTheme.Color.glassBorder)
                    .frame(width: 1, height: 44)
                mainStat(value: "\(item.formattedDistance) km", label: "Distancia")
                Rectangle()
                    .fill(AthlyTheme.Color.glassBorder)
                    .frame(width: 1, height: 44)
                mainStat(value: "\(item.formattedPace)/km", label: "Pace")
            }
            .padding(.vertical, 4)

            HStack(spacing: 16) {
                Label(
                    String(format: "%.0f kcal", item.activeEnergyBurned),
                    systemImage: "flame"
                )
                .font(AthlyTheme.Typography.body(12))
                .foregroundStyle(AthlyTheme.Color.textSecondary)

                if let elevation = item.elevationGainMeters, elevation > 0 {
                    Label(
                        String(format: "%.0f m", elevation),
                        systemImage: "mountain.2"
                    )
                    .font(AthlyTheme.Typography.body(12))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                }
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyCard()
    }

    private func mainStat(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(AthlyTheme.Typography.semibold(16))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Text(label)
                .font(AthlyTheme.Typography.body(11))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }
}

struct PrescribedRunCard: View {
    let workout: WorkoutModel
    let item: HealthKitRunItem

    private var dateTimeText: String {
        if Calendar.current.isDateInToday(item.startDate) {
            item.startDate.formatted(date: .omitted, time: .shortened)
        } else {
            item.startDate.formatted(date: .abbreviated, time: .shortened)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: workout.sportType.sfSymbol)
                    .font(.system(size: 16))
                    .foregroundStyle(AthlyTheme.Color.primary)
                    .frame(width: 22)

                VStack(alignment: .leading, spacing: 4) {
                    Text(dateTimeText)
                        .font(AthlyTheme.Typography.body(12))
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                    Text(workout.title)
                        .font(AthlyTheme.Typography.semibold(17))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                        .lineLimit(2)
                    if let description = workout.description, !description.isEmpty {
                        Text(description)
                            .font(AthlyTheme.Typography.body(12))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                            .lineLimit(2)
                    }
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AthlyTheme.Color.textTertiary)
            }

            HStack(alignment: .top, spacing: 0) {
                mainStat(value: item.formattedDuration, label: "Tempo")
                Rectangle()
                    .fill(AthlyTheme.Color.glassBorder)
                    .frame(width: 1, height: 44)
                mainStat(value: "\(item.formattedDistance) km", label: "Distancia")
                Rectangle()
                    .fill(AthlyTheme.Color.glassBorder)
                    .frame(width: 1, height: 44)
                mainStat(value: "\(item.formattedPace)/km", label: "Pace")
            }
            .padding(.vertical, 4)

            HStack(spacing: 14) {
                Label("Prescrito", systemImage: "list.clipboard")
                Label(String(format: "%.0f kcal", item.activeEnergyBurned), systemImage: "flame")
            }
            .font(AthlyTheme.Typography.body(12))
            .foregroundStyle(AthlyTheme.Color.textSecondary)
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyCard()
    }

    private func mainStat(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(AthlyTheme.Typography.semibold(16))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Text(label)
                .font(AthlyTheme.Typography.body(11))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }
}

struct HealthKitRunsView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            HealthKitRunsView()
        }
    }
}
