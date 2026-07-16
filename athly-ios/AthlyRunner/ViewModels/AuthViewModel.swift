import Foundation
import SwiftUI

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

    func register(email: String, userName: String, name: String, password: String, confirmPassword: String, dateOfBirth: String, weight: Double, height: Double) async {
        isLoading = true
        errorMessage = nil

        do {
            let response = try await APIClient.shared.register(email: email, userName: userName, name: name, password: password, confirmPassword: confirmPassword, dateOfBirth: dateOfBirth, weight: weight, height: height)
            saveTokens(access: response.accessToken, refresh: response.refreshToken)
            UserMetrics.weightKg = weight
            self.userName = userName
            // Usuário recém-criado sempre precisa responder o questionário de onboarding.
            assessmentCompleted = false
            isAuthenticated = true
            postAuthChanged(true)
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func logout() {
        clearLocalSession()
    }

    /// Carrega o username de registro do perfil (`GET /users/me`) para a saudação do Dashboard.
    /// Usa `name` como fallback caso o backend não devolva `username`. Falha silenciosa: a
    /// saudação cai em "Atleta" quando vazio.
    func refreshUserName() async {
        guard let profile = try? await APIClient.shared.getUserProfile() else { return }
        self.userName = profile.username ?? profile.name ?? ""
        // Gate do questionário: perfis antigos sem o campo contam como completos (fail-open).
        self.assessmentCompleted = profile.assessmentCompleted ?? true
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
}
