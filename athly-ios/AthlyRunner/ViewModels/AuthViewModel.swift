import Foundation
import SwiftUI

@MainActor
final class AuthViewModel: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var userName: String = ""

    private let tokenKey = "athly_access_token"
    private let refreshKey = "athly_refresh_token"

    init() {
        loadSavedTokens()
    }

    func login(email: String, password: String) async {
        isLoading = true
        errorMessage = nil

        do {
            let response = try await APIClient.shared.login(email: email, password: password)
            saveTokens(access: response.accessToken, refresh: response.refreshToken)
            isAuthenticated = true
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func register(name: String, email: String, password: String) async {
        isLoading = true
        errorMessage = nil

        do {
            let response = try await APIClient.shared.register(name: name, email: email, password: password)
            saveTokens(access: response.accessToken, refresh: response.refreshToken)
            userName = name
            isAuthenticated = true
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func logout() {
        UserDefaults.standard.removeObject(forKey: tokenKey)
        UserDefaults.standard.removeObject(forKey: refreshKey)
        Task {
            await APIClient.shared.clearTokens()
        }
        isAuthenticated = false
    }

    private func saveTokens(access: String, refresh: String) {
        UserDefaults.standard.set(access, forKey: tokenKey)
        UserDefaults.standard.set(refresh, forKey: refreshKey)
    }

    private func loadSavedTokens() {
        guard let access = UserDefaults.standard.string(forKey: tokenKey),
              let refresh = UserDefaults.standard.string(forKey: refreshKey) else {
            return
        }
        Task {
            await APIClient.shared.setTokens(access: access, refresh: refresh)
            isAuthenticated = true
        }
    }
}
