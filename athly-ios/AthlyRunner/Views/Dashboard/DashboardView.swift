import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var planVM: TrainingPlanViewModel
    @EnvironmentObject var authVM: AuthViewModel
    @EnvironmentObject var runStore: RunStore
    @Binding var selectedTab: AppTab
    @Binding var pendingWorkout: WorkoutModel?
    var onOpenPlanCalendar: (() -> Void)? = nil

    @State private var workoutToComplete: WorkoutModel?

    private var recentRuns: [RunSession] { runStore.sortedSessions }

    private static let weekdayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

    var body: some View {
        NavigationStack {
            ZStack {
                // Base background
                AthlyTheme.Color.backgroundDark
                    .ignoresSafeArea()

                // Ambient purple glow at top-left (contido no canto)
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

                // Ambient cyan glow at bottom-right (contido no canto)
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

                if planVM.isLoading {
                    ProgressView()
                        .tint(AthlyTheme.Color.primary)
                } else {
                    ScrollView {
                        VStack(spacing: AthlyTheme.Spacing.sm) {
                            greetingSection
                            if planVM.todayWorkout == nil {
                                restDayCard
                            }
                            weeklyProgressCard
                            activityBarsCard
                            GeneralProgressCard(
                                streak: planVM.currentStreak,
                                achievements: planVM.achievementCount
                            )
                        }
                        .padding(AthlyTheme.Spacing.sm)
                    }
                    .athlyTabBarContentClearance()
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Athly")
            .task { await planVM.loadData() }
            .sheet(item: $workoutToComplete) { workout in
                WorkoutCompletionSheet(
                    workout: workout,
                    onComplete: { selection in
                        let succeeded = await planVM.completeWorkoutSelection(
                            workout,
                            selection: selection,
                            runStore: runStore
                        )
                        if succeeded { workoutToComplete = nil }
                        return succeeded
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

    // MARK: - Greeting

    private var greetingSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Olá, \(authVM.userName.isEmpty ? "Atleta" : authVM.userName)!")
                    .font(AthlyTheme.Typography.heading(24))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [AthlyTheme.Color.primary, AthlyTheme.Color.secondary],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                Text(greetingSubtitle)
                    .font(AthlyTheme.Typography.body(15))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
            }
            Spacer()
            ZStack {
                Circle()
                    .fill(AthlyTheme.Color.primary.opacity(0.15))
                    .frame(width: 48, height: 48)
                Image(systemName: "figure.run")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(AthlyTheme.Color.primary)
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyCard()
    }

    private var greetingSubtitle: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 6..<12: return "Bom dia! Pronto para treinar?"
        case 12..<18: return "Boa tarde! Hora do treino?"
        default: return "Boa noite! Recuperando bem?"
        }
    }

    // MARK: - Rest Day

    private var restDayCard: some View {
        HStack(spacing: 12) {
            Image(systemName: "moon.zzz")
                .font(.largeTitle)
                .foregroundStyle(AthlyTheme.Color.textTertiary)
            VStack(alignment: .leading, spacing: 4) {
                Text("Dia de descanso")
                    .font(AthlyTheme.Typography.semibold(17))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                Text("Aproveite para recuperar. Amanhã tem mais!")
                    .font(AthlyTheme.Typography.body(15))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
            }
            Spacer()
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyCard()
    }

    // MARK: - Weekly Progress

    private var highlightedWorkout: WorkoutModel? {
        planVM.todayWorkout ?? planVM.thisWeekNext
    }

    @ViewBuilder
    private var weeklyProgressCard: some View {
        if planVM.thisWeekTotal == 0 {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { selectedTab = .plan }
            } label: {
                weeklyProgressCardInner
            }
            .buttonStyle(.plain)
        } else {
            weeklyProgressCardInner
        }
    }

    private var weeklyProgressCardInner: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("PROGRESSO SEMANAL")
                        .font(AthlyTheme.Typography.label())
                        .foregroundStyle(AthlyTheme.Color.primary)

                    if planVM.thisWeekTotal == 0 {
                        Text("Nenhum treino planejado")
                            .font(AthlyTheme.Typography.heading(22))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                    } else {
                        Text("\(planVM.thisWeekCompleted) / \(planVM.thisWeekTotal) treinos")
                            .font(AthlyTheme.Typography.heading(22))
                            .foregroundStyle(AthlyTheme.Color.textPrimary)
                    }
                }
                Spacer()

                // Progress percentage badge
                ZStack {
                    Capsule()
                        .fill(AthlyTheme.Color.secondary.opacity(0.15))
                        .overlay(
                            Capsule().stroke(AthlyTheme.Color.secondary.opacity(0.4), lineWidth: 1)
                        )
                    HStack(spacing: 3) {
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 10, weight: .bold))
                        Text("\(Int(planVM.thisWeekProgress * 100))%")
                            .font(AthlyTheme.Typography.semibold(13))
                    }
                    .foregroundStyle(AthlyTheme.Color.secondary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                }
            }

            // Progress bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(AthlyTheme.Color.surfaceDark)
                        .frame(height: 8)
                    Capsule()
                        .fill(AthlyTheme.Gradient.brand)
                        .frame(width: max(8, geo.size.width * planVM.thisWeekProgress), height: 8)
                        .shadow(color: AthlyTheme.Color.primary.opacity(0.5), radius: 6)
                }
            }
            .frame(height: 8)

            if let workout = highlightedWorkout {
                Rectangle()
                    .fill(AthlyTheme.Color.glassBorder)
                    .frame(height: 1)
                VStack(alignment: .leading, spacing: 10) {
                    Text(workout.isToday ? "TREINO DE HOJE" : "PRÓXIMO TREINO")
                        .font(AthlyTheme.Typography.label())
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                    NavigationLink {
                        WorkoutDetailView(
                            workout: workout,
                            onComplete: { workoutToComplete = workout },
                            onStart: { startWorkout($0) }
                        )
                        .environmentObject(planVM)
                    } label: {
                        highlightedWorkoutRow(workout)
                    }
                    .buttonStyle(.plain)

                    if workout.isToday && workout.status == .scheduled {
                        Button("Iniciar treino agora") {
                            startWorkout(workout)
                        }
                        .buttonStyle(AthlyGradientButtonStyle())
                    }
                }
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyInsightCard()
    }

    private func highlightedWorkoutRow(_ workout: WorkoutModel) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(AthlyTheme.Color.primary.opacity(0.14))
                        .frame(width: 42, height: 42)
                    Image(systemName: workout.sportType.sfSymbol)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(AthlyTheme.Color.primary)
                }

                VStack(alignment: .leading, spacing: 5) {
                    Text(workout.sportType.label)
                        .font(AthlyTheme.Typography.label())
                        .textCase(.uppercase)
                        .foregroundStyle(AthlyTheme.Color.primary)
                    Text(workout.title)
                        .font(AthlyTheme.Typography.semibold(16))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                        .lineLimit(2)
                }

                Spacer(minLength: 8)
                StatusBadgeView(status: workout.status)
            }

            HStack(spacing: 12) {
                if let intensity = workout.intensity {
                    Label("Intensidade \(Int(intensity))", systemImage: "bolt.fill")
                        .font(AthlyTheme.Typography.body(12))
                        .foregroundStyle(intensityColor(intensity))
                }

                Spacer()
            }
        }
        .padding(12)
        .background(AthlyTheme.Color.surfaceDark.opacity(0.78))
        .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous)
                .stroke(AthlyTheme.Color.glassBorder, lineWidth: 1)
        )
    }

    private func startWorkout(_ workout: WorkoutModel) {
        pendingWorkout = workout
        withAnimation(.easeInOut(duration: 0.2)) {
            selectedTab = .run
        }
    }

    private func intensityColor(_ value: Double) -> Color {
        switch Int(value) {
        case 1...3: return AthlyTheme.Color.success
        case 4...6: return AthlyTheme.Color.warning
        default: return AthlyTheme.Color.error
        }
    }

    // MARK: - Activity Bars

    private var activityBarsCard: some View {
        let cal = Calendar.current
        let today = Date()
        let weekStart = cal.date(from: cal.dateComponents([.yearForWeekOfYear, .weekOfYear], from: today))!
        let days = (0..<7).compactMap { cal.date(byAdding: .day, value: $0, to: weekStart) }
        let weekKm = recentRuns.filter {
            cal.isDate($0.startDate, equalTo: weekStart, toGranularity: .weekOfYear)
        }.reduce(0.0) { $0 + $1.distanceKm }

        return Button {
            onOpenPlanCalendar?()
        } label: {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Esta semana")
                    .font(AthlyTheme.Typography.semibold(17))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                Spacer()
                if weekKm > 0 {
                    Text(String(format: "%.1f km", weekKm))
                        .font(AthlyTheme.Typography.body(13))
                        .foregroundStyle(AthlyTheme.Color.secondary)
                }
            }

            HStack(alignment: .bottom, spacing: 6) {
                ForEach(Array(days.enumerated()), id: \.offset) { idx, day in
                    let dayRuns = recentRuns.filter {
                        cal.isDate($0.startDate, inSameDayAs: day)
                    }
                    let km = dayRuns.reduce(0) { $0 + $1.distanceKm }
                    let isToday = cal.isDateInToday(day)
                    let isFuture = day > today

                    VStack(spacing: 4) {
                        if km > 0 {
                            RoundedRectangle(cornerRadius: 5)
                                .fill(AthlyTheme.Gradient.brand)
                                .frame(height: max(10, CGFloat(km) * 10))
                                .frame(maxHeight: 60)
                                .shadow(color: AthlyTheme.Color.primary.opacity(0.5), radius: 4)
                        } else {
                            RoundedRectangle(cornerRadius: 5)
                                .fill(AthlyTheme.Color.surfaceDark.opacity(isFuture ? 0.45 : 1))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 5)
                                        .stroke(AthlyTheme.Color.glassBorder, lineWidth: 1)
                                )
                                .frame(height: 10)
                        }

                        Text(Self.weekdayLabels[idx])
                            .font(AthlyTheme.Typography.body(11))
                            .foregroundStyle(
                                isToday ? AthlyTheme.Color.primary
                                : isFuture ? AthlyTheme.Color.textTertiary.opacity(0.45)
                                : AthlyTheme.Color.textTertiary
                            )
                            .fontWeight(isToday ? .bold : .regular)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyCard()
        }
        .buttonStyle(.plain)
    }
}
