import SwiftUI

// MARK: - AthlyTheme

enum AthlyTheme {
    enum Color {
        // Brand — cyan primary, purple accent
        static let primary = SwiftUI.Color(hex: "#06b6d4")       // cyan
        static let primaryNeon = SwiftUI.Color(hex: "#00d4ff")    // cyan neon
        static let secondary = SwiftUI.Color(hex: "#9d25f4")      // purple (accent)
        static let secondaryNeon = SwiftUI.Color(hex: "#bf40ff")   // purple neon
        static let accent = SwiftUI.Color(hex: "#f472b6")        // pink

        // Backgrounds — neutral dark (remove purple tint)
        static let backgroundDark = SwiftUI.Color(hex: "#0a0a10")
        static let surfaceDark = SwiftUI.Color(hex: "#0d1117")
        static let surfaceCard = SwiftUI.Color(hex: "#141820")

        // Borders
        static let borderDark = SwiftUI.Color.white.opacity(0.1)

        // Glass — cyan tint
        static let glassBackground = SwiftUI.Color(hex: "#06b6d4").opacity(0.05)
        static let glassBorder = SwiftUI.Color.white.opacity(0.1)

        // Text
        static let textPrimary = SwiftUI.Color(hex: "#f9fafb")
        static let textSecondary = SwiftUI.Color(hex: "#d1d5db")
        static let textTertiary = SwiftUI.Color(hex: "#9ca3af")

        // Semantic
        static let success = SwiftUI.Color(hex: "#10b981")
        static let warning = SwiftUI.Color(hex: "#f59e0b")
        static let error = SwiftUI.Color(hex: "#ef4444")
    }

    enum Gradient {
        static let brand = LinearGradient(
            colors: [AthlyTheme.Color.primary, AthlyTheme.Color.secondary],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )

        static let neon = LinearGradient(
            colors: [AthlyTheme.Color.primaryNeon, AthlyTheme.Color.secondaryNeon],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )

        static let cardBackground = LinearGradient(
            colors: [AthlyTheme.Color.surfaceCard, AthlyTheme.Color.surfaceDark],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )

        static let gradientBorder = LinearGradient(
            colors: [AthlyTheme.Color.primary.opacity(0.3), AthlyTheme.Color.secondary.opacity(0.3)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )

        static let insightBackground = LinearGradient(
            colors: [
                AthlyTheme.Color.primary.opacity(0.2),
                AthlyTheme.Color.backgroundDark,
                AthlyTheme.Color.accent.opacity(0.2)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    enum Typography {
        static func heading(_ size: CGFloat) -> Font {
            .custom("SpaceGrotesk-Bold", size: size)
        }

        static func semibold(_ size: CGFloat) -> Font {
            .custom("SpaceGrotesk-SemiBold", size: size)
        }

        static func medium(_ size: CGFloat) -> Font {
            .custom("SpaceGrotesk-Medium", size: size)
        }

        static func body(_ size: CGFloat = 16) -> Font {
            .custom("SpaceGrotesk-Regular", size: size)
        }

        static func label() -> Font {
            .custom("SpaceGrotesk-SemiBold", size: 11)
        }
    }

    enum Spacing {
        static let sm: CGFloat = 16
        static let md: CGFloat = 24
        static let lg: CGFloat = 32
    }

    enum Radius {
        static let card: CGFloat = 24
        static let button: CGFloat = 16
        static let small: CGFloat = 12
    }

    enum Layout {
        static let floatingTabBarBottomPadding: CGFloat = 12
        static let floatingTabBarTopClearance: CGFloat = 64
        static let tabBarContentBottomClearance: CGFloat = 136
        static let fullScreenBottomActionPadding: CGFloat = 48
    }
}

// MARK: - Color(hex:) Extension

extension SwiftUI.Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - AthlyCard ViewModifier

struct AthlyCardModifier: ViewModifier {
    var glow: Bool = false

    func body(content: Content) -> some View {
        content
            .background(
                ZStack {
                    // Solid dark base
                    AthlyTheme.Color.surfaceCard
                    // Cyan gradient tint overlay
                    LinearGradient(
                        colors: [
                            AthlyTheme.Color.primary.opacity(0.12),
                            AthlyTheme.Color.secondary.opacity(0.04)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous)
                    .stroke(
                        glow
                            ? AnyShapeStyle(LinearGradient(
                                colors: [AthlyTheme.Color.primaryNeon, AthlyTheme.Color.secondaryNeon],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                              ))
                            : AnyShapeStyle(AthlyTheme.Gradient.gradientBorder),
                        lineWidth: glow ? 1.5 : 1
                    )
            )
            .shadow(
                color: glow
                    ? AthlyTheme.Color.primary.opacity(0.30)
                    : AthlyTheme.Color.primary.opacity(0.18),
                radius: glow ? 15 : 12,
                y: glow ? 6 : 3
            )
    }
}

// MARK: - AthlyInsightCard ViewModifier (AI / featured cards)

struct AthlyInsightCardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(
                ZStack {
                    AthlyTheme.Color.surfaceCard
                    AthlyTheme.Gradient.insightBackground
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous)
                    .stroke(AthlyTheme.Gradient.gradientBorder, lineWidth: 1.5)
            )
            .shadow(color: AthlyTheme.Color.primary.opacity(0.35), radius: 18, y: 5)
    }
}

struct AthlyTabBarContentClearanceModifier: ViewModifier {
    func body(content: Content) -> some View {
        content.safeAreaInset(edge: .bottom, spacing: 0) {
            Color.clear
                .frame(height: AthlyTheme.Layout.tabBarContentBottomClearance)
                .allowsHitTesting(false)
        }
    }
}

extension View {
    func athlyCard(glow: Bool = false) -> some View {
        modifier(AthlyCardModifier(glow: glow))
    }

    func athlyInsightCard() -> some View {
        modifier(AthlyInsightCardModifier())
    }

    func athlyTabBarContentClearance() -> some View {
        modifier(AthlyTabBarContentClearanceModifier())
    }
}
