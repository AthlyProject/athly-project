import SwiftUI

struct PlanView: View {
    @EnvironmentObject var planVM: TrainingPlanViewModel

    @State private var viewMode: ViewMode = .list
    @State private var calendarMonth: Date = Date()

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

                    // Generate button
                    generateButton

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
                    Text(sport.emoji)
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
            statCell(value: "\(planVM.completedThisWeek)/\(planVM.totalThisWeek)", label: "Concluídos", emoji: "✅")
            Divider().background(AthlyTheme.Color.borderDark)
            statCell(value: "\(Int(planVM.weeklyProgress * 100))%", label: "Progresso", emoji: "📈")

            if let goal = planVM.weeks[safe: planVM.selectedWeekIndex]?.weeklyGoal,
               let metrics = goal.metrics,
               let title = metrics.title {
                Divider().background(AthlyTheme.Color.borderDark)
                statCell(value: "", label: title, emoji: "🎯")
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .athlyCard()
        .padding(.horizontal, AthlyTheme.Spacing.sm)
    }

    private func statCell(value: String, label: String, emoji: String) -> some View {
        VStack(spacing: 4) {
            Text(emoji)
                .font(.title2)
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
        let workouts = planVM.currentWeekWorkouts
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
                            Task { await planVM.completeWorkout(workout) }
                        } label: {
                            Label("Marcar como concluído", systemImage: "checkmark.circle")
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
        VStack(spacing: 16) {
            Image(systemName: "sparkles")
                .font(.system(size: 48))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
            Text("Sem plano de treino")
                .font(AthlyTheme.Typography.semibold(17))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Text("Crie um plano de treino no aplicativo web para começar.")
                .font(AthlyTheme.Typography.body(15))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(40)
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
                CalendarGridView(month: calendarMonth, workouts: planVM.allWorkouts)
                    .padding(.horizontal, AthlyTheme.Spacing.sm)
                    .padding(.bottom, AthlyTheme.Spacing.sm)
            }
            .scrollContentBackground(.hidden)
        }
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
