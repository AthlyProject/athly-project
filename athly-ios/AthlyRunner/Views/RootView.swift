import SwiftUI

struct RootView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @State private var showLaunchSplash = true
    @State private var animateLaunchSplash = false
    @State private var hasMetMinimumSplashTime = false

    private let minimumSplashDuration: UInt64 = 850_000_000

    var body: some View {
        ZStack {
            Group {
                if authViewModel.isAuthenticated {
                    // Sem aceite registrado das versões vigentes dos Termos/Privacidade (contas
                    // antigas ou documentos atualizados): bloqueia o app até o aceite.
                    if authViewModel.needsLegalConsent {
                        LegalConsentView(
                            subtitle: "Para continuar usando o Athly, leia e aceite os Termos de Uso e a Política de Privacidade.",
                            cancelTitle: "Sair da conta",
                            onAccept: { await authViewModel.acceptLegalConsent() },
                            onCancel: { Task { await authViewModel.logout() } }
                        )
                    } else if authViewModel.needsProfileCompletion {
                        // Contas sociais nascem sem data de nascimento/peso/altura: completa o
                        // perfil antes de entrar no app.
                        ProfileCompletionView()
                    } else {
                        MainTabView()
                    }
                } else {
                    AuthWelcomeView()
                }
            }
            .opacity(showLaunchSplash ? 0 : 1)
            .allowsHitTesting(!showLaunchSplash)

            if showLaunchSplash {
                LaunchSplashView(isVisible: animateLaunchSplash)
                    .transition(.opacity)
            }
        }
        .background(AthlyTheme.Color.backgroundDark.ignoresSafeArea())
        .animation(.easeInOut(duration: 0.35), value: authViewModel.isAuthenticated)
        .animation(.easeInOut(duration: 0.35), value: authViewModel.needsProfileCompletion)
        .animation(.easeInOut(duration: 0.35), value: authViewModel.needsLegalConsent)
        .animation(.easeInOut(duration: 0.3), value: showLaunchSplash)
        .task {
            guard showLaunchSplash else { return }
            await runLaunchSequence()
        }
        .onChange(of: authViewModel.hasFinishedInitialSessionRestore) { _ in
            dismissLaunchSplashIfReady()
        }
    }

    @MainActor
    private func runLaunchSequence() async {
        withAnimation(.easeOut(duration: 0.45)) {
            animateLaunchSplash = true
        }

        try? await Task.sleep(nanoseconds: minimumSplashDuration)
        hasMetMinimumSplashTime = true
        dismissLaunchSplashIfReady()
    }

    private func dismissLaunchSplashIfReady() {
        guard showLaunchSplash,
              hasMetMinimumSplashTime,
              authViewModel.hasFinishedInitialSessionRestore else { return }

        withAnimation(.easeInOut(duration: 0.3)) {
            showLaunchSplash = false
        }
    }
}

private struct LaunchSplashView: View {
    let isVisible: Bool

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark
                .ignoresSafeArea()

            RadialGradient(
                colors: [
                    AthlyTheme.Color.primary.opacity(0.12),
                    AthlyTheme.Color.backgroundDark
                ],
                center: .top,
                startRadius: 0,
                endRadius: 400
            )
            .ignoresSafeArea()

            Image("AthlyLogo")
                .resizable()
                .scaledToFit()
                .frame(width: 112, height: 112)
                .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                .shadow(color: AthlyTheme.Color.primary.opacity(isVisible ? 0.28 : 0), radius: 20, y: 8)
                .opacity(isVisible ? 1 : 0)
                .scaleEffect(isVisible ? 1 : 0.88)
        }
    }
}
