import SwiftUI

struct GeneralProgressCard: View {
    let streak: Int
    let achievements: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            header
            metricsRow

            Rectangle()
                .fill(AthlyTheme.Color.glassBorder)
                .frame(height: 1)

            consistencySection
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyCard()
    }

    private var header: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(AthlyTheme.Color.primary.opacity(0.14))
                    .frame(width: 42, height: 42)
                Image(systemName: "figure.run.circle")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(AthlyTheme.Color.primary)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text("PROGRESSO GERAL")
                    .font(AthlyTheme.Typography.label())
                    .foregroundStyle(AthlyTheme.Color.primary)
                Text("Sua evolução acumulada")
                    .font(AthlyTheme.Typography.semibold(18))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
            }

            Spacer()
        }
    }

    private var metricsRow: some View {
        HStack(spacing: 16) {
            metricSummary(
                icon: "flame.fill",
                value: "\(streak)",
                label: streak == 1 ? "treino em sequência" : "treinos em sequência",
                tint: AthlyTheme.Color.warning
            )

            Rectangle()
                .fill(AthlyTheme.Color.glassBorder)
                .frame(width: 1, height: 44)

            metricSummary(
                icon: "trophy.fill",
                value: "\(achievements)",
                label: achievements == 1 ? "conquista" : "conquistas",
                tint: AthlyTheme.Color.secondary
            )
        }
    }

    private func metricSummary(icon: String, value: String, label: String, tint: Color) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 26)

            VStack(alignment: .leading, spacing: 2) {
                Text(value)
                    .font(AthlyTheme.Typography.heading(24).monospacedDigit())
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                Text(label)
                    .font(AthlyTheme.Typography.body(12))
                    .foregroundStyle(AthlyTheme.Color.textTertiary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var consistencySection: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Circle()
                    .fill(AthlyTheme.Color.success.opacity(0.14))
                    .frame(width: 38, height: 38)
                Image(systemName: "checkmark.shield.fill")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(AthlyTheme.Color.success)
            }

            VStack(alignment: .leading, spacing: 5) {
                Text("CONSISTÊNCIA")
                    .font(AthlyTheme.Typography.label())
                    .foregroundStyle(AthlyTheme.Color.textTertiary)
                Text("Progresso sem pressa")
                    .font(AthlyTheme.Typography.semibold(16))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                Text("Base forte vem de repetir bons treinos, respeitar os dias leves e chegar inteiro nos treinos-chave.")
                    .font(AthlyTheme.Typography.body(13))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 0)
        }
    }
}
