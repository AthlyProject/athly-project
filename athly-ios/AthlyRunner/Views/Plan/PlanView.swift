import SwiftUI

struct PlanView: View {
    @EnvironmentObject var planVM: TrainingPlanViewModel
    @EnvironmentObject var entitlementManager: EntitlementManager
    @EnvironmentObject var runStore: RunStore
    @EnvironmentObject var authVM: AuthViewModel

    /// Inicia a corrida de um treino (passado pelo MainTabView: seta pendingWorkout + troca p/ aba Run).
    var onStartWorkout: ((WorkoutModel) -> Void)? = nil

    @State private var visibleWeekStart: Date = PlanView.weekStart(for: Date())
    @State private var showAssessment = false
    @State private var workoutToComplete: WorkoutModel?
    /// Dia atualmente sob o cursor durante um drag de reagendamento (destaque visual).
    @State private var dropTargetDay: Date?

    private var calendar: Calendar {
        var cal = Calendar.current
        cal.firstWeekday = 2 // segunda-feira
        return cal
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AthlyTheme.Color.backgroundDark
                    .ignoresSafeArea()

                RadialGradient(
                    colors: [AthlyTheme.Color.secondary.opacity(0.14), .clear],
                    center: .init(x: 0.0, y: 0.0),
                    startRadius: 0, endRadius: 220
                )
                .ignoresSafeArea()

                if planVM.isLoading {
                    ProgressView()
                        .tint(AthlyTheme.Color.primary)
                } else {
                    VStack(spacing: 0) {
                        if let days = entitlementManager.trialDaysRemaining, days > 0 {
                            trialBanner(days: days)
                                .padding(.horizontal, AthlyTheme.Spacing.sm)
                                .padding(.top, 8)
                        }

                        if planVM.isGeneratingInBackground {
                            generatingBanner
                                .padding(.horizontal, AthlyTheme.Spacing.sm)
                                .padding(.top, 8)
                        }

                        if planVM.trainingPlanResponse == nil {
                            if !planVM.isGeneratingInBackground {
                                noGoalState
                            }
                        } else {
                            planContent
                        }
                    }
                }
            }
            .navigationTitle("Plano")
            .toolbar(.hidden, for: .navigationBar)
            .task { await planVM.loadData() }
            .fullScreenCover(isPresented: $showAssessment) {
                AssessmentView {
                    authVM.markAssessmentCompleted()
                    showAssessment = false
                    // Objetivo já foi criado no backend; gera a primeira semana
                    // automaticamente (com dados do Apple Health) sem exigir toque manual.
                    Task { await planVM.generateNextWeekWithHealth() }
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

    // MARK: - Plan content (week strip + day list)

    private var planContent: some View {
        ScrollViewReader { proxy in
            VStack(spacing: 0) {
                weekStrip(interactive: true) { day in
                    withAnimation(.easeInOut(duration: 0.25)) {
                        proxy.scrollTo(dayID(day), anchor: .top)
                    }
                }
                .padding(.horizontal, AthlyTheme.Spacing.sm)
                .padding(.top, 8)
                .padding(.bottom, 4)
                .background(AthlyTheme.Color.backgroundDark)

                ScrollView {
                    VStack(spacing: 12) {
                        dayList
                    }
                    .padding(.horizontal, AthlyTheme.Spacing.sm)
                    .padding(.top, 8)
                }
                .athlyTabBarContentClearance()
                .scrollContentBackground(.hidden)
            }
        }
    }

    // MARK: - Week strip

    private func weekStrip(interactive: Bool, onSelectDay: @escaping (Date) -> Void) -> some View {
        VStack(spacing: 8) {
            HStack {
                HStack(spacing: 4) {
                    navButton(icon: "chevron.left") {
                        visibleWeekStart = calendar.date(byAdding: .day, value: -7, to: visibleWeekStart) ?? visibleWeekStart
                    }
                    navButton(icon: "chevron.right") {
                        visibleWeekStart = calendar.date(byAdding: .day, value: 7, to: visibleWeekStart) ?? visibleWeekStart
                    }
                }

                Spacer()

                Text(monthLabel)
                    .font(AthlyTheme.Typography.heading(13))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)

                Spacer()

                HStack(spacing: 8) {
                    Button {
                        visibleWeekStart = Self.weekStart(for: Date())
                    } label: {
                        Text("Hoje")
                            .font(AthlyTheme.Typography.semibold(10))
                            .textCase(.uppercase)
                            .foregroundStyle(AthlyTheme.Color.primary)
                            .padding(.horizontal, 9)
                            .padding(.vertical, 2)
                            .background(AthlyTheme.Color.primarySoft)
                            .overlay(Capsule().stroke(AthlyTheme.Color.primaryBorder, lineWidth: 1))
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)

                    if interactive, planVM.trainingPlanResponse != nil {
                        NavigationLink {
                            TrainingPlanDetailView()
                                .environmentObject(planVM)
                        } label: {
                            Image(systemName: "list.bullet")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(AthlyTheme.Color.primary)
                                .frame(width: 26, height: 26)
                                .background(AthlyTheme.Color.primarySoft)
                                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            HStack(spacing: 2) {
                ForEach(weekDays, id: \.self) { day in
                    weekCell(day)
                        .onTapGesture { onSelectDay(day) }
                }
            }
        }
    }

    private func navButton(icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .frame(width: 26, height: 26)
                .background(AthlyTheme.Color.surfaceCard)
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func weekCell(_ day: Date) -> some View {
        let isToday = calendar.isDateInToday(day)
        let isPast = day < calendar.startOfDay(for: Date())
        let dayWorkouts = workouts(on: day)
        let done = !dayWorkouts.isEmpty && dayWorkouts.allSatisfy { $0.status == .done }
        let dotColor: Color = done
            ? AthlyTheme.Color.success
            : dayWorkouts.isEmpty ? .clear
            : (isToday ? AthlyTheme.Color.primary : AthlyTheme.Color.textTertiary)

        return VStack(spacing: 3) {
            Text(dayAbbr(day))
                .font(.system(size: 8, weight: .bold))
                .textCase(.uppercase)
                .foregroundStyle(isToday ? AthlyTheme.Color.primary : AthlyTheme.Color.textTertiary)

            Text("\(calendar.component(.day, from: day))")
                .font(AthlyTheme.Typography.semibold(11))
                .foregroundStyle(isToday ? .white : isPast ? AthlyTheme.Color.textTertiary : AthlyTheme.Color.textSecondary)
                .frame(width: 26, height: 26)
                .background(
                    Circle()
                        .fill(isToday ? AthlyTheme.Color.primary : Color.clear)
                        .shadow(color: isToday ? AthlyTheme.Color.primaryGlow : .clear, radius: 6)
                )

            Circle()
                .fill(dotColor)
                .frame(width: 5, height: 5)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(isToday ? AthlyTheme.Color.surfaceCardElevated : Color.clear)
        )
        .contentShape(Rectangle())
    }

    // MARK: - Day list

    private var dayList: some View {
        VStack(spacing: 4) {
            ForEach(weekDays, id: \.self) { day in
                daySection(day)
                    .id(dayID(day))
            }
        }
    }

    private func daySection(_ day: Date) -> some View {
        let isToday = calendar.isDateInToday(day)
        let isPast = day < calendar.startOfDay(for: Date())
        let dayWorkouts = workouts(on: day)
        let allDone = !dayWorkouts.isEmpty && dayWorkouts.allSatisfy { $0.status == .done }
        let isDropTarget = dropTargetDay == day

        return VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 7) {
                Text(dayHeaderLabel(day))
                    .font(AthlyTheme.Typography.semibold(11))
                    .foregroundStyle(
                        isToday ? AthlyTheme.Color.primary
                        : isPast ? AthlyTheme.Color.textTertiary
                        : AthlyTheme.Color.textSecondary
                    )

                if allDone {
                    tag("Concluído", color: AthlyTheme.Color.success,
                        bg: AthlyTheme.Color.success.opacity(0.10), border: AthlyTheme.Color.success.opacity(0.22))
                } else if isToday {
                    tag("Hoje", color: AthlyTheme.Color.primary,
                        bg: AthlyTheme.Color.primarySoft, border: AthlyTheme.Color.primaryBorder)
                }

                Spacer()
            }
            .padding(.horizontal, 4)
            .padding(.top, 2)

            if dayWorkouts.isEmpty {
                restSlot
            } else {
                ForEach(dayWorkouts) { workout in
                    if workout.status == .scheduled {
                        workoutRow(workout)
                            .draggable(workout) {
                                workoutRow(workout)
                                    .frame(width: 260)
                            }
                    } else {
                        workoutRow(workout)
                    }
                }
            }
        }
        .padding(2)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(isDropTarget ? AthlyTheme.Color.primarySoft : Color.clear)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(isDropTarget ? AthlyTheme.Color.primary : Color.clear, lineWidth: 1.5)
        )
        .animation(.easeInOut(duration: 0.15), value: isDropTarget)
        .dropDestination(for: WorkoutModel.self) { items, _ in
            guard let dragged = items.first else { return false }
            guard !calendar.isDate(dragged.parsedDate, inSameDayAs: day) else { return false }
            // Envia só o dia (yyyy-MM-dd) no calendário local — o backend guarda a data,
            // então serializar como timestamp UTC deslocava o dia em fusos a leste de UTC.
            let dayString = Self.idFormatter.string(from: day)
            Task { await planVM.rescheduleWorkout(dragged, toDay: dayString) }
            return true
        } isTargeted: { targeted in
            if targeted {
                dropTargetDay = day
            } else if dropTargetDay == day {
                dropTargetDay = nil
            }
        }
    }

    private func workoutRow(_ workout: WorkoutModel) -> some View {
        let isDone = workout.status == .done
        return NavigationLink {
            WorkoutDetailView(
                workout: workout,
                onComplete: { workoutToComplete = workout },
                onStart: onStartWorkout,
                onSkip: { Task { await planVM.skipWorkout(workout) } }
            )
        } label: {
            HStack(spacing: 10) {
                Image(systemName: workout.sportType.sfSymbol)
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(workout.accentColor)
                    .frame(width: 40, height: 40)
                    .background(workout.accentColor.opacity(0.10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(workout.accentColor.opacity(0.22), lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

                VStack(alignment: .leading, spacing: 2) {
                    Text(workout.sportType.label)
                        .font(.system(size: 8, weight: .bold))
                        .textCase(.uppercase)
                        .kerning(0.6)
                        .foregroundStyle(workout.accentColor)
                    Text(workout.title)
                        .font(AthlyTheme.Typography.semibold(12))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                        .lineLimit(1)
                    if let minutes = workout.totalDurationMinutes {
                        HStack(spacing: 3) {
                            Image(systemName: "clock")
                                .font(.system(size: 8))
                            Text("\(minutes) min")
                                .font(AthlyTheme.Typography.mono(9))
                        }
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                    }
                }

                Spacer(minLength: 4)

                Image(systemName: isDone ? "checkmark.circle.fill" : "chevron.right")
                    .font(.system(size: isDone ? 15 : 11, weight: .semibold))
                    .foregroundStyle(isDone ? AthlyTheme.Color.success : AthlyTheme.Color.textTertiary)
            }
            .padding(10)
            .background(AthlyTheme.Color.surfaceCard)
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(AthlyTheme.Color.borderDark, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .opacity(isDone ? 0.55 : 1)
        }
        .buttonStyle(.plain)
    }

    private var restSlot: some View {
        HStack(spacing: 7) {
            Image(systemName: "moon.zzz")
                .font(.system(size: 12))
            Text("Descanso")
                .font(AthlyTheme.Typography.medium(11))
        }
        .foregroundStyle(AthlyTheme.Color.textTertiary)
        .frame(maxWidth: .infinity)
        .frame(height: 42)
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(style: StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
                .foregroundStyle(AthlyTheme.Color.borderMid)
        )
    }


    // MARK: - Generating banner

    private var generatingBanner: some View {
        HStack(spacing: 12) {
            ProgressView()
                .tint(AthlyTheme.Color.primary)
            VStack(alignment: .leading, spacing: 2) {
                Text("Seu treino está sendo preparado")
                    .font(AthlyTheme.Typography.semibold(14))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                Text("Isso pode levar até 3 minutos. Você será notificado quando estiver pronto.")
                    .font(AthlyTheme.Typography.body(12))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
            }
            Spacer()
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyCard()
    }

    // MARK: - No-goal state (S3)

    private var noGoalState: some View {
        VStack(spacing: 0) {
            weekStrip(interactive: false) { _ in }
                .padding(.horizontal, AthlyTheme.Spacing.sm)
                .padding(.top, 8)
                .opacity(0.4)
                .disabled(true)

            Spacer()

            VStack(spacing: 0) {
                Image(systemName: "target")
                    .font(.system(size: 34, weight: .regular))
                    .foregroundStyle(AthlyTheme.Color.primary)
                    .frame(width: 72, height: 72)
                    .background(AthlyTheme.Color.primarySoft)
                    .overlay(Circle().stroke(AthlyTheme.Color.primaryBorder, lineWidth: 1.5))
                    .clipShape(Circle())
                    .shadow(color: AthlyTheme.Color.primaryGlow, radius: 20)
                    .padding(.bottom, 18)

                Text("Sem meta definida")
                    .font(AthlyTheme.Typography.heading(16))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                    .padding(.bottom, 8)

                Text("Responda à avaliação para criarmos seu plano de treino personalizado com base no seu nível e objetivos.")
                    .font(AthlyTheme.Typography.medium(12))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 240)
                    .padding(.bottom, 24)

                Button {
                    showAssessment = true
                } label: {
                    HStack(spacing: 7) {
                        Text("Fazer Avaliação")
                        Image(systemName: "arrow.right")
                            .font(.system(size: 12, weight: .bold))
                    }
                    .font(AthlyTheme.Typography.heading(13))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 22)
                    .frame(height: 44)
                    .background(AthlyTheme.Gradient.brand)
                    .clipShape(Capsule())
                    .shadow(color: AthlyTheme.Color.primaryGlow, radius: 12)
                }
                .buttonStyle(.plain)

                Text("Leva apenas 2 minutos")
                    .font(AthlyTheme.Typography.medium(10))
                    .foregroundStyle(AthlyTheme.Color.textTertiary)
                    .padding(.top, 14)
            }
            .padding(.horizontal, AthlyTheme.Spacing.sm)

            Spacer()
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Trial banner

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

    // MARK: - Helpers

    private func tag(_ text: String, color: Color, bg: Color, border: Color) -> some View {
        Text(text)
            .font(.system(size: 8, weight: .bold))
            .textCase(.uppercase)
            .kerning(0.4)
            .foregroundStyle(color)
            .padding(.horizontal, 7)
            .padding(.vertical, 1)
            .background(bg)
            .overlay(Capsule().stroke(border, lineWidth: 1))
            .clipShape(Capsule())
    }

    private var weekDays: [Date] {
        (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: visibleWeekStart) }
    }

    private func workouts(on day: Date) -> [WorkoutModel] {
        planVM.allWorkouts
            .filter { $0.isOnDay(day) && $0.sportType != .other }
            .sorted { $0.parsedDate < $1.parsedDate }
    }

    private func dayID(_ day: Date) -> String {
        Self.idFormatter.string(from: day)
    }

    private func dayAbbr(_ day: Date) -> String {
        Self.weekdayFormatter.string(from: day)
    }

    private func dayHeaderLabel(_ day: Date) -> String {
        "\(dayAbbr(day)), \(calendar.component(.day, from: day)) \(Self.monthAbbrFormatter.string(from: day))"
    }

    private var monthLabel: String {
        Self.monthYearFormatter.string(from: visibleWeekStart).capitalized
    }

    static func weekStart(for date: Date) -> Date {
        var cal = Calendar.current
        cal.firstWeekday = 2
        return cal.dateInterval(of: .weekOfYear, for: date)?.start ?? cal.startOfDay(for: date)
    }

    private static let idFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private static let weekdayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "pt-BR")
        f.dateFormat = "EEE"
        return f
    }()

    private static let monthAbbrFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "pt-BR")
        f.dateFormat = "MMM"
        return f
    }()

    private static let monthYearFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "pt-BR")
        f.dateFormat = "MMMM yyyy"
        return f
    }()
}
