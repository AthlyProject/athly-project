import SwiftUI

// Blocos compartilhados pelas três telas do fluxo de detecção.
// O `statCell` existe para não abrir uma quinta cópia da mesma célula de métrica
// (WorkoutDetailView, WorkoutCompletionSheet, TrainingPlanDetailView, DashboardView).

/// Célula de métrica com valor monoespaçado e rótulo em caixa alta.
struct DetectedRunStatCell: View {
    let value: String
    let unit: String?
    let key: LocalizedStringKey

    init(value: String, unit: String? = nil, key: LocalizedStringKey) {
        self.value = value
        self.unit = unit
        self.key = key
    }

    var body: some View {
        VStack(spacing: 3) {
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(value)
                    .font(AthlyTheme.Typography.mono(15))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                if let unit {
                    Text(unit)
                        .font(AthlyTheme.Typography.body(9))
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                }
            }
            .lineLimit(1)
            .minimumScaleFactor(0.7)

            Text(key)
                .font(AthlyTheme.Typography.body(9))
                .textCase(.uppercase)
                .tracking(0.5)
                .foregroundStyle(AthlyTheme.Color.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .padding(.horizontal, 4)
    }
}

/// Faixa horizontal de métricas com divisores, dentro de um card.
struct DetectedRunStatsRow<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        HStack(spacing: 0) {
            content
        }
        .background(AthlyTheme.Color.surfaceCard)
        .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                .stroke(AthlyTheme.Color.borderDark, lineWidth: 1)
        )
    }
}

struct DetectedRunStatDivider: View {
    var body: some View {
        Rectangle()
            .fill(AthlyTheme.Color.borderDark)
            .frame(width: 1, height: 34)
    }
}

/// Card de opção da pergunta "estava no plano?". `isSelectable` mostra o círculo de check;
/// caso contrário mostra o chevron de navegação (abre o calendário).
struct DetectedRunOptionCard: View {
    let systemImage: String
    let iconTint: Color
    let title: LocalizedStringKey
    let subtitle: LocalizedStringKey
    let isSelected: Bool
    let showsChevron: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(iconTint)
                    .frame(width: 44, height: 44)
                    .background(AthlyTheme.Color.backgroundAlt)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(AthlyTheme.Color.borderMid, lineWidth: 1)
                    )

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(AthlyTheme.Typography.semibold(13))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                    Text(subtitle)
                        .font(AthlyTheme.Typography.body(10))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                if showsChevron {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                } else {
                    DetectedRunCheckCircle(isSelected: isSelected, size: 20)
                }
            }
            .padding(12)
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
}

/// Círculo de seleção: vazio quando não selecionado, preenchido com um check branco quando sim.
struct DetectedRunCheckCircle: View {
    let isSelected: Bool
    var size: CGFloat = 20

    var body: some View {
        ZStack {
            Circle()
                .fill(isSelected ? AthlyTheme.Color.primary : Color.clear)
            Circle()
                .stroke(isSelected ? AthlyTheme.Color.primary : AthlyTheme.Color.borderMid, lineWidth: 1.5)
            if isSelected {
                Image(systemName: "checkmark")
                    .font(.system(size: size * 0.5, weight: .bold))
                    .foregroundStyle(Color.white)
            }
        }
        .frame(width: size, height: size)
        .animation(.easeOut(duration: 0.15), value: isSelected)
    }
}
