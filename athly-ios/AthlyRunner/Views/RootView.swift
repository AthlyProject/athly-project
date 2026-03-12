import SwiftUI

struct RootView: View {
    @EnvironmentObject var authViewModel: AuthViewModel

    var body: some View {
        Group {
            if authViewModel.isAuthenticated {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .background(AthlyTheme.Color.backgroundDark.ignoresSafeArea())
        .animation(.easeInOut, value: authViewModel.isAuthenticated)
    }
}
