import SwiftUI

struct CalendarDayCellView: View {
    let day: Int
    let isToday: Bool
    let isInMonth: Bool
    let workouts: [WorkoutModel]
    var isSelected: Bool = false
    var onTap: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: 3) {
            ZStack {
                if isSelected {
                    Circle()
                        .fill(AthlyTheme.Color.primary.opacity(0.25))
                        .frame(width: 30, height: 30)
                }
                if isToday {
                    Circle()
                        .stroke(AthlyTheme.Color.primaryNeon, lineWidth: 2)
                        .frame(width: 30, height: 30)
                }
                Text("\(day)")
                    .font(.custom("SpaceGrotesk-\(isToday ? "Bold" : "Regular")", size: 13))
                    .foregroundStyle(
                        isSelected
                            ? AthlyTheme.Color.primary
                            : (isToday
                                ? AthlyTheme.Color.primaryNeon
                                : (isInMonth ? AthlyTheme.Color.textPrimary : AthlyTheme.Color.textTertiary))
                    )
            }
            .frame(width: 30, height: 30)

            // Workout dots
            if !workouts.isEmpty {
                HStack(spacing: 2) {
                    ForEach(workouts.prefix(3)) { workout in
                        Circle()
                            .fill(dotColor(for: workout))
                            .frame(width: 5, height: 5)
                    }
                }
            } else {
                Color.clear
                    .frame(width: 5, height: 5)
            }
        }
        .frame(maxWidth: .infinity)
        .contentShape(Rectangle())
        .onTapGesture {
            if !workouts.isEmpty { onTap?() }
        }
    }

    private func dotColor(for workout: WorkoutModel) -> Color {
        switch workout.status {
        case .done: return AthlyTheme.Color.success
        case .skipped: return AthlyTheme.Color.error
        case .partial: return AthlyTheme.Color.warning
        case .scheduled: return AthlyTheme.Color.primary
        }
    }
}
