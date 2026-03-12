import SwiftUI

// MARK: - Athly Glass Text Field Style

struct AthlyTextFieldStyle: TextFieldStyle {
    @FocusState private var isFocused: Bool

    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .focused($isFocused)
            .font(AthlyTheme.Typography.body())
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(AthlyTheme.Color.surfaceCard)
            .foregroundStyle(AthlyTheme.Color.textPrimary)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous)
                    .stroke(
                        isFocused ? AthlyTheme.Color.primary : AthlyTheme.Color.glassBorder,
                        lineWidth: isFocused ? 1.5 : 1
                    )
            )
            .tint(AthlyTheme.Color.primary)
    }
}
