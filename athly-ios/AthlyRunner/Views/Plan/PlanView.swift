import SwiftUI

struct PlanView: View {
    @EnvironmentObject var planVM: TrainingPlanViewModel

    @State private var viewMode: ViewMode = .list
    @State private var calendarMonth: Date = Date()
    @State private var showCreatePlan = false
    @State private var workoutToComplete: WorkoutModel?
    @State private var selectedCalendarDate: Date? = nil

    enum ViewMode: String, CaseIterable {
        case list = "Lista"
        case calendar = "Calendário"
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AthlyTheme.Color.backgroundDark
                    .ignoresSafeArea()

                if planVM.isLoading {
                    ProgressView()
                        .tint(AthlyTheme.Color.primary)
                } else {
                    VStack(spacing: 0) {
                        // Segmented control
                        Picker("Modo", selection: $viewMode) {
                            ForEach(ViewMode.allCases, id: \.self) { mode in
                                Text(mode.rawValue).tag(mode)
                            }
                        }
                        .pickerStyle(.segmented)
                        .padding(.horizontal, AthlyTheme.Spacing.sm)
                        .padding(.top, 8)
                        .padding(.bottom, 12)

                        if viewMode == .list {
                            listContent
                        } else {
                            calendarContent
                        }
                    }
                }
            }
            .navigationTitle("Plano")
            .task { await planVM.loadData() }
            .sheet(isPresented: $showCreatePlan) {
                CreatePlanView()
                    .environmentObject(planVM)
            }
            .sheet(item: $workoutToComplete) { workout in
                WorkoutCompletionSheet(
                    workout: workout,
                    onComplete: { healthRun in
                        workoutToComplete = nil
                        Task {
                            if let run = healthRun {
                                await planVM.completeWorkoutWithHealthData(workout, healthRun: run)
                            } else {
                                await planVM.completeWorkout(workout)
                            }
                        }
                    },
                    onDismiss: { workoutToComplete = nil }
                )
            }
            .alert("Erro", isPresented: .constant(planVM.errorMessage != nil)) {
                Button("OK") { planVM.errorMessage = nil }
            } message: {
                Text(planVM.errorMessage ?? "")
            }
        }
    }

    // MARK: - List Mode

    private var listContent: some View {
        ScrollView {
            VStack(spacing: AthlyTheme.Spacing.sm) {
                if let plan = planVM.trainingPlanResponse {
                    // Plan header
                    planHeaderCard(plan)

                    // AI Weekly Goal cards (current week)
                    if let currentGoal = planVM.currentWeekGoal {
                        WeeklyGoalInsightCard(goal: currentGoal)
                            .padding(.horizontal, AthlyTheme.Spacing.sm)
                        PreviousWeekFeedbackCard(goal: currentGoal)
                            .padding(.horizontal, AthlyTheme.Spacing.sm)
                    }

                    if let analysis = planVM.lastAnalysis {
                        AnalysisSummaryCard(analysis: analysis)
                    }

                    // Generate buttons
                    generateButton
                    generateFromHealthButton

                    // Próximos 5 treinos (inclui treinos da próxima semana)
                    nextFiveWorkoutsSection

                    if planVM.weeks.isEmpty {
                        emptyPlanState
                    } else {
                        // Week selector
                        weekSelector

                        // Week stats
                        weekStatsCard

                        // Workouts list
                        workoutsList
                    }
                } else {
                    noPlanState
                }
            }
            .padding(AthlyTheme.Spacing.sm)
        }
        .scrollContentBackground(.hidden)
    }

    private func planHeaderCard(_ plan: TrainingPlanResponse) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(plan.objective)
                .font(AthlyTheme.Typography.semibold(17))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            HStack {
                Text("\(planVM.weeks.count) semanas")
                    .font(AthlyTheme.Typography.body(15))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                Spacer()
                ForEach(plan.sports.prefix(3), id: \.rawValue) { sport in
                    Image(systemName: sport.sfSymbol)
                        .foregroundStyle(AthlyTheme.Color.primary)
                }
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyInsightCard()
    }

    private var generateButton: some View {
        Button {
            Task { await planVM.generateNextWeek() }
        } label: {
            HStack {
                if planVM.isGenerating {
                    ProgressView()
                        .tint(.white)
                        .scaleEffect(0.8)
                } else {
                    Image(systemName: "sparkles")
                }
                Text(planVM.isGenerating ? "Gerando..." : "Gerar Próxima Semana")
            }
        }
        .buttonStyle(AthlyGradientButtonStyle())
        .disabled(planVM.isGenerating)
    }

    private var generateFromHealthButton: some View {
        Button {
            Task { await fetchHealthRunsAndGenerate() }
        } label: {
            HStack {
                Image(systemName: "heart.fill")
                Text("Planejar com Apple Health")
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(AthlyTheme.Color.primary.opacity(0.15))
            .foregroundStyle(AthlyTheme.Color.primary)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                    .stroke(AthlyTheme.Color.primary.opacity(0.4), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(planVM.isGenerating)
    }

    private func fetchHealthRunsAndGenerate() async {
        let service: any HealthKitRunningWorkoutsProviding = {
            #if targetEnvironment(simulator)
            return MockHealthKitService()
            #else
            return HealthKitService()
            #endif
        }()
        guard service.isHealthDataAvailable else {
            planVM.errorMessage = "O Apple Health não está disponível neste dispositivo."
            return
        }
        do {
            try await service.requestAuthorization()
            let runs = try await service.fetchLatestRunningWorkouts(limit: 20)
            guard !runs.isEmpty else {
                planVM.errorMessage = "Nenhuma corrida encontrada no Apple Health."
                return
            }
            await planVM.generateFromHealth(runs: runs)
        } catch {
            planVM.errorMessage = error.localizedDescription
        }
    }

    private var nextFiveWorkoutsSection: some View {
        let nextFive = planVM.nextFiveWorkouts
        let nextId = planVM.nextWorkout?.id
        return VStack(alignment: .leading, spacing: 12) {
            Text("Próximos 5 treinos")
                .font(AthlyTheme.Typography.semibold(17))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .padding(.horizontal, AthlyTheme.Spacing.sm)

            if nextFive.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "calendar.badge.clock")
                        .font(.system(size: 32))
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                    Text("Nenhum treino programado nos próximos dias")
                        .font(AthlyTheme.Typography.body(15))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(20)
                .athlyCard()
                .padding(.horizontal, AthlyTheme.Spacing.sm)
            } else {
                ForEach(nextFive) { workout in
                    NavigationLink {
                        WorkoutDetailView(workout: workout)
                    } label: {
                        WorkoutCardView(
                            workout: workout,
                            compact: true,
                            isNext: workout.id == nextId
                        )
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        if workout.status == .scheduled {
                            Button {
                                workoutToComplete = workout
                            } label: {
                                Label("Concluir treino", systemImage: "checkmark.circle")
                            }
                            Button {
                                Task { await planVM.skipWorkout(workout) }
                            } label: {
                                Label("Pular treino", systemImage: "forward.fill")
                            }
                        }
                    }
                }
                .padding(.horizontal, AthlyTheme.Spacing.sm)
            }
        }
    }

    private var weekSelector: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(planVM.weeks.indices, id: \.self) { index in
                    let week = planVM.weeks[index]
                    Button {
                        planVM.selectedWeekIndex = index
                    } label: {
                        Text("Sem \(week.number)")
                            .font(AthlyTheme.Typography.semibold(15))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(
                                planVM.selectedWeekIndex == index
                                    ? AthlyTheme.Gradient.brand
                                    : LinearGradient(colors: [AthlyTheme.Color.glassBackground], startPoint: .leading, endPoint: .trailing)
                            )
                            .foregroundStyle(.white)
                            .clipShape(Capsule())
                            .overlay(
                                Capsule()
                                    .stroke(
                                        planVM.selectedWeekIndex == index
                                            ? Color.clear
                                            : AthlyTheme.Color.glassBorder,
                                        lineWidth: 1
                                    )
                            )
                    }
                }
            }
            .padding(.horizontal, AthlyTheme.Spacing.sm)
        }
    }

    private var weekStatsCard: some View {
        HStack(spacing: 0) {
            statCell(value: "\(planVM.completedThisWeek)/\(planVM.totalThisWeek)", label: "Concluídos", sfSymbol: "checkmark.circle.fill")
            Divider().background(AthlyTheme.Color.borderDark)
            statCell(value: "\(Int(planVM.weeklyProgress * 100))%", label: "Progresso", sfSymbol: "chart.line.uptrend.xyaxis")

            if let goal = planVM.weeks[safe: planVM.selectedWeekIndex]?.weeklyGoal,
               let metrics = goal.metrics,
               let title = metrics.title {
                Divider().background(AthlyTheme.Color.borderDark)
                statCell(value: "", label: title, sfSymbol: "target")
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .athlyCard()
        .padding(.horizontal, AthlyTheme.Spacing.sm)
    }

    private func statCell(value: String, label: String, sfSymbol: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: sfSymbol)
                .font(.title2)
                .foregroundStyle(AthlyTheme.Color.primary)
            if !value.isEmpty {
                Text(value)
                    .font(AthlyTheme.Typography.semibold(17))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
            }
            Text(label)
                .font(AthlyTheme.Typography.body(12))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }

    private var workoutsList: some View {
        let workouts = planVM.currentWeekWorkouts.filter { $0.sportType != .other }
        let nextId = planVM.nextWorkout?.id

        return VStack(spacing: 12) {
            ForEach(workouts) { workout in
                WorkoutCardView(
                    workout: workout,
                    compact: false,
                    isNext: workout.id == nextId
                )
                .contextMenu {
                    if workout.status == .scheduled {
                        Button {
                            workoutToComplete = workout
                        } label: {
                            Label("Concluir treino", systemImage: "checkmark.circle")
                        }
                        Button {
                            Task { await planVM.skipWorkout(workout) }
                        } label: {
                            Label("Pular treino", systemImage: "forward.fill")
                        }
                    }
                }
            }
        }
        .padding(.horizontal, AthlyTheme.Spacing.sm)
    }

    private var emptyPlanState: some View {
        VStack(spacing: 16) {
            Image(systemName: "list.bullet.clipboard")
                .font(.system(size: 48))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
            Text("Nenhuma semana planejada")
                .font(AthlyTheme.Typography.semibold(17))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Text("Clique em \"Gerar Próxima Semana\" para criar seu primeiro plano de treinos!")
                .font(AthlyTheme.Typography.body(15))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(40)
        .frame(maxWidth: .infinity)
        .athlyCard()
        .padding(.horizontal, AthlyTheme.Spacing.sm)
    }

    private var noPlanState: some View {
        VStack(spacing: 20) {
            Image(systemName: "figure.run.circle")
                .font(.system(size: 56))
                .foregroundStyle(
                    LinearGradient(
                        colors: [AthlyTheme.Color.primary, AthlyTheme.Color.secondary],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            Text("Crie seu plano de corrida")
                .font(AthlyTheme.Typography.heading(20))
                .foregroundStyle(AthlyTheme.Color.textPrimary)

            Text("Diga qual é seu objetivo e a IA vai criar um plano de treino personalizado para você.")
                .font(AthlyTheme.Typography.body(15))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .multilineTextAlignment(.center)

            Button {
                showCreatePlan = true
            } label: {
                HStack {
                    Image(systemName: "sparkles")
                    Text("Definir meu objetivo")
                }
            }
            .buttonStyle(AthlyGradientButtonStyle())
            .padding(.top, 4)

            Text("ou")
                .font(AthlyTheme.Typography.body(13))
                .foregroundStyle(AthlyTheme.Color.textTertiary)

            generateFromHealthButton
        }
        .padding(32)
        .frame(maxWidth: .infinity)
        .athlyCard()
        .padding(.horizontal, AthlyTheme.Spacing.sm)
    }

    // MARK: - Calendar Mode

    private var calendarContent: some View {
        VStack(spacing: 0) {
            // Month navigation
            HStack {
                Button {
                    calendarMonth = Calendar.current.date(byAdding: .month, value: -1, to: calendarMonth) ?? calendarMonth
                } label: {
                    Image(systemName: "chevron.left")
                        .foregroundStyle(AthlyTheme.Color.primary)
                }

                Spacer()

                Text(monthYearString(calendarMonth))
                    .font(AthlyTheme.Typography.semibold(17))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)

                Spacer()

                Button {
                    calendarMonth = Date()
                } label: {
                    Text("Hoje")
                        .font(AthlyTheme.Typography.body(15))
                        .foregroundStyle(AthlyTheme.Color.primary)
                }

                Button {
                    calendarMonth = Calendar.current.date(byAdding: .month, value: 1, to: calendarMonth) ?? calendarMonth
                } label: {
                    Image(systemName: "chevron.right")
                        .foregroundStyle(AthlyTheme.Color.primary)
                }
            }
            .padding(.horizontal, AthlyTheme.Spacing.sm)
            .padding(.vertical, 8)

            ScrollView {
                VStack(spacing: 0) {
                    CalendarGridView(
                        month: calendarMonth,
                        workouts: planVM.allWorkouts,
                        weeklyGoals: planVM.weeklyGoals,
                        selectedDate: $selectedCalendarDate
                    )
                    .padding(.horizontal, AthlyTheme.Spacing.sm)
                    .padding(.bottom, AthlyTheme.Spacing.sm)

                    if let date = selectedCalendarDate {
                        selectedDayWorkouts(for: date)
                            .padding(.horizontal, AthlyTheme.Spacing.sm)
                            .padding(.bottom, AthlyTheme.Spacing.sm)
                    }
                }
            }
            .scrollContentBackground(.hidden)
        }
    }

    private func selectedDayWorkouts(for date: Date) -> some View {
        let cal = Calendar.current
        let dayWorkouts = planVM.allWorkouts
            .filter { cal.isDate($0.parsedDate, inSameDayAs: date) && $0.sportType != .other }
            .sorted { $0.parsedDate < $1.parsedDate }
        let nextId = planVM.nextWorkout?.id

        return VStack(alignment: .leading, spacing: 10) {
            let formatter: DateFormatter = {
                let f = DateFormatter()
                f.dateFormat = "EEEE, d 'de' MMMM"
                f.locale = Locale(identifier: "pt-BR")
                return f
            }()
            Text(formatter.string(from: date).capitalized)
                .font(AthlyTheme.Typography.semibold(15))
                .foregroundStyle(AthlyTheme.Color.textPrimary)

            if dayWorkouts.isEmpty {
                Text("Dia de descanso")
                    .font(AthlyTheme.Typography.body(14))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                    .padding(.vertical, 8)
            } else {
                ForEach(dayWorkouts) { workout in
                    NavigationLink {
                        WorkoutDetailView(workout: workout)
                    } label: {
                        WorkoutCardView(
                            workout: workout,
                            compact: true,
                            isNext: workout.id == nextId
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyCard()
    }

    private func monthYearString(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        formatter.locale = Locale(identifier: "pt-BR")
        return formatter.string(from: date).capitalized
    }
}

// MARK: - Safe subscript

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
