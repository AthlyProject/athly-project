import SwiftUI

struct CalendarGridView: View {
    let month: Date
    let workouts: [WorkoutModel]

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

            // Day grid
            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(gridDays(), id: \.offset) { item in
                    CalendarDayCellView(
                        day: item.day,
                        isToday: item.isToday,
                        isInMonth: item.isInMonth,
                        workouts: workoutsFor(date: item.date)
                    )
                }
            }
        }
    }

    // MARK: - Helpers

    private struct DayItem {
        let offset: Int
        let day: Int
        let date: Date
        let isToday: Bool
        let isInMonth: Bool
    }

    private func gridDays() -> [DayItem] {
        let components = calendar.dateComponents([.year, .month], from: month)
        guard let firstOfMonth = calendar.date(from: components) else { return [] }

        // First weekday (0=Sun ... 6=Sat)
        let firstWeekday = (calendar.component(.weekday, from: firstOfMonth) - 1)
        let daysInMonth = calendar.range(of: .day, in: .month, for: firstOfMonth)?.count ?? 30

        var items: [DayItem] = []

        // Preceding days from previous month
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

        // Current month days
        for day in 1...daysInMonth {
            var comps = components
            comps.day = day
            let date = calendar.date(from: comps) ?? firstOfMonth
            let isToday = calendar.isDateInToday(date)
            items.append(DayItem(offset: items.count, day: day, date: date, isToday: isToday, isInMonth: true))
        }

        // Trailing days from next month
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
        workouts.filter { calendar.isDate($0.parsedDate, inSameDayAs: date) }
    }
}
