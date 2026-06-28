import SwiftUI
import RevenueCat

@main
struct AthlyRunnerApp: App {
    @StateObject private var authViewModel = AuthViewModel()
    @StateObject private var locationManager = LocationManager()
    @StateObject private var planViewModel = TrainingPlanViewModel()
    @StateObject private var runStore = RunStore()
    @StateObject private var entitlementManager = EntitlementManager()

    init() {
        OTelClient.start()
        configureRevenueCat()
        configureUIKitAppearance()
    }

    /// Configura o RevenueCat antes de qualquer uso do SDK. A key vem do Info.plist
    /// (Config.xcconfig → REVENUECAT_API_KEY). O `app_user_id` é ligado depois via `Purchases.logIn`
    /// no login (ver EntitlementManager). Roda antes das Tasks assíncronas do EntitlementManager.
    private func configureRevenueCat() {
        #if DEBUG
        Purchases.logLevel = .debug
        #endif
        guard let key = Bundle.main.object(forInfoDictionaryKey: "REVENUECAT_API_KEY") as? String,
              !key.isEmpty else { return }
        Purchases.configure(withAPIKey: key)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(authViewModel)
                .environmentObject(locationManager)
                .environmentObject(planViewModel)
                .environmentObject(runStore)
                .environmentObject(entitlementManager)
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
