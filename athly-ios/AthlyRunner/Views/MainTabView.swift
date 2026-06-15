import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var locationManager: LocationManager
    @State private var selectedTab: AppTab = .dashboard
    @State private var isRunInProgress = false
    @State private var pendingWorkout: WorkoutModel?

    var body: some View {
        Group {
            switch selectedTab {
            case .dashboard:
                DashboardView(selectedTab: $selectedTab, pendingWorkout: $pendingWorkout)
            case .plan:
                PlanView(onStartWorkout: { workout in
                    pendingWorkout = workout
                    withAnimation(.easeInOut(duration: 0.2)) { selectedTab = .run }
                })
            case .run:
                RunStartView(isRunInProgress: $isRunInProgress, pendingWorkout: $pendingWorkout)
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
