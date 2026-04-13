import SwiftUI

struct AnalysisSummaryCard: View {
    let analysis: RunAnalysis

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Image(systemName: "sparkles")
                    .font(.caption)
                    .foregroundStyle(AthlyTheme.Color.primary)
                Text("Análise dos seus treinos")
                    .font(AthlyTheme.Typography.semibold(17))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
            }

            Text(analysis.fitnessInsights)
                .font(AthlyTheme.Typography.body(15))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
                .lineLimit(4)

            HStack(spacing: 0) {
                metricChip(label: "Período", value: analysis.period)
                Rectangle()
                    .fill(AthlyTheme.Color.glassBorder)
                    .frame(width: 1, height: 32)
                metricChip(label: "Corridas", value: "\(analysis.runsAnalyzed)")
                Rectangle()
                    .fill(AthlyTheme.Color.glassBorder)
                    .frame(width: 1, height: 32)
                metricChip(label: "Média", value: String(format: "%.1f km", analysis.avgDistanceKm))
                Rectangle()
                    .fill(AthlyTheme.Color.glassBorder)
                    .frame(width: 1, height: 32)
                metricChip(label: "Pace", value: analysis.avgPace)
            }
            .padding(.vertical, 4)

            if !analysis.trend.isEmpty {
                HStack(spacing: 4) {
                    Text("Tendência:")
                        .font(AthlyTheme.Typography.body(12))
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                    Text(trendLabel(analysis.trend))
                        .font(AthlyTheme.Typography.semibold(12))
                        .foregroundStyle(AthlyTheme.Color.primary)
                }
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyInsightCard()
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

    private func trendLabel(_ trend: String) -> String {
        switch trend.lowercased() {
        case "improving (volume)": return "Em alta (volume)"
        case "improving (intensity)": return "Em alta (intensidade)"
        case "maintaining": return "Estável"
        case "declining": return "Em baixa"
        default: return trend
        }
    }
}
