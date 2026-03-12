import SwiftUI

struct SportBadgeView: View {
    let sport: SportType

    var body: some View {
        HStack(spacing: 6) {
            Text(sport.emoji)
                .font(.caption)
                .padding(5)
                .background(AthlyTheme.Color.primary.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))

            Text(sport.label)
                .font(AthlyTheme.Typography.medium(12))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(AthlyTheme.Color.glassBackground)
        .foregroundStyle(AthlyTheme.Color.primary)
        .clipShape(Capsule())
        .overlay(
            Capsule()
                .stroke(AthlyTheme.Color.primary.opacity(0.3), lineWidth: 1)
        )
    }
}
