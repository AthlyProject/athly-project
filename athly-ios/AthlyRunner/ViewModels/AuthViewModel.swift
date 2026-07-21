import Foundation
import SwiftUI
import UIKit
import AuthenticationServices
import GoogleSignIn

@MainActor
final class AuthViewModel: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var userName: String = ""
    @Published private(set) var hasFinishedInitialSessionRestore = false
    /// Gate do questionário de onboarding (mesmo fluxo do athly-frontend).
    /// nil = ainda não sabemos (perfil não carregado) → não bloqueia; false = precisa responder.
    @Published private(set) var assessmentCompleted: Bool? = nil
    /// Gate de completar perfil: contas criadas via login social não têm data de nascimento/peso/altura.
    /// `true` → mostra a etapa de completar perfil antes do questionário.
    @Published private(set) var needsProfileCompletion = false

    private let tokenKey = "athly_access_token"
    private let refreshKey = "athly_refresh_token"

    init() {
        migrateTokensFromUserDefaultsIfNeeded()
        loadSavedTokens()
        observeTokenRefresh()
        observeSessionExpiry()
    }

    private func observeTokenRefresh() {
        NotificationCenter.default.addObserver(
            forName: .athlyTokensRefreshed,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let self,
                  let accessToken = notification.userInfo?["accessToken"] as? String,
                  let refreshToken = notification.userInfo?["refreshToken"] as? String else { return }
            self.saveTokens(access: accessToken, refresh: refreshToken)
        }
    }

    /// Sessão rejeitada pelo backend (401 irrecuperável, emitido pelo `APIClient`): desloga e
    /// deixa o `RootView` redirecionar para a tela de login. Guard idempotente — vários requests
    /// podem disparar 401 ao mesmo tempo, mas só o primeiro (já autenticado) efetiva o logout.
    private func observeSessionExpiry() {
        NotificationCenter.default.addObserver(
            forName: .athlySessionExpired,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self, self.isAuthenticated else { return }
            self.errorMessage = "Sua sessão expirou. Faça login novamente."
            self.logout()
        }
    }

    func login(email: String, password: String) async {
        isLoading = true
        errorMessage = nil

        do {
            let response = try await APIClient.shared.login(email: email, password: password)
            saveTokens(access: response.accessToken, refresh: response.refreshToken)
            isAuthenticated = true
            postAuthChanged(true)
            await refreshUserName()
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func register(email: String, name: String, password: String, confirmPassword: String, dateOfBirth: String, weight: Double, height: Double) async {
        isLoading = true
        errorMessage = nil

        do {
            let response = try await APIClient.shared.register(email: email, name: name, password: password, confirmPassword: confirmPassword, dateOfBirth: dateOfBirth, weight: weight, height: height)
            saveTokens(access: response.accessToken, refresh: response.refreshToken)
            UserMetrics.weightKg = weight
            self.userName = name
            // Usuário recém-criado sempre precisa responder o questionário de onboarding.
            assessmentCompleted = false
            isAuthenticated = true
            postAuthChanged(true)
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Login social

    /// Fluxo do Google: abre a folha do GoogleSignIn, troca o id_token no backend e entra.
    func signInWithGoogle() async {
        errorMessage = nil
        guard let presenting = Self.topViewController() else {
            errorMessage = "Não foi possível abrir o login do Google."
            return
        }

        isLoading = true
        do {
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenting)
            guard let idToken = result.user.idToken?.tokenString else {
                throw AuthError.missingProviderToken
            }
            let response = try await APIClient.shared.loginWithGoogle(idToken: idToken)
            await completeSocialSignIn(response)
        } catch let error as GIDSignInError where error.code == .canceled {
            // Usuário cancelou — não é erro.
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    /// Fluxo da Apple: recebe a credential do `SignInWithAppleButton`, troca o identity token no
    /// backend e entra. O nome só vem na primeira autorização; repassamos quando disponível.
    func signInWithApple(credential: ASAuthorizationAppleIDCredential) async {
        errorMessage = nil
        isLoading = true
        do {
            guard let tokenData = credential.identityToken,
                  let identityToken = String(data: tokenData, encoding: .utf8) else {
                throw AuthError.missingProviderToken
            }
            let fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
                .compactMap { $0 }
                .joined(separator: " ")
            let response = try await APIClient.shared.loginWithApple(
                identityToken: identityToken,
                fullName: fullName.isEmpty ? nil : fullName
            )
            await completeSocialSignIn(response)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    /// Passo comum aos dois provedores: salva tokens, entra e carrega o perfil (que define os gates
    /// de completar perfil e de questionário).
    private func completeSocialSignIn(_ response: AuthResponse) async {
        saveTokens(access: response.accessToken, refresh: response.refreshToken)
        isAuthenticated = true
        postAuthChanged(true)
        await refreshUserName()
    }

    /// Chamado pela `ProfileCompletionView` após o PUT /users/profile com sucesso.
    func markProfileCompleted() {
        needsProfileCompletion = false
    }

    /// Apresenta o GoogleSignIn e devolve o idToken — usado para *vincular* a conta Google sem
    /// trocar a sessão atual. Retorna `nil` se o usuário cancelar.
    func acquireGoogleIdToken() async throws -> String? {
        guard let presenting = Self.topViewController() else {
            throw AuthError.missingProviderToken
        }
        do {
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenting)
            guard let idToken = result.user.idToken?.tokenString else {
                throw AuthError.missingProviderToken
            }
            return idToken
        } catch let error as GIDSignInError where error.code == .canceled {
            return nil
        }
    }

    func logout() {
        clearLocalSession()
    }

    func refreshUserName() async {
        guard let profile = try? await APIClient.shared.getUserProfile() else { return }
        self.userName = profile.name ?? ""
        // Gate do questionário: perfis antigos sem o campo contam como completos (fail-open).
        self.assessmentCompleted = profile.assessmentCompleted ?? true
        // Gate de completar perfil: contas sociais nascem sem data de nascimento/peso/altura.
        self.needsProfileCompletion =
            profile.dateOfBirth == nil || profile.weight == nil || profile.height == nil
    }

    /// Chamado pela AssessmentView após o POST /assessment com sucesso.
    func markAssessmentCompleted() {
        assessmentCompleted = true
    }

    /// Exclui a conta no servidor (cascade de todos os dados) e limpa a sessão local.
    func deleteAccount() async -> Bool {
        do {
            try await APIClient.shared.deleteAccount()
            clearLocalSession()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    private func clearLocalSession() {
        KeychainHelper.delete(tokenKey)
        KeychainHelper.delete(refreshKey)
        TrainingPlanCache.shared.clear()
        HealthKitRunsCache.shared.clear()
        AchievementStore.shared.clear()
        Task {
            await APIClient.shared.clearTokens()
        }
        isAuthenticated = false
        assessmentCompleted = nil
        needsProfileCompletion = false
        postAuthChanged(false)
    }

    private func saveTokens(access: String, refresh: String) {
        KeychainHelper.save(access, for: tokenKey)
        KeychainHelper.save(refresh, for: refreshKey)
    }

    private func loadSavedTokens() {
        guard let access = KeychainHelper.read(tokenKey),
              let refresh = KeychainHelper.read(refreshKey) else {
            hasFinishedInitialSessionRestore = true
            return
        }
        Task {
            await APIClient.shared.setTokens(access: access, refresh: refresh)
            isAuthenticated = true
            postAuthChanged(true)
            hasFinishedInitialSessionRestore = true
            // Não bloqueia o gate de restauração de sessão; a saudação atualiza reativamente.
            await refreshUserName()
        }
    }

    /// Avisa o `EntitlementManager` (via NotificationCenter) para ligar/desligar o app_user_id do
    /// RevenueCat. Mantém este ViewModel desacoplado do SDK de compras.
    private func postAuthChanged(_ authenticated: Bool) {
        NotificationCenter.default.post(
            name: .athlyAuthChanged, object: nil, userInfo: ["authenticated": authenticated]
        )
    }

    /// Migração única: tokens legados em UserDefaults → Keychain (e limpa o UserDefaults).
    private func migrateTokensFromUserDefaultsIfNeeded() {
        let defaults = UserDefaults.standard
        guard let access = defaults.string(forKey: tokenKey),
              let refresh = defaults.string(forKey: refreshKey) else {
            return
        }
        KeychainHelper.save(access, for: tokenKey)
        KeychainHelper.save(refresh, for: refreshKey)
        defaults.removeObject(forKey: tokenKey)
        defaults.removeObject(forKey: refreshKey)
    }

    /// View controller ativo para apresentar a folha do GoogleSignIn.
    private static func topViewController() -> UIViewController? {
        let windowScene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        let window = windowScene?.windows.first { $0.isKeyWindow } ?? windowScene?.windows.first
        var top = window?.rootViewController
        while let presented = top?.presentedViewController {
            top = presented
        }
        return top
    }
}

enum AuthError: LocalizedError {
    case missingProviderToken

    var errorDescription: String? {
        switch self {
        case .missingProviderToken:
            return "Não foi possível obter as credenciais do provedor. Tente novamente."
        }
    }
}
