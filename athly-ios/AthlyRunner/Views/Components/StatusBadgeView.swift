import SwiftUI

struct StatusBadgeView: View {
    let status: WorkoutStatus

    private var label: String {
        switch status {
        case .done: return "Concluído"
        case .scheduled: return "Agendado"
        case .partial: return "Parcial"
        case .skipped: return "Pulado"
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
