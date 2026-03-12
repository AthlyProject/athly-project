import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var locationManager: LocationManager
    @State private var selectedTab: AppTab = .dashboard

    var body: some View {
        Group {
            switch selectedTab {
            case .dashboard:
                DashboardView()
            case .plan:
                PlanView()
            case .run:
                RunStartView()
            case .history:
                HistoryView()
            case .profile:
                ProfileView()
            }
        }
        .safeAreaInset(edge: .bottom) {
            FloatingTabBar(selectedTab: $selectedTab)
                .padding(.bottom, 8)
        }
        .ignoresSafeArea(.keyboard)
    }
}
