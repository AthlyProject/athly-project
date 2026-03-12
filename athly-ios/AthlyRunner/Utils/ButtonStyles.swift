import SwiftUI

// MARK: - Primary Button Style (solid purple)

struct AthlyPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AthlyTheme.Typography.semibold(16))
            .frame(maxWidth: .infinity)
            .padding()
            .background(AthlyTheme.Color.primary.opacity(configuration.isPressed ? 0.8 : 1))
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

// MARK: - Gradient Button Style (purple → cyan)

struct AthlyGradientButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AthlyTheme.Typography.semibold(16))
            .frame(maxWidth: .infinity)
            .padding()
            .background(AthlyTheme.Gradient.brand)
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
            .shadow(color: AthlyTheme.Color.primary.opacity(configuration.isPressed ? 0.2 : 0.5), radius: 12, y: 4)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

// MARK: - Secondary Button Style (glass)

struct AthlySecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AthlyTheme.Typography.semibold(16))
            .frame(maxWidth: .infinity)
            .padding()
            .background(AthlyTheme.Color.surfaceCard)
            .foregroundStyle(AthlyTheme.Color.textPrimary)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                    .stroke(AthlyTheme.Gradient.gradientBorder, lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.8 : 1)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

// MARK: - Danger Button Style (red)

struct AthlyDangerButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AthlyTheme.Typography.semibold(16))
            .frame(maxWidth: .infinity)
            .padding()
            .background(AthlyTheme.Color.error.opacity(configuration.isPressed ? 0.8 : 1))
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}
