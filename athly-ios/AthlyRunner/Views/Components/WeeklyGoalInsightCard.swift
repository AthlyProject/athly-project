import SwiftUI

/// Card que mostra o insight/meta gerado pela IA para a semana atual (metrics.fitnessInsights / trend).
struct WeeklyGoalInsightCard: View {
    let goal: WeeklyGoalResponse
    var weekNumber: Int? = nil

    var body: some View {
        guard let metrics = goal.metrics,
              let insights = metrics.fitnessInsights, !insights.isEmpty else {
            return AnyView(EmptyView())
        }

        return AnyView(
            VStack(alignment: .leading, spacing: 10) {
                Text(weekChipLabel)
                    .font(AthlyTheme.Typography.body(10))
                    .foregroundStyle(AthlyTheme.Color.textTertiary)

                HStack(spacing: 6) {
                    Image(systemName: "plus.circle")
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
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .stroke(AthlyTheme.Color.glassBorder, lineWidth: 1)
                    )
                }
            }
            .padding(AthlyTheme.Spacing.sm)
            .athlyInsightCard()
        )
    }

    private var weekChipLabel: String {
        let start = goal.parsedStartDate
        let end = goal.parsedEndDate
        let cal = Calendar.current

        let sameMonth = cal.component(.month, from: start) == cal.component(.month, from: end) &&
                        cal.component(.year, from: start) == cal.component(.year, from: end)

        let startDay = cal.component(.day, from: start)
        let endDay = cal.component(.day, from: end)

        let monthYearFmt = DateFormatter()
        monthYearFmt.locale = Locale(identifier: "pt_BR")

        let dateRange: String
        if sameMonth {
            monthYearFmt.dateFormat = "MMM yyyy"
            dateRange = "\(startDay)–\(endDay) \(monthYearFmt.string(from: end))"
        } else {
            let startFmt = DateFormatter()
            startFmt.locale = Locale(identifier: "pt_BR")
            startFmt.dateFormat = "d MMM"
            monthYearFmt.dateFormat = "d MMM yyyy"
            dateRange = "\(startFmt.string(from: start)) – \(monthYearFmt.string(from: end))"
        }

        if let n = weekNumber {
            return "Semana \(n) · \(dateRange)"
        }
        return dateRange
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
        .padding(.vertical, 8)
    }
}
