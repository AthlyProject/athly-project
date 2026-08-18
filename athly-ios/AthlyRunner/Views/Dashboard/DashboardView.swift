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

    private static let weekdayLabels = ["S", "T", "Q", "Q", "S", "S", "D"]

    var body: some View {
        NavigationStack {
            ZStack {
                AthlyTheme.Color.backgroundDark
                    .ignoresSafeArea()

                // Ambient glows (tokens v2)
                RadialGradient(
                    colors: [AthlyTheme.Color.primary.opacity(0.13), .clear],
                    center: .init(x: 0.0, y: 0.0),
                    startRadius: 0, endRadius: 220
                )
                .ignoresSafeArea()

                RadialGradient(
                    colors: [AthlyTheme.Color.secondary.opacity(0.09), .clear],
                    center: .init(x: 1.0, y: 1.0),
                    startRadius: 0, endRadius: 200
                )
                .ignoresSafeArea()

                if planVM.isLoading {
                    ProgressView()
                        .tint(AthlyTheme.Color.primary)
                } else {
                    ScrollView {
                        VStack(spacing: 12) {
                            greetingSection

                            if let workout = planVM.todayWorkout {
                                todayCard(workout)
                            } else {
                                restDayCard
                            }

                            weeklyCard

                            if let insight = insightText {
                                insightCard(insight)
                            }

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
            .toolbar(.hidden, for: .navigationBar)
            .task { await planVM.loadData() }
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
                        if case .success = outcome { workoutToComplete = nil }
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

    // MARK: - Greeting

    private var greetingSection: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
                Text(todayLongDate)
                    .font(AthlyTheme.Typography.body(11))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                Text("\(greetingPrefix), \(firstName)")
                    .font(AthlyTheme.Typography.heading(21))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
            }
            Spacer()
            Text(initials)
                .font(AthlyTheme.Typography.semibold(13))
                .foregroundStyle(.white)
                .frame(width: 38, height: 38)
                .background(AthlyTheme.Gradient.brand)
                .clipShape(Circle())
                .shadow(color: AthlyTheme.Color.primaryGlow, radius: 8)
        }
        .padding(.vertical, 4)
    }

    private var firstName: String {
        let name = authVM.userName.split(separator: " ").first.map(String.init) ?? ""
        return name.isEmpty ? "Atleta" : name
    }

    private var initials: String {
        let letters = authVM.userName
            .split(separator: " ")
            .prefix(2)
            .compactMap { $0.first }
            .map(String.init)
            .joined()
            .uppercased()
        return letters.isEmpty ? "A" : letters
    }

    private var todayLongDate: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "pt-BR")
        f.dateFormat = "EEEE, d 'de' MMM"
        return f.string(from: Date()).capitalized
    }

    private var greetingPrefix: String {
        switch Calendar.current.component(.hour, from: Date()) {
        case 6..<12: return "Bom dia"
        case 12..<18: return "Boa tarde"
        default: return "Boa noite"
        }
    }

    // MARK: - Today's Workout (hero)

    private func todayCard(_ workout: WorkoutModel) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // Badge
            HStack(spacing: 5) {
                Circle()
                    .fill(AthlyTheme.Color.primary)
                    .frame(width: 6, height: 6)
                Text("Hoje · \(workout.sportType.label)")
                    .font(AthlyTheme.Typography.label())
                    .textCase(.uppercase)
                    .kerning(0.6)
                    .foregroundStyle(AthlyTheme.Color.primary)
            }
            .padding(.horizontal, 9)
            .padding(.vertical, 3)
            .background(AthlyTheme.Color.primarySoft)
            .overlay(Capsule().stroke(AthlyTheme.Color.primaryBorder, lineWidth: 1))
            .clipShape(Capsule())
            .padding(.bottom, 10)

            // Title (tap → detail)
            NavigationLink {
                WorkoutDetailView(
                    workout: workout,
                    onComplete: { workoutToComplete = workout },
                    onStart: { startWorkout($0) }
                )
                .environmentObject(planVM)
            } label: {
                Text(workout.title)
                    .font(AthlyTheme.Typography.heading(16))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
            .padding(.bottom, 12)

            // Stats
            HStack(spacing: 0) {
                todayStat(
                    value: workout.totalDurationMinutes.map(String.init) ?? "—",
                    label: "min"
                )
                statDivider
                todayStat(
                    value: workout.totalDistanceKm.map { String(format: "%.1f", $0) } ?? "—",
                    label: "km"
                )
                statDivider
                todayStat(
                    value: workout.intensity.map { String(Int($0)) } ?? "—",
                    label: "intensidade",
                    color: workout.intensity.map(intensityColor) ?? AthlyTheme.Color.textPrimary
                )
            }
            .padding(.bottom, 12)

            // CTA
            if workout.status == .done {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                    Text("Treino concluído")
                }
                .font(AthlyTheme.Typography.semibold(13))
                .foregroundStyle(AthlyTheme.Color.success)
                .frame(maxWidth: .infinity)
                .frame(height: 40)
                .background(AthlyTheme.Color.success.opacity(0.10))
                .overlay(
                    RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                        .stroke(AthlyTheme.Color.success.opacity(0.22), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
            } else {
                Button {
                    startWorkout(workout)
                } label: {
                    HStack(spacing: 6) {
                        Text("Iniciar Treino")
                        Image(systemName: "arrow.right")
                            .font(.system(size: 12, weight: .bold))
                    }
                    .font(AthlyTheme.Typography.heading(13))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 40)
                    .background(AthlyTheme.Gradient.brand)
                    .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
                    .shadow(color: AthlyTheme.Color.primaryGlow, radius: 10)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(14)
        .background(
            ZStack {
                AthlyTheme.Color.surfaceCard
                AthlyTheme.Gradient.soft
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(AthlyTheme.Color.primaryBorder, lineWidth: 1)
        )
        .shadow(color: AthlyTheme.Color.primary.opacity(0.10), radius: 16, y: 4)
    }

    private func todayStat(value: String, label: String, color: Color = AthlyTheme.Color.textPrimary) -> some View {
        VStack(spacing: 1) {
            Text(value)
                .font(AthlyTheme.Typography.mono(16))
                .foregroundStyle(color)
            Text(label)
                .font(AthlyTheme.Typography.label())
                .textCase(.uppercase)
                .kerning(0.5)
                .foregroundStyle(AthlyTheme.Color.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }

    private var statDivider: some View {
        Rectangle()
            .fill(AthlyTheme.Color.borderMid)
            .frame(width: 1, height: 28)
    }

    // MARK: - Rest Day

    private var restDayCard: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) { selectedTab = .plan }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "moon.zzz.fill")
                    .font(.system(size: 26))
                    .foregroundStyle(AthlyTheme.Color.textTertiary)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Dia de descanso")
                        .font(AthlyTheme.Typography.semibold(16))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                    Text("Aproveite para recuperar. Toque para ver seu plano.")
                        .font(AthlyTheme.Typography.body(12))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 0)
            }
            .padding(14)
            .athlyCard()
        }
        .buttonStyle(.plain)
    }

    // MARK: - Weekly progress

    private var weeklyCard: some View {
        Button {
            onOpenPlanCalendar?()
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Esta semana")
                        .font(AthlyTheme.Typography.heading(12))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                    Spacer()
                    Text(String(format: "%.1f km", weekKm))
                        .font(AthlyTheme.Typography.mono(11))
                        .foregroundStyle(AthlyTheme.Color.primary)
                }

                HStack(spacing: 4) {
                    ForEach(Array(weekDayStates.enumerated()), id: \.offset) { idx, state in
                        VStack(spacing: 4) {
                            weekDot(state)
                            Text(Self.weekdayLabels[idx])
                                .font(AthlyTheme.Typography.label())
                                .foregroundStyle(state == .today ? AthlyTheme.Color.primary : AthlyTheme.Color.textTertiary)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }

                HStack(spacing: 6) {
                    weekChip(
                        value: "\(planVM.thisWeekCompleted)/\(planVM.thisWeekTotal)",
                        label: "Treinos",
                        color: AthlyTheme.Color.primary
                    )
                    weekChip(
                        value: planVM.lastAnalysis?.avgPace ?? "—",
                        label: "Pace méd."
                    )
                    weekChip(
                        value: evolutionValue,
                        label: "Evolução",
                        color: evolutionColor
                    )
                }
            }
            .padding(13)
            .athlyCard()
        }
        .buttonStyle(.plain)
    }

    private enum DayState { case done, today, rest, upcoming }

    private var weekDayStates: [DayState] {
        var cal = Calendar.current
        cal.firstWeekday = 2
        let today = Date()
        guard let interval = cal.dateInterval(of: .weekOfYear, for: today) else { return [] }
        return (0..<7).map { offset in
            let day = cal.date(byAdding: .day, value: offset, to: interval.start) ?? interval.start
            let isToday = cal.isDate(day, inSameDayAs: today)
            let hasRun = recentRuns.contains { cal.isDate($0.startDate, inSameDayAs: day) }
            let dayWorkouts = planVM.allWorkouts.filter { $0.isOnDay(day) && $0.sportType != .other }
            let done = hasRun || dayWorkouts.contains { $0.status == .done }
            if done { return .done }
            if isToday { return .today }
            if dayWorkouts.isEmpty { return .rest }
            return .upcoming
        }
    }

    @ViewBuilder
    private func weekDot(_ state: DayState) -> some View {
        switch state {
        case .done:
            ZStack {
                Circle().fill(AthlyTheme.Color.success)
                Image(systemName: "checkmark")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.white)
            }
            .frame(width: 24, height: 24)
        case .today:
            Circle()
                .fill(AthlyTheme.Color.primarySoft)
                .overlay(Circle().stroke(AthlyTheme.Color.primary, lineWidth: 1.5))
                .frame(width: 24, height: 24)
        case .rest:
            Circle()
                .stroke(style: StrokeStyle(lineWidth: 1.5, dash: [3, 2]))
                .foregroundStyle(AthlyTheme.Color.borderMid)
                .frame(width: 24, height: 24)
        case .upcoming:
            Circle()
                .stroke(AthlyTheme.Color.borderMid, lineWidth: 1.5)
                .frame(width: 24, height: 24)
        }
    }

    private func weekChip(value: String, label: String, color: Color = AthlyTheme.Color.textPrimary) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(value)
                .font(AthlyTheme.Typography.mono(13))
                .foregroundStyle(color)
            Text(label)
                .font(AthlyTheme.Typography.label())
                .textCase(.uppercase)
                .kerning(0.4)
                .foregroundStyle(AthlyTheme.Color.textTertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 9)
        .padding(.vertical, 7)
        .background(AthlyTheme.Color.surfaceDark)
        .overlay(
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .stroke(AthlyTheme.Color.borderDark, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
    }

    private var weekKm: Double {
        var cal = Calendar.current
        cal.firstWeekday = 2
        return recentRuns
            .filter { cal.isDate($0.startDate, equalTo: Date(), toGranularity: .weekOfYear) }
            .reduce(0.0) { $0 + $1.distanceKm }
    }

    private var evolutionValue: String {
        guard let trend = planVM.lastAnalysis?.trend else { return "—" }
        switch trend {
        case "improving": return "↑"
        case "declining": return "↓"
        default: return "→"
        }
    }

    private var evolutionColor: Color {
        switch planVM.lastAnalysis?.trend {
        case "improving": return AthlyTheme.Color.success
        case "declining": return AthlyTheme.Color.error
        default: return AthlyTheme.Color.textSecondary
        }
    }

    // MARK: - AI Insight

    private var insightText: String? {
        guard let insight = planVM.lastAnalysis?.fitnessInsights, !insight.isEmpty else { return nil }
        return insight
    }

    private func insightCard(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "wand.and.stars")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(AthlyTheme.Color.primary)
                .frame(width: 32, height: 32)
                .background(AthlyTheme.Color.primarySoft)
                .overlay(
                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                        .stroke(AthlyTheme.Color.primaryBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                Text("✦ IA Athly")
                    .font(AthlyTheme.Typography.label())
                    .textCase(.uppercase)
                    .kerning(0.8)
                    .foregroundStyle(AthlyTheme.Color.primary)
                Text(text)
                    .font(AthlyTheme.Typography.medium(11))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .athlyInsightCard()
    }

    // MARK: - Actions

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
}
