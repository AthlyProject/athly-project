import SwiftUI

// MARK: - Athly Text Field Style (v2)

struct AthlyTextFieldStyle: TextFieldStyle {
    @FocusState private var isFocused: Bool

    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .focused($isFocused)
            .font(AthlyTheme.Typography.body())
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(AthlyTheme.Color.surfaceDark)
            .foregroundStyle(AthlyTheme.Color.textPrimary)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous)
                    .stroke(
                        isFocused ? AthlyTheme.Color.primary : AthlyTheme.Color.borderMid,
                        lineWidth: isFocused ? 1.5 : 1
                    )
                    .shadow(
                        color: isFocused ? AthlyTheme.Color.primary.opacity(0.15) : .clear,
                        radius: 6
                    )
            )
            .tint(AthlyTheme.Color.primary)
    }
}
