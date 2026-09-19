import SwiftUI

/// S2 · Folha de calendário para atribuir a corrida detectada a um treino planejado.
///
/// A faixa de semana é local a esta tela: `PlanView.weekStrip` é privado e acoplado à navegação
/// do Plano, e `CalendarDayCellView` recebe `day: Int` em vez de `Date` — nenhum dos dois é
/// reaproveitável aqui sem refatorar o Plano, o que está fora do escopo desta mudança.
struct DetectedRunLinkSheet: View {
    @ObservedObject var viewModel: DetectedRunViewModel

    @EnvironmentObject private var planVM: TrainingPlanViewModel
    @EnvironmentObject private var runStore: RunStore
    @Environment(\.dismiss) private var dismiss

    @State private var visibleWeekStart: Date

    init(viewModel: DetectedRunViewModel) {
        self.viewModel = viewModel
        _visibleWeekStart = State(initialValue: Self.weekStart(for: viewModel.selectedDay))
    }

    private static var calendar: Calendar {
        var cal = Calendar.current
        cal.firstWeekday = 2 // segunda-feira, como no Plano
        return cal
    }

    var body: some View {
        ZStack {
            AthlyTheme.Color.surfaceDark
                .ignoresSafeArea()

            VStack(spacing: 0) {
                headerBar
                weekNav
                weekStrip
                Divider()
                    .background(AthlyTheme.Color.borderDark)
                    .padding(.top, 8)
                workoutList
                footer
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    // MARK: - Header

    private var headerBar: some View {
        HStack {
            Text("Calendário")
                .font(AthlyTheme.Typography.heading(18))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Spacer()
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                    .frame(width: 28, height: 28)
                    .background(AthlyTheme.Color.backgroundAlt)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(AthlyTheme.Color.borderMid, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Text("Fechar"))
        }
        .padding(.horizontal, 18)
        .padding(.top, 12)
        .padding(.bottom, 8)
    }

    private var weekNav: some View {
        HStack {
            navButton(icon: "chevron.left") { shiftWeek(by: -1) }
                .accessibilityLabel(Text("Semana anterior"))
            Spacer()
            Text(weekLabel)
                .font(AthlyTheme.Typography.semibold(13))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Spacer()
            navButton(icon: "chevron.right") { shiftWeek(by: 1) }
                .accessibilityLabel(Text("Próxima semana"))
        }
        .padding(.horizontal, 18)
        .padding(.bottom, 12)
    }

    private func navButton(icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .frame(width: 28, height: 28)
                .background(AthlyTheme.Color.backgroundAlt)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(AthlyTheme.Color.borderMid, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Faixa da semana

    private var weekStrip: some View {
        let cal = Self.calendar
        let days = weekDays
        let marked = viewModel.daysWithWorkouts(from: planVM.allWorkouts, in: days)

        return HStack(spacing: 6) {
            ForEach(days, id: \.timeIntervalSince1970) { day in
                let isSelected = cal.isDate(day, inSameDayAs: viewModel.selectedDay)
                Button {
                    viewModel.selectedDay = cal.startOfDay(for: day)
                    viewModel.selectedWorkout = nil
                } label: {
                    VStack(spacing: 5) {
                        Text(weekdayLabel(day))
                            .font(AthlyTheme.Typography.semibold(8))
                            .textCase(.uppercase)
                            .foregroundStyle(isSelected ? AthlyTheme.Color.primary : AthlyTheme.Color.textTertiary)
                        Text("\(cal.component(.day, from: day))")
                            .font(AthlyTheme.Typography.mono(14))
                            .foregroundStyle(AthlyTheme.Color.textPrimary)
                        Circle()
                            .fill(marked.contains(cal.startOfDay(for: day))
                                  ? AthlyTheme.Color.primary
                                  : Color.clear)
                            .frame(width: 6, height: 6)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(isSelected ? AthlyTheme.Color.primarySoft : Color.clear)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(isSelected ? AthlyTheme.Color.primary : Color.clear, lineWidth: 1.5)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 14)
    }

    // MARK: - Treinos do dia

    private var workoutList: some View {
        let candidates = viewModel.candidateWorkouts(from: planVM.allWorkouts, on: viewModel.selectedDay)

        return ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text(selectedDayLabel)
                    .font(AthlyTheme.Typography.semibold(9))
                    .textCase(.uppercase)
                    .tracking(1)
                    .foregroundStyle(AthlyTheme.Color.textTertiary)
                    .padding(.top, 12)

                if candidates.isEmpty {
                    Text("Sem treino planejado neste dia")
                        .font(AthlyTheme.Typography.semibold(13))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                        .padding(.top, 4)
                    Text("Escolha outro dia na faixa acima para ver os treinos planejados.")
                        .font(AthlyTheme.Typography.body(11))
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                        .fixedSize(horizontal: false, vertical: true)
                } else {
                    ForEach(candidates) { workout in
                        planOptionRow(workout)
                    }
                }

                if let errorMessage = viewModel.errorMessage {
                    Text(errorMessage)
                        .font(AthlyTheme.Typography.body(12))
                        .foregroundStyle(AthlyTheme.Color.error)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 4)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, AthlyTheme.Spacing.sm)
        }
        .scrollContentBackground(.hidden)
    }

    private func planOptionRow(_ workout: WorkoutModel) -> some View {
        let isSelected = viewModel.selectedWorkout?.id == workout.id

        return Button {
            viewModel.selectedWorkout = workout
        } label: {
            HStack(spacing: 11) {
                RoundedRectangle(cornerRadius: 2, style: .continuous)
                    .fill(workout.accentColor)
                    .frame(width: 4, height: 34)

                VStack(alignment: .leading, spacing: 2) {
                    Text(workout.title)
                        .font(AthlyTheme.Typography.semibold(12))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    if let meta = workoutMeta(workout) {
                        Text(meta)
                            .font(AthlyTheme.Typography.mono(9))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                DetectedRunCheckCircle(isSelected: isSelected, size: 18)
            }
            .padding(11)
            .background(isSelected ? AthlyTheme.Color.primarySoft : AthlyTheme.Color.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                    .stroke(
                        isSelected ? AthlyTheme.Color.primary : AthlyTheme.Color.borderDark,
                        lineWidth: 1.5
                    )
            )
        }
        .buttonStyle(.plain)
    }

    private var footer: some View {
        Button {
            guard let workout = viewModel.selectedWorkout else { return }
            Task {
                _ = await viewModel.link(to: workout, planVM: planVM, runStore: runStore)
            }
        } label: {
            HStack(spacing: 7) {
                if viewModel.isSubmitting {
                    ProgressView().tint(.white).scaleEffect(0.85)
                }
                Text("Vincular treino")
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(AthlyGradientButtonStyle())
        .disabled(viewModel.selectedWorkout == nil || viewModel.isSubmitting)
        .padding(.horizontal, AthlyTheme.Spacing.sm)
        .padding(.vertical, 12)
    }

    // MARK: - Helpers de data

    private static func weekStart(for date: Date) -> Date {
        let cal = calendar
        let components = cal.dateComponents([.yearForWeekOfYear, .weekOfYear], from: date)
        return cal.date(from: components) ?? cal.startOfDay(for: date)
    }

    private var weekDays: [Date] {
        let cal = Self.calendar
        return (0..<7).compactMap { cal.date(byAdding: .day, value: $0, to: visibleWeekStart) }
    }

    private func shiftWeek(by delta: Int) {
        guard let next = Self.calendar.date(byAdding: .weekOfYear, value: delta, to: visibleWeekStart) else { return }
        visibleWeekStart = next
    }

    private func weekdayLabel(_ date: Date) -> String {
        let df = DateFormatter()
        df.locale = .current
        df.dateFormat = "EEE"
        return String(df.string(from: date).prefix(3))
    }

    /// "Setembro · 09–15"
    private var weekLabel: String {
        let cal = Self.calendar
        guard let last = cal.date(byAdding: .day, value: 6, to: visibleWeekStart) else { return "" }
        let month = DateFormatter()
        month.locale = .current
        month.setLocalizedDateFormatFromTemplate("MMMM")
        let first = cal.component(.day, from: visibleWeekStart)
        let lastDay = cal.component(.day, from: last)
        return "\(month.string(from: visibleWeekStart).capitalized) · \(String(format: "%02d", first))–\(String(format: "%02d", lastDay))"
    }

    private var selectedDayLabel: String {
        let df = DateFormatter()
        df.locale = .current
        df.setLocalizedDateFormatFromTemplate("EEEEdMMMM")
        return df.string(from: viewModel.selectedDay).capitalized
    }

    private func workoutMeta(_ workout: WorkoutModel) -> String? {
        var parts: [String] = []
        if let km = workout.totalDistanceKm {
            parts.append("\(LocalizedFormatting.formattedDistanceKm(km)) km")
        }
        if let minutes = workout.totalDurationMinutes {
            parts.append("\(minutes) min")
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}
