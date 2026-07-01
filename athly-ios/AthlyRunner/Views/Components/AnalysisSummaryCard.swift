import SwiftUI

struct AnalysisSummaryCard: View {
    let analysis: RunAnalysis
    var previousWeekAnalysis: PreviousWeekAnalysis?
    var isInteractive: Bool = false

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

            if let previousWeekAnalysis {
                Rectangle()
                    .fill(AthlyTheme.Color.glassBorder)
                    .frame(height: 1)

                VStack(alignment: .leading, spacing: 10) {
                    Text("SEMANA ANTERIOR")
                        .font(AthlyTheme.Typography.label())
                        .foregroundStyle(AthlyTheme.Color.textTertiary)

                    HStack(spacing: 0) {
                        metricChip(label: "Treinos", value: previousWeekWorkouts(previousWeekAnalysis))
                        Rectangle()
                            .fill(AthlyTheme.Color.glassBorder)
                            .frame(width: 1, height: 32)
                        metricChip(label: "Distância", value: previousWeekDistance(previousWeekAnalysis))
                        Rectangle()
                            .fill(AthlyTheme.Color.glassBorder)
                            .frame(width: 1, height: 32)
                        metricChip(label: "Volume", value: previousWeekVolume(previousWeekAnalysis))
                    }
                }
            }

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

            if isInteractive {
                HStack(spacing: 6) {
                    Text("Toque para ver o resumo completo")
                        .font(AthlyTheme.Typography.body(12))
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(AthlyTheme.Color.primary)
                }
                .padding(.top, 2)
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

    private func previousWeekWorkouts(_ analysis: PreviousWeekAnalysis) -> String {
        guard let completed = analysis.completedWorkouts,
              let total = analysis.totalWorkouts else { return "-" }
        return "\(completed)/\(total)"
    }

    private func previousWeekDistance(_ analysis: PreviousWeekAnalysis) -> String {
        guard let distance = analysis.totalDistanceKm else { return "-" }
        return String(format: "%.1f km", distance)
    }

    private func previousWeekVolume(_ analysis: PreviousWeekAnalysis) -> String {
        guard let volume = analysis.volumeChange, !volume.isEmpty else { return "-" }
        return volumeLabel(volume)
    }

    private func volumeLabel(_ volume: String) -> String {
        switch volume.lowercased() {
        case "increase": return "Mais"
        case "decrease": return "Menos"
        case "maintain": return "Igual"
        default: return volume
        }
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

struct AnalysisSummarySheet: View {
    let analysis: RunAnalysis

    @Environment(\.dismiss) private var dismiss

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                AthlyTheme.Color.backgroundDark
                    .ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: AthlyTheme.Spacing.sm) {
                        summarySection
                        metricsSection
                    }
                    .padding(AthlyTheme.Spacing.sm)
                }
            }
            .navigationTitle("Resumo da IA")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fechar") {
                        dismiss()
                    }
                    .foregroundStyle(AthlyTheme.Color.primary)
                }
            }
        }
    }

    private var summarySection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Leitura da Athly")
                        .font(AthlyTheme.Typography.semibold(18))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)

                    Text("Resumo detalhado da análise feita a partir dos seus treinos recentes.")
                        .font(AthlyTheme.Typography.body(13))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }

                Spacer()

                if !analysis.trend.isEmpty {
                    trendBadge
                }
            }

            Text(analysis.fitnessInsights)
                .font(AthlyTheme.Typography.body(15))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyInsightCard()
    }

    private var metricsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "list.bullet.rectangle.portrait")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AthlyTheme.Color.secondary)
                Text("Sumário da análise")
                    .font(AthlyTheme.Typography.semibold(16))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
            }

            LazyVGrid(columns: columns, spacing: 12) {
                summaryMetricCard(label: "Período analisado", value: analysis.period)
                summaryMetricCard(label: "Corridas analisadas", value: "\(analysis.runsAnalyzed)")
                summaryMetricCard(label: "Distância média", value: String(format: "%.1f km", analysis.avgDistanceKm))
                summaryMetricCard(label: "Distância total", value: String(format: "%.1f km", analysis.totalDistanceKm))
                summaryMetricCard(label: "Pace médio", value: analysis.avgPace)

                if let avgHeartRate = analysis.avgHeartRate, avgHeartRate > 0 {
                    summaryMetricCard(label: "FC média", value: "\(Int(avgHeartRate.rounded())) bpm")
                }
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyCard()
    }

    private var trendBadge: some View {
        Text(trendLabel(analysis.trend))
            .font(AthlyTheme.Typography.semibold(12))
            .foregroundStyle(AthlyTheme.Color.primary)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(AthlyTheme.Color.primary.opacity(0.14))
            .clipShape(Capsule())
    }

    private func summaryMetricCard(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(AthlyTheme.Typography.body(11))
                .foregroundStyle(AthlyTheme.Color.textTertiary)

            Text(value)
                .font(AthlyTheme.Typography.semibold(15))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(AthlyTheme.Color.surfaceDark)
        .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous)
                .stroke(AthlyTheme.Color.glassBorder, lineWidth: 1)
        )
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
