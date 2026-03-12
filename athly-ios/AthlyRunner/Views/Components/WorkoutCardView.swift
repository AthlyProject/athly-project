import SwiftUI

struct WorkoutCardView: View {
    let workout: WorkoutModel
    var compact: Bool = false
    var isNext: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: compact ? 8 : 12) {
            // Header row
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    SportBadgeView(sport: workout.sportType)
                    Text(workout.title)
                        .font(compact ? AthlyTheme.Typography.body(15) : AthlyTheme.Typography.semibold(17))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                        .lineLimit(2)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    StatusBadgeView(status: workout.status)
                    if isNext {
                        Text("Próximo treino")
                            .font(AthlyTheme.Typography.label())
                            .textCase(.uppercase)
                            .foregroundStyle(AthlyTheme.Color.primaryNeon)
                    }
                }
            }

            // Description
            if !compact, let desc = workout.description, !desc.isEmpty {
                Text(desc)
                    .font(AthlyTheme.Typography.body(15))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                    .lineLimit(3)
            }

            // Footer row
            HStack(spacing: 12) {
                // Date
                Label(workout.parsedDate.formatted(date: .abbreviated, time: .omitted),
                      systemImage: "calendar")
                    .font(AthlyTheme.Typography.body(12))
                    .foregroundStyle(AthlyTheme.Color.textTertiary)

                // Intensity
                if let intensity = workout.intensity {
                    Label("Intensidade \(intensity)", systemImage: "bolt.fill")
                        .font(AthlyTheme.Typography.body(12))
                        .foregroundStyle(intensityColor(intensity))
                }

                Spacer()

                // Origin badge
                if workout.stravaActivityId != nil {
                    Text("Strava")
                        .font(AthlyTheme.Typography.label())
                        .foregroundStyle(Color(hex: "#FC4C02"))
                } else if workout.trainingPlanId != nil {
                    Label("IA", systemImage: "sparkles")
                        .font(AthlyTheme.Typography.label())
                        .foregroundStyle(AthlyTheme.Color.secondary)
                }
            }
        }
        .padding(compact ? 12 : 16)
        .athlyCard(glow: isNext)
    }

    private func intensityColor(_ value: Int) -> Color {
        switch value {
        case 1...3: return AthlyTheme.Color.success
        case 4...6: return AthlyTheme.Color.warning
        default: return AthlyTheme.Color.error
        }
    }
}
