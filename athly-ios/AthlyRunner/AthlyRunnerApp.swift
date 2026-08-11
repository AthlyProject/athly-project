import SwiftUI
import RevenueCat
import UIKit
import UserNotifications
import GoogleSignIn

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        Self.postGenerationNotificationIfPresent(notification.request.content.userInfo)
        return [.banner, .list, .sound]
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in
            await NotificationService.shared.receiveRemoteDeviceToken(deviceToken)
        }
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        Self.postGenerationNotificationIfPresent(response.notification.request.content.userInfo)
    }

    private nonisolated static func postGenerationNotificationIfPresent(
        _ userInfo: [AnyHashable: Any]
    ) {
        guard userInfo["type"] as? String == "weekly_plan_generated",
              let generationId = userInfo["generationId"] as? String else { return }
        NotificationCenter.default.post(
            name: .athlyPlanGenerationPush,
            object: nil,
            userInfo: ["generationId": generationId]
        )
    }
}

@main
struct AthlyRunnerApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var authViewModel = AuthViewModel()
    @StateObject private var locationManager = LocationManager()
    @StateObject private var planViewModel = TrainingPlanViewModel()
    @StateObject private var runStore = RunStore()
    @StateObject private var entitlementManager = EntitlementManager()

    init() {
        OTelClient.start()
        configureRevenueCat()
        configureGoogleSignIn()
        configureUIKitAppearance()
    }

    /// Configura o GoogleSignIn com o client ID do Info.plist (Config.xcconfig → GIDClientID).
    /// Sem key válida, o botão do Google simplesmente não autentica (fail-safe).
    private func configureGoogleSignIn() {
        guard let clientID = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String,
              !clientID.isEmpty else { return }
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
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
                .onOpenURL { url in
                    // Callback OAuth do GoogleSignIn (URL scheme reverso do client ID).
                    GIDSignIn.sharedInstance.handle(url)
                }
                .onReceive(NotificationCenter.default.publisher(for: .athlyAuthChanged)) { note in
                    let authenticated = note.userInfo?["authenticated"] as? Bool ?? false
                    Task { @MainActor in
                        if authenticated {
                            await NotificationService.shared.syncRemoteDeviceTokenIfAvailable()
                            planViewModel.resumePendingGenerationIfNeeded()
                        } else {
                            planViewModel.cancelPendingGeneration()
                        }
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: .athlyPlanGenerationPush)) { note in
                    guard let generationId = note.userInfo?["generationId"] as? String else { return }
                    planViewModel.handleGenerationPush(generationId: generationId)
                }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in
                    Task { @MainActor in
                        await NotificationService.shared.registerForRemoteNotificationsIfAuthorized()
                        planViewModel.resumePendingGenerationIfNeeded()
                    }
                }
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
