import SwiftUI

// MARK: - AppTab

enum AppTab: String, CaseIterable {
    case dashboard
    case plan
    case run
    case history
    case profile

    var title: String {
        switch self {
        case .dashboard: return "Home"
        case .plan: return "Plan"
        case .run: return "Run"
        case .history: return "History"
        case .profile: return "Profile"
        }
    }

    var icon: String {
        switch self {
        case .dashboard: return "house.fill"
        case .plan: return "calendar"
        case .run: return "figure.run"
        case .history: return "clock.fill"
        case .profile: return "person.fill"
        }
    }
}

// MARK: - FloatingTabBar

struct FloatingTabBar: View {
    @Binding var selectedTab: AppTab

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.allCases, id: \.self) { tab in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selectedTab = tab
                    }
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: tab.icon)
                            .font(.system(size: tab == .run ? 22 : 18))
                            .foregroundStyle(
                                selectedTab == tab
                                    ? AthlyTheme.Color.primary
                                    : AthlyTheme.Color.textTertiary
                            )

                        Text(tab.title)
                            .font(AthlyTheme.Typography.label())
                            .foregroundStyle(
                                selectedTab == tab
                                    ? AthlyTheme.Color.primary
                                    : AthlyTheme.Color.textTertiary
                            )
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .padding(.vertical, 12)
        .background(AthlyTheme.Color.surfaceDark.opacity(0.95))
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(AthlyTheme.Color.glassBorder, lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.3), radius: 12, y: 4)
        .padding(.horizontal, 16)
    }
}
