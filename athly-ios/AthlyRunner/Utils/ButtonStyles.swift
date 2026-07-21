import SwiftUI

// MARK: - Primary Button Style (gradient + glow — main CTA)

struct AthlyPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AthlyTheme.Typography.semibold(16))
            .frame(maxWidth: .infinity)
            .padding()
            .background(AthlyTheme.Gradient.brand)
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
            .shadow(
                color: AthlyTheme.Color.primary.opacity(configuration.isPressed ? 0.15 : 0.30),
                radius: configuration.isPressed ? 8 : 16,
                y: 4
            )
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.14), value: configuration.isPressed)
    }
}

// MARK: - Gradient Button Style (alias — same as primary)

struct AthlyGradientButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AthlyTheme.Typography.semibold(16))
            .frame(maxWidth: .infinity)
            .padding()
            .background(AthlyTheme.Gradient.brand)
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
            .shadow(
                color: AthlyTheme.Color.primary.opacity(configuration.isPressed ? 0.15 : 0.30),
                radius: configuration.isPressed ? 8 : 16,
                y: 4
            )
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.14), value: configuration.isPressed)
    }
}

// MARK: - Secondary Button Style (primary-soft fill + primary border)

struct AthlySecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AthlyTheme.Typography.semibold(16))
            .frame(maxWidth: .infinity)
            .padding()
            .background(AthlyTheme.Color.primarySoft)
            .foregroundStyle(AthlyTheme.Color.primary)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                    .stroke(AthlyTheme.Color.primaryBorder, lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.80 : 1)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.14), value: configuration.isPressed)
    }
}

// MARK: - Ghost Button Style (transparent + border-mid + secondary text)

struct AthlyGhostButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AthlyTheme.Typography.semibold(16))
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color.clear)
            .foregroundStyle(AthlyTheme.Color.textSecondary)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                    .stroke(AthlyTheme.Color.borderMid, lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.75 : 1)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.14), value: configuration.isPressed)
    }
}

// MARK: - Danger Button Style

struct AthlyDangerButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AthlyTheme.Typography.semibold(16))
            .frame(maxWidth: .infinity)
            .padding()
            .background(AthlyTheme.Color.error.opacity(0.12))
            .foregroundStyle(AthlyTheme.Color.error)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                    .stroke(AthlyTheme.Color.error.opacity(0.25), lineWidth: 1)
            )
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.14), value: configuration.isPressed)
    }
}
