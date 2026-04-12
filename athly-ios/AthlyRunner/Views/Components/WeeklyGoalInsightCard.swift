import SwiftUI

/// Card que mostra o insight/meta gerado pela IA para a semana atual (metrics.fitnessInsights / trend).
struct WeeklyGoalInsightCard: View {
    let goal: WeeklyGoalResponse

    var body: some View {
        guard let metrics = goal.metrics,
              let insights = metrics.fitnessInsights, !insights.isEmpty else {
            return AnyView(EmptyView())
        }

        return AnyView(
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 6) {
                    Image(systemName: "target")
                        .font(.caption)
                        .foregroundStyle(AthlyTheme.Color.primary)
                    Text("Meta da Semana")
                        .font(AthlyTheme.Typography.semibold(15))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                    Spacer()
                    if let trend = metrics.trend, !trend.isEmpty {
                        trendBadge(trend)
                    }
                }

                Text(insights)
                    .font(AthlyTheme.Typography.body(14))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .lineLimit(4)

                if let pace = metrics.avgPace, let dist = metrics.totalDistanceKm {
                    HStack(spacing: 0) {
                        metricChip(label: "Vol. alvo", value: String(format: "%.1f km", dist))
                        Rectangle()
                            .fill(AthlyTheme.Color.glassBorder)
                            .frame(width: 1, height: 28)
                        metricChip(label: "Pace ref.", value: pace)
                        if let runs = metrics.runsAnalyzed {
                            Rectangle()
                                .fill(AthlyTheme.Color.glassBorder)
                                .frame(width: 1, height: 28)
                            metricChip(label: "Corridas anal.", value: "\(runs)")
                        }
                    }
                }
            }
            .padding(AthlyTheme.Spacing.sm)
            .athlyInsightCard()
        )
    }

    private func trendBadge(_ trend: String) -> some View {
        let (label, color) = trendInfo(trend)
        return Text(label)
            .font(AthlyTheme.Typography.semibold(11))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15))
            .clipShape(Capsule())
    }

    private func trendInfo(_ trend: String) -> (String, Color) {
        switch trend.lowercased() {
        case let t where t.contains("improving"):
            return ("Em alta", AthlyTheme.Color.success)
        case "maintaining":
            return ("Estável", AthlyTheme.Color.primary)
        case "declining":
            return ("Em baixa", AthlyTheme.Color.warning)
        default:
            return (trend, AthlyTheme.Color.textSecondary)
        }
    }

    private func metricChip(label: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(AthlyTheme.Typography.semibold(13))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Text(label)
                .font(AthlyTheme.Typography.body(10))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }
}

/// Card que mostra o feedback da semana anterior (previousWeekAnalysis).
struct PreviousWeekFeedbackCard: View {
    let goal: WeeklyGoalResponse

    var body: some View {
        guard let pwa = goal.previousWeekAnalysis else {
            return AnyView(EmptyView())
        }

        return AnyView(
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 6) {
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.caption)
                        .foregroundStyle(AthlyTheme.Color.secondary)
                    Text("Semana Anterior")
                        .font(AthlyTheme.Typography.semibold(15))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                    Spacer()
                    if let rate = pwa.completionRate {
                        completionBadge(rate)
                    }
                }

                if let note = pwa.adherenceNote, !note.isEmpty {
                    Text(note)
                        .font(AthlyTheme.Typography.body(14))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .lineLimit(4)
                }

                HStack(spacing: 0) {
                    if let completed = pwa.completedWorkouts, let total = pwa.totalWorkouts {
                        metricChip(label: "Treinos", value: "\(completed)/\(total)")
                        Rectangle()
                            .fill(AthlyTheme.Color.glassBorder)
                            .frame(width: 1, height: 28)
                    }
                    if let dist = pwa.totalDistanceKm {
                        metricChip(label: "Distância", value: String(format: "%.1f km", dist))
                    }
                    if let volume = pwa.volumeChange, !volume.isEmpty {
                        Rectangle()
                            .fill(AthlyTheme.Color.glassBorder)
                            .frame(width: 1, height: 28)
                        metricChip(label: "Volume", value: volumeLabel(volume))
                    }
                }
            }
            .padding(AthlyTheme.Spacing.sm)
            .background(
                ZStack {
                    AthlyTheme.Color.surfaceCard
                    LinearGradient(
                        colors: [AthlyTheme.Color.secondary.opacity(0.08), Color.clear],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous)
                    .stroke(AthlyTheme.Color.secondary.opacity(0.25), lineWidth: 1)
            )
        )
    }

    private func completionBadge(_ rate: Double) -> some View {
        let pct = Int(rate * 100)
        let color: Color = rate >= 0.8 ? AthlyTheme.Color.success : (rate >= 0.5 ? AthlyTheme.Color.warning : AthlyTheme.Color.error)
        return Text("\(pct)%")
            .font(AthlyTheme.Typography.semibold(11))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15))
            .clipShape(Capsule())
    }

    private func volumeLabel(_ volume: String) -> String {
        switch volume.lowercased() {
        case "increase": return "↑ Mais"
        case "decrease": return "↓ Menos"
        case "maintain": return "= Igual"
        default: return volume
        }
    }

    private func metricChip(label: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(AthlyTheme.Typography.semibold(13))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Text(label)
                .font(AthlyTheme.Typography.body(10))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }
}
