import SwiftUI

// MARK: - AthlyTheme v2

enum AthlyTheme {
    enum Color {
        // Brand — sky-blue primary, violet accent
        static let primary          = SwiftUI.Color(hex: "#0EA5E9")
        static let primarySoft      = SwiftUI.Color(hex: "#0EA5E9").opacity(0.10)
        static let primaryBorder    = SwiftUI.Color(hex: "#0EA5E9").opacity(0.22)
        static let primaryGlow      = SwiftUI.Color(hex: "#0EA5E9").opacity(0.18)
        static let secondary        = SwiftUI.Color(hex: "#7C3AED")
        static let secondarySoft    = SwiftUI.Color(hex: "#7C3AED").opacity(0.10)
        static let secondaryBorder  = SwiftUI.Color(hex: "#7C3AED").opacity(0.20)
        static let accent           = SwiftUI.Color(hex: "#EC4899")

        // Backgrounds
        static let backgroundDark       = SwiftUI.Color(hex: "#060810")
        static let backgroundAlt        = SwiftUI.Color(hex: "#0B0F1C")
        static let surfaceDark          = SwiftUI.Color(hex: "#0F1624")
        static let surfaceCard          = SwiftUI.Color(hex: "#141E30")
        static let surfaceCardElevated  = SwiftUI.Color(hex: "#1A2540")

        // Borders
        static let borderDark   = SwiftUI.Color.white.opacity(0.06)
        static let borderMid    = SwiftUI.Color.white.opacity(0.10)
        // legacy alias used across views
        static var glassBorder: SwiftUI.Color { borderMid }
        static var glassBackground: SwiftUI.Color { primarySoft }

        // Text
        static let textPrimary      = SwiftUI.Color(hex: "#EEF2FF")
        static let textSecondary    = SwiftUI.Color(hex: "#94A3B8")
        static let textTertiary     = SwiftUI.Color(hex: "#4B5563")

        // Semantic
        static let success  = SwiftUI.Color(hex: "#10B981")
        static let warning  = SwiftUI.Color(hex: "#F59E0B")
        static let error    = SwiftUI.Color(hex: "#EF4444")
    }

    enum Gradient {
        // Brand gradient: sky-blue → violet (135°)
        static let brand = LinearGradient(
            colors: [AthlyTheme.Color.primary, AthlyTheme.Color.secondary],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )

        // Subtle surface overlay used on standard cards
        static let soft = LinearGradient(
            colors: [
                AthlyTheme.Color.primary.opacity(0.07),
                AthlyTheme.Color.secondary.opacity(0.04)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )

        // Stronger gradient overlay for insight / AI cards
        static let insightBackground = LinearGradient(
            colors: [
                AthlyTheme.Color.primary.opacity(0.09),
                SwiftUI.Color.black.opacity(0),
                AthlyTheme.Color.secondary.opacity(0.06)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )

        static let cardBackground = LinearGradient(
            colors: [AthlyTheme.Color.surfaceCard, AthlyTheme.Color.surfaceDark],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )

        // Solid-ish border color (used where a ShapeStyle is needed)
        static let gradientBorder = LinearGradient(
            colors: [
                AthlyTheme.Color.primaryBorder,
                AthlyTheme.Color.secondaryBorder
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

        static func mono(_ size: CGFloat) -> Font {
            .custom("JetBrainsMono-SemiBold", size: size)
        }
    }

    enum Spacing {
        static let sm: CGFloat = 16
        static let md: CGFloat = 24
        static let lg: CGFloat = 32
    }

    enum Radius {
        static let small:  CGFloat = 10
        static let button: CGFloat = 14
        static let card:   CGFloat = 20
        static let xl:     CGFloat = 28
    }

    enum Layout {
        static let floatingTabBarBottomPadding:   CGFloat = 12
        static let floatingTabBarTopClearance:     CGFloat = 64
        static let tabBarContentBottomClearance:   CGFloat = 136
        static let fullScreenBottomActionPadding:  CGFloat = 48
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
        case 3:  (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:  (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:  (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default: (a, r, g, b) = (255, 0, 0, 0)
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
// v2: solid 1px border at primary.opacity(0.22); soft gradient overlay; no heavy glow on standard cards.

struct AthlyCardModifier: ViewModifier {
    var glow: Bool = false

    func body(content: Content) -> some View {
        content
            .background(
                ZStack {
                    AthlyTheme.Color.surfaceCard
                    AthlyTheme.Gradient.soft
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous)
                    .stroke(
                        glow
                            ? AnyShapeStyle(AthlyTheme.Color.primary.opacity(0.40))
                            : AnyShapeStyle(AthlyTheme.Color.primaryBorder),
                        lineWidth: 1
                    )
            )
            .shadow(
                color: glow
                    ? AthlyTheme.Color.primary.opacity(0.28)
                    : SwiftUI.Color.black.opacity(0.25),
                radius: glow ? 18 : 8,
                y: glow ? 6 : 2
            )
    }
}

// MARK: - AthlyInsightCard ViewModifier
// v2: stronger primary border + blue ambient glow — reserved for AI/progress featured cards.

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
                    .stroke(AthlyTheme.Color.primary.opacity(0.30), lineWidth: 1)
            )
            .shadow(color: AthlyTheme.Color.primary.opacity(0.12), radius: 24, y: 4)
    }
}

struct AthlyTabBarContentClearanceModifier: ViewModifier {
    func body(content: Content) -> some View {
        content.safeAreaInset(edge: .bottom, spacing: 0) {
            SwiftUI.Color.clear
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
