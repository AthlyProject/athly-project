import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var planVM: TrainingPlanViewModel
    @EnvironmentObject var authVM: AuthViewModel
    @EnvironmentObject var runStore: RunStore

    private var recentRuns: [RunSession] { runStore.sortedSessions }

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
                    endRadius: 200   // era 350 — menor = mais contido
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
                    endRadius: 160   // era 280
                )
                .ignoresSafeArea()

                if planVM.isLoading {
                    ProgressView()
                        .tint(AthlyTheme.Color.primary)
                } else {
                    ScrollView {
                        VStack(spacing: AthlyTheme.Spacing.sm) {
                            greetingSection
                            todayWorkoutSection
                            weeklyProgressCard
                            quickActionsRow
                            activityBarsCard
                        }
                        .padding(AthlyTheme.Spacing.sm)
                    }
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Athly")
            .task { await planVM.loadData() }
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

    // MARK: - Today's Workout

    @ViewBuilder
    private var todayWorkoutSection: some View {
        if let workout = planVM.todayWorkout {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    HStack(spacing: 6) {
                        Image(systemName: "sparkles")
                            .font(.caption)
                            .foregroundStyle(AthlyTheme.Color.primary)
                        Text("Treino de Hoje")
                            .font(AthlyTheme.Typography.semibold(17))
                            .foregroundStyle(AthlyTheme.Color.textPrimary)
                    }
                    Spacer()
                    StatusBadgeView(status: workout.status)
                }

                WorkoutCardView(workout: workout, compact: true)

                if workout.status == .scheduled {
                    Button("Iniciar treino agora") {}
                        .buttonStyle(AthlyGradientButtonStyle())
                }
            }
            .padding(AthlyTheme.Spacing.sm)
            .athlyCard(glow: true)
        } else {
            restDayCard
        }
    }

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

    // MARK: - Weekly Progress (insight card with stronger gradient)

    private var weeklyProgressCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("PROGRESSO SEMANAL")
                        .font(AthlyTheme.Typography.label())
                        .foregroundStyle(AthlyTheme.Color.primary)

                    Text("\(planVM.completedThisWeek) / \(planVM.totalThisWeek) treinos")
                        .font(AthlyTheme.Typography.heading(22))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
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
                        Text("\(Int(planVM.weeklyProgress * 100))%")
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
                        .frame(width: max(8, geo.size.width * planVM.weeklyProgress), height: 8)
                        .shadow(color: AthlyTheme.Color.primary.opacity(0.5), radius: 6)
                }
            }
            .frame(height: 8)

            // Stats row
            HStack(spacing: 0) {
                statMini(value: "\(planVM.completedThisWeek)", label: "Esta Semana", sfSymbol: "figure.strengthtraining.traditional")
                Rectangle()
                    .fill(AthlyTheme.Color.glassBorder)
                    .frame(width: 1, height: 40)
                statMini(value: "-", label: "Sequência", sfSymbol: "flame")
                Rectangle()
                    .fill(AthlyTheme.Color.glassBorder)
                    .frame(width: 1, height: 40)
                statMini(value: "\(planVM.allWorkouts.filter { $0.status == .done }.count)", label: "Total", sfSymbol: "medal")
            }

            if let next = planVM.nextWorkout {
                Rectangle()
                    .fill(AthlyTheme.Color.glassBorder)
                    .frame(height: 1)
                VStack(alignment: .leading, spacing: 6) {
                    Text("PRÓXIMO TREINO")
                        .font(AthlyTheme.Typography.label())
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                    WorkoutCardView(workout: next, compact: true)
                }
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyInsightCard()
    }

    private func statMini(value: String, label: String, sfSymbol: String) -> some View {
        VStack(spacing: 2) {
            Image(systemName: sfSymbol)
                .font(.title3)
                .foregroundStyle(AthlyTheme.Color.primary)
            Text(value)
                .font(AthlyTheme.Typography.semibold(15))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Text(label)
                .font(AthlyTheme.Typography.body(11))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Quick Actions

    private var quickActionsRow: some View {
        HStack(spacing: 12) {
            quickActionButton(
                icon: "list.bullet.clipboard",
                label: "Ver plano",
                color: AthlyTheme.Color.primary
            ) {}

            quickActionButton(
                icon: "clock.arrow.trianglehead.counterclockwise.rotate.90",
                label: "Histórico",
                color: AthlyTheme.Color.secondary
            ) {}
        }
    }

    private func quickActionButton(icon: String, label: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(color.opacity(0.15))
                        .frame(width: 32, height: 32)
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(color)
                }
                Text(label)
                    .font(AthlyTheme.Typography.semibold(15))
                    .foregroundStyle(color)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(color.opacity(0.5))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(color.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.button)
                    .stroke(color.opacity(0.25), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
    }

    // MARK: - Activity Bars

    private var activityBarsCard: some View {
        let days = (0..<7).map { offset in
            Calendar.current.date(byAdding: .day, value: -offset, to: Date())!
        }.reversed()

        return VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Últimos 7 dias")
                    .font(AthlyTheme.Typography.semibold(17))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                Spacer()
                let totalKm = recentRuns.prefix(7).reduce(0.0) { $0 + $1.distanceKm }
                if totalKm > 0 {
                    Text(String(format: "%.1f km", totalKm))
                        .font(AthlyTheme.Typography.body(13))
                        .foregroundStyle(AthlyTheme.Color.secondary)
                }
            }

            HStack(alignment: .bottom, spacing: 6) {
                ForEach(Array(days.enumerated()), id: \.offset) { _, day in
                    let dayRuns = recentRuns.filter {
                        Calendar.current.isDate($0.startDate, inSameDayAs: day)
                    }
                    let km = dayRuns.reduce(0) { $0 + $1.distanceKm }
                    let isToday = Calendar.current.isDateInToday(day)

                    VStack(spacing: 4) {
                        if km > 0 {
                            RoundedRectangle(cornerRadius: 5)
                                .fill(AthlyTheme.Gradient.brand)
                                .frame(height: max(10, CGFloat(km) * 10))
                                .frame(maxHeight: 60)
                                .shadow(color: AthlyTheme.Color.primary.opacity(0.5), radius: 4)
                        } else {
                            RoundedRectangle(cornerRadius: 5)
                                .fill(AthlyTheme.Color.surfaceDark)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 5)
                                        .stroke(AthlyTheme.Color.glassBorder, lineWidth: 1)
                                )
                                .frame(height: 10)
                        }

                        Text(day.formatted(.dateTime.weekday(.narrow)))
                            .font(AthlyTheme.Typography.body(11))
                            .foregroundStyle(isToday ? AthlyTheme.Color.primary : AthlyTheme.Color.textTertiary)
                            .fontWeight(isToday ? .bold : .regular)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyCard()
    }
}
