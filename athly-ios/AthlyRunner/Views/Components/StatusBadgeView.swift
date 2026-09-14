import SwiftUI

struct StatusBadgeView: View {
    let status: WorkoutStatus

    private var label: String {
        switch status {
        case .done: return String(localized: "Concluído")
        case .scheduled: return String(localized: "Agendado")
        case .partial: return String(localized: "Parcial")
        case .skipped: return String(localized: "Pulado")
        }
    }

    private var color: Color {
        switch status {
        case .done: return AthlyTheme.Color.success
        case .scheduled: return AthlyTheme.Color.primary
        case .partial: return AthlyTheme.Color.warning
        case .skipped: return AthlyTheme.Color.error
        }
    }

    var body: some View {
        Text(label)
            .font(AthlyTheme.Typography.label())
            .textCase(.uppercase)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15))
            .foregroundStyle(color)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(color.opacity(0.4), lineWidth: 1)
            )
    }
}
