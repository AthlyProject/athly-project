import SwiftUI

struct PlanView: View {
    @EnvironmentObject var planVM: TrainingPlanViewModel
    @EnvironmentObject var entitlementManager: EntitlementManager
    @EnvironmentObject var runStore: RunStore
    @EnvironmentObject var authVM: AuthViewModel

    /// Inicia a corrida de um treino (passado pelo MainTabView: seta pendingWorkout + troca p/ aba Run).
    var onStartWorkout: ((WorkoutModel) -> Void)? = nil

    @Binding var viewMode: ViewMode
    @State private var calendarMonth: Date = Date()
    @State private var showCreatePlan = false
    @State private var showAssessment = false
    @State private var showAnalysisDetails = false
    @State private var workoutToComplete: WorkoutModel?
    @State private var selectedCalendarDate: Date? = nil
    @State private var showPaywall = false

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
                        // Banner de trial (backend define quando aparece via trialDaysRemaining)
                        if let days = entitlementManager.trialDaysRemaining, days > 0 {
                            trialBanner(days: days)
                                .padding(.horizontal, AthlyTheme.Spacing.sm)
                                .padding(.top, 8)
                        }

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
            .fullScreenCover(isPresented: $showAssessment) {
                AssessmentView {
                    authVM.markAssessmentCompleted()
                    showAssessment = false
                }
            }
            .sheet(isPresented: $showCreatePlan) {
                CreatePlanView()
                    .environmentObject(planVM)
            }
            .sheet(isPresented: $showAnalysisDetails) {
                if let analysis = planVM.lastAnalysis {
                    AnalysisSummarySheet(analysis: analysis)
                        .presentationDetents([.medium, .large])
                        .presentationDragIndicator(.visible)
                }
            }
            .sheet(item: $workoutToComplete) { workout in
                WorkoutCompletionSheet(
                    workout: workout,
                    onComplete: { selection, fallback in
                        let outcome = await planVM.completeWorkoutSelection(
                            workout,
                            selection: selection,
                            fallback: fallback,
                            runStore: runStore
                        )
                        if case .success = outcome {
                            workoutToComplete = nil
                        }
                        return outcome
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

    // MARK: - Trial Banner

    /// Banner discreto com os dias restantes do trial backend. Some quando o backend
    /// devolve `trialDaysRemaining = null` (admin, assinante ativo ou trial expirado).
    private func trialBanner(days: Int) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "hourglass")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(AthlyTheme.Color.primary)
            Text(days == 1
                 ? "Último dia do seu período de teste"
                 : "Período de teste: \(days) dias restantes")
                .font(AthlyTheme.Typography.semibold(13))
                .foregroundColor(AthlyTheme.Color.textSecondary)
            Spacer(minLength: 0)
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 12)
        .background(AthlyTheme.Color.primary.opacity(0.10))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AthlyTheme.Color.primary.opacity(0.25), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    // MARK: - List Mode

    private var listContent: some View {
        ScrollView {
            VStack(spacing: AthlyTheme.Spacing.sm) {
                if let plan = planVM.trainingPlanResponse {
                    // Plan header → tela de detalhe (sumário + viabilidade + análise + excluir)
                    NavigationLink {
                        TrainingPlanDetailView()
                            .environmentObject(planVM)
                    } label: {
                        planHeaderCard(plan)
                    }
                    .buttonStyle(.plain)

                    if let analysis = planVM.lastAnalysis {
                        Button {
                            showAnalysisDetails = true
                        } label: {
                            AnalysisSummaryCard(
                                analysis: analysis,
                                previousWeekAnalysis: planVM.currentWeekGoal?.previousWeekAnalysis,
                                isInteractive: true
                            )
                        }
                        .buttonStyle(.plain)
                        .padding(.horizontal, AthlyTheme.Spacing.sm)
                    }

                    // Generate button
                    generateButton

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
        .athlyTabBarContentClearance()
        .scrollContentBackground(.hidden)
    }

    private func planHeaderCard(_ plan: TrainingPlanResponse) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                Text(plan.objective)
                    .font(AthlyTheme.Typography.semibold(17))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AthlyTheme.Color.textTertiary)
            }
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
            if entitlementManager.canUsePremium {
                Task { await planVM.generateNextWeekWithHealth() }
            } else {
                showPaywall = true
            }
        } label: {
            HStack {
                if planVM.isGenerating {
                    ProgressView()
                        .tint(.white)
                        .scaleEffect(0.8)
                } else if planVM.isGeneratingInBackground {
                    Image(systemName: "clock.arrow.circlepath")
                } else {
                    Image(systemName: "sparkles")
                }
                Text(generateButtonTitle)
            }
        }
        .buttonStyle(AthlyGradientButtonStyle())
        .disabled(planVM.isGenerating || planVM.isGeneratingInBackground)
        .sheet(isPresented: $showPaywall) {
            // Founder vê a offering founder; demais usuários veem a offering default.
            AthlyPaywallView(
                founderEligible: entitlementManager.isFounderEligible,
                onPurchaseCompleted: { _ in
                    showPaywall = false
                    Task { await entitlementManager.refresh() }
                },
                onRestoreCompleted: { _ in
                    Task { await entitlementManager.refresh() }
                }
            )
        }
    }

    private var generateButtonTitle: String {
        if planVM.isGenerating { return "Iniciando geração..." }
        if planVM.isGeneratingInBackground { return "Gerando em segundo plano" }
        return "Gerar Próxima Semana"
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
                        WorkoutDetailView(workout: workout, onComplete: {
                            workoutToComplete = workout
                        }, onStart: onStartWorkout)
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

            Button {
                showAssessment = true
            } label: {
                HStack {
                    Image(systemName: "checklist")
                    Text("Responder questionário")
                }
            }
            .buttonStyle(AthlySecondaryButtonStyle())

            Text("ou")
                .font(AthlyTheme.Typography.body(13))
                .foregroundStyle(AthlyTheme.Color.textTertiary)

            generateButton
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
            .athlyTabBarContentClearance()
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
                        WorkoutDetailView(workout: workout, onComplete: {
                            workoutToComplete = workout
                        }, onStart: onStartWorkout)
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
