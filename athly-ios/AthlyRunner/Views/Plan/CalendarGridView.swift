import SwiftUI

struct CalendarGridView: View {
    let month: Date
    let workouts: [WorkoutModel]
    var weeklyGoals: [WeeklyGoalResponse] = []
    @Binding var selectedDate: Date?

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 0), count: 7)
    private let weekdaySymbols = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
    private let calendar = Calendar.current

    var body: some View {
        VStack(spacing: 8) {
            // Weekday headers
            HStack {
                ForEach(weekdaySymbols, id: \.self) { day in
                    Text(day)
                        .font(AthlyTheme.Typography.label())
                        .textCase(.uppercase)
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                        .frame(maxWidth: .infinity)
                }
            }

            // Week rows with optional goal banner
            let weeks = buildWeekRows()
            ForEach(weeks.indices, id: \.self) { weekIndex in
                let week = weeks[weekIndex]
                VStack(spacing: 4) {
                    // Goal banner if this week has a WeeklyGoal
                    if let goal = goalForWeek(startDate: week.first?.date ?? Date()) {
                        weekGoalBanner(goal)
                    }

                    // Day cells row
                    HStack(spacing: 0) {
                        ForEach(week, id: \.offset) { item in
                            let dayWorkouts = workoutsFor(date: item.date)
                            CalendarDayCellView(
                                day: item.day,
                                isToday: item.isToday,
                                isInMonth: item.isInMonth,
                                workouts: dayWorkouts,
                                isSelected: selectedDate.map { calendar.isDate($0, inSameDayAs: item.date) } ?? false,
                                onTap: {
                                    selectedDate = calendar.isDate(selectedDate ?? .distantPast, inSameDayAs: item.date)
                                        ? nil
                                        : item.date
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    // MARK: - Week Goal Banner

    private func weekGoalBanner(_ goal: WeeklyGoalResponse) -> some View {
        let insight = goal.metrics?.title ?? goal.metrics?.trend ?? "Meta da semana"
        let hasPrevious = goal.previousWeekAnalysis != nil

        return HStack(spacing: 6) {
            Image(systemName: "sparkles")
                .font(.system(size: 10))
                .foregroundStyle(AthlyTheme.Color.primary)

            Text(insight.isEmpty ? "Meta da semana" : insight)
                .font(AthlyTheme.Typography.body(11))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .lineLimit(1)
                .truncationMode(.tail)

            Spacer(minLength: 0)

            if hasPrevious, let rate = goal.previousWeekAnalysis?.completionRate {
                let pct = Int(rate * 100)
                let color: Color = rate >= 0.8 ? AthlyTheme.Color.success : (rate >= 0.5 ? AthlyTheme.Color.warning : AthlyTheme.Color.error)
                Text("↩ \(pct)%")
                    .font(AthlyTheme.Typography.semibold(10))
                    .foregroundStyle(color)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(AthlyTheme.Color.primary.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .stroke(AthlyTheme.Color.primary.opacity(0.2), lineWidth: 1)
        )
    }

    // MARK: - Helpers

    private struct DayItem {
        let offset: Int
        let day: Int
        let date: Date
        let isToday: Bool
        let isInMonth: Bool
    }

    private func buildWeekRows() -> [[DayItem]] {
        let allDays = gridDays()
        var rows: [[DayItem]] = []
        var i = 0
        while i < allDays.count {
            let row = Array(allDays[i..<min(i + 7, allDays.count)])
            rows.append(row)
            i += 7
        }
        return rows
    }

    private func gridDays() -> [DayItem] {
        let components = calendar.dateComponents([.year, .month], from: month)
        guard let firstOfMonth = calendar.date(from: components) else { return [] }

        let firstWeekday = (calendar.component(.weekday, from: firstOfMonth) - 1)
        let daysInMonth = calendar.range(of: .day, in: .month, for: firstOfMonth)?.count ?? 30

        var items: [DayItem] = []

        if firstWeekday > 0 {
            guard let prevMonth = calendar.date(byAdding: .month, value: -1, to: firstOfMonth) else { return [] }
            let daysInPrev = calendar.range(of: .day, in: .month, for: prevMonth)?.count ?? 30
            for i in (0..<firstWeekday).reversed() {
                let day = daysInPrev - i
                var comps = calendar.dateComponents([.year, .month], from: prevMonth)
                comps.day = day
                let date = calendar.date(from: comps) ?? prevMonth
                items.append(DayItem(offset: items.count, day: day, date: date, isToday: false, isInMonth: false))
            }
        }

        for day in 1...daysInMonth {
            var comps = components
            comps.day = day
            let date = calendar.date(from: comps) ?? firstOfMonth
            let isToday = calendar.isDateInToday(date)
            items.append(DayItem(offset: items.count, day: day, date: date, isToday: isToday, isInMonth: true))
        }

        let remaining = 42 - items.count
        if remaining > 0 {
            guard let nextMonth = calendar.date(byAdding: .month, value: 1, to: firstOfMonth) else { return items }
            for day in 1...remaining {
                var comps = calendar.dateComponents([.year, .month], from: nextMonth)
                comps.day = day
                let date = calendar.date(from: comps) ?? nextMonth
                items.append(DayItem(offset: items.count, day: day, date: date, isToday: false, isInMonth: false))
            }
        }

        return items
    }

    private func workoutsFor(date: Date) -> [WorkoutModel] {
        workouts.filter { calendar.isDate($0.parsedDate, inSameDayAs: date) && $0.sportType != .other }
    }

    private func goalForWeek(startDate: Date) -> WeeklyGoalResponse? {
        weeklyGoals.first { goal in
            // Check if startDate falls within the week's range
            let start = goal.parsedStartDate
            let end = goal.parsedEndDate
            return startDate >= start && startDate <= end
        }
    }
}
