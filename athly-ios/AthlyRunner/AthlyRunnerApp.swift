import SwiftUI

@main
struct AthlyRunnerApp: App {
    @StateObject private var authViewModel = AuthViewModel()
    @StateObject private var locationManager = LocationManager()
    @StateObject private var planViewModel = TrainingPlanViewModel()
    @StateObject private var runStore = RunStore()

    init() {
        configureUIKitAppearance()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(authViewModel)
                .environmentObject(locationManager)
                .environmentObject(planViewModel)
                .environmentObject(runStore)
                .preferredColorScheme(.dark)
        }
    }

    private func configureUIKitAppearance() {
        // Navigation bar
        let navAppearance = UINavigationBarAppearance()
        navAppearance.configureWithOpaqueBackground()
        navAppearance.backgroundColor = UIColor(AthlyTheme.Color.backgroundDark)
        navAppearance.titleTextAttributes = [.foregroundColor: UIColor(AthlyTheme.Color.textPrimary)]
        navAppearance.largeTitleTextAttributes = [.foregroundColor: UIColor(AthlyTheme.Color.textPrimary)]
        UINavigationBar.appearance().standardAppearance = navAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navAppearance
        UINavigationBar.appearance().compactAppearance = navAppearance

        // Tab bar
        let tabAppearance = UITabBarAppearance()
        tabAppearance.configureWithOpaqueBackground()
        tabAppearance.backgroundColor = UIColor(AthlyTheme.Color.surfaceDark)
        UITabBar.appearance().standardAppearance = tabAppearance
        UITabBar.appearance().scrollEdgeAppearance = tabAppearance
    }
}
