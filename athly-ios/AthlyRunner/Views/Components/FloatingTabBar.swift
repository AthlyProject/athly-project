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
        case .plan:      return "Plan"
        case .run:       return "Run"
        case .history:   return "History"
        case .profile:   return "Profile"
        }
    }

    var icon: String {
        switch self {
        case .dashboard: return "house.fill"
        case .plan:      return "calendar"
        case .run:       return "figure.run"
        case .history:   return "clock.fill"
        case .profile:   return "person.fill"
        }
    }
}

// MARK: - FloatingTabBar

struct FloatingTabBar: View {
    @Binding var selectedTab: AppTab

    var body: some View {
        HStack(spacing: 3) {
            ForEach(AppTab.allCases, id: \.self) { tab in
                let isActive = selectedTab == tab
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selectedTab = tab
                    }
                } label: {
                    VStack(spacing: 3) {
                        Image(systemName: tab.icon)
                            .font(.system(size: tab == .run ? 20 : 17))
                            .foregroundStyle(isActive ? AthlyTheme.Color.primary : AthlyTheme.Color.textTertiary)

                        Text(tab.title)
                            .font(AthlyTheme.Typography.label())
                            .foregroundStyle(isActive ? AthlyTheme.Color.primary : AthlyTheme.Color.textTertiary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .padding(.horizontal, 4)
                    .background(
                        isActive
                            ? AthlyTheme.Color.primarySoft
                            : Color.clear
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .animation(.easeInOut(duration: 0.18), value: isActive)
                }
            }
        }
        .padding(7)
        .background(
            ZStack {
                Color(hex: "#0D1321").opacity(0.95)
                Color.black.opacity(0.05)
            }
        )
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(AthlyTheme.Color.borderMid, lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.35), radius: 14, y: 5)
        .padding(.horizontal, 16)
    }
}
