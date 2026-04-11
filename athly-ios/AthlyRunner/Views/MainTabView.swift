import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var locationManager: LocationManager
    @State private var selectedTab: AppTab = .dashboard
    @State private var isRunInProgress = false
    @State private var pendingWorkoutId: String?

    var body: some View {
        Group {
            switch selectedTab {
            case .dashboard:
                DashboardView(selectedTab: $selectedTab, pendingWorkoutId: $pendingWorkoutId)
            case .plan:
                PlanView()
            case .run:
                RunStartView(isRunInProgress: $isRunInProgress, pendingWorkoutId: $pendingWorkoutId)
            case .history:
                HistoryView()
            case .profile:
                ProfileView()
            }
        }
        .safeAreaInset(edge: .bottom) {
            if !isRunInProgress {
                FloatingTabBar(selectedTab: $selectedTab)
                    .padding(.bottom, 8)
            }
        }
        .ignoresSafeArea(.keyboard)
    }
}
