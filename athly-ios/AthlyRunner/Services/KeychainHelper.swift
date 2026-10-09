import Foundation
import Security

/// Armazenamento seguro de pequenos segredos (tokens de auth) no Keychain.
/// Substitui o uso de UserDefaults para credenciais — requisito de segurança/App Store.
enum KeychainHelper {
    /// Service que agrupa os itens deste app no Keychain.
    private static let service = "app.athly.runner.tokens"

    @discardableResult
    static func save(_ value: String, for key: String) -> Bool {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        // Atualiza sem apagar primeiro: uma falha não pode destruir as credenciais anteriores.
        let status = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status != errSecItemNotFound { return status == errSecSuccess }

        var attributes = query
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        return SecItemAdd(attributes as CFDictionary, nil) == errSecSuccess
    }

    static func read(_ key: String) -> String? {
        try? readValue(key)
    }

    static func readValue(_ key: String) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else { throw SessionStorageError() }
        return String(data: data, encoding: .utf8)
    }

    static func delete(_ key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

struct SessionTokens: Codable, Sendable, Equatable {
    let accessToken: String
    let refreshToken: String
}

struct SessionStorageError: LocalizedError {
    var errorDescription: String? {
        String(localized: "Não foi possível acessar sua sessão salva. Tente novamente.")
    }
}

/// Um único item garante que access e refresh nunca sejam gravados pela metade.
enum SessionTokenStore {
    private static let key = "athly_session_tokens"
    private static let accessKey = "athly_access_token"
    private static let refreshKey = "athly_refresh_token"

    static func save(_ tokens: SessionTokens) throws {
        let value = String(decoding: try JSONEncoder().encode(tokens), as: UTF8.self)
        guard KeychainHelper.save(value, for: key) else { throw SessionStorageError() }
    }

    static func load() throws -> SessionTokens? {
        try load(read: KeychainHelper.readValue,
                 readLegacyDefault: { UserDefaults.standard.string(forKey: $0) },
                 save: save, clearLegacy: clearLegacy)
    }

    // As dependências permitem validar migrações sem acessar as credenciais reais do app.
    static func load(read: (String) throws -> String?, readLegacyDefault: (String) -> String?,
                     save: (SessionTokens) throws -> Void, clearLegacy: () -> Void) throws -> SessionTokens? {
        if let value = try read(key) {
            return try JSONDecoder().decode(SessionTokens.self, from: Data(value.utf8))
        }
        let tokens: SessionTokens
        if let access = try read(accessKey), let refresh = try read(refreshKey) {
            tokens = SessionTokens(accessToken: access, refreshToken: refresh)
        } else if let access = readLegacyDefault(accessKey), let refresh = readLegacyDefault(refreshKey) {
            tokens = SessionTokens(accessToken: access, refreshToken: refresh)
        } else {
            return nil
        }
        // Nunca mistura tokens de sessões distintas nem remove o legado antes de salvar o par.
        try save(tokens)
        clearLegacy()
        return tokens
    }

    static func clear() {
        KeychainHelper.delete(key)
        clearLegacy()
    }

    private static func clearLegacy() {
        KeychainHelper.delete(accessKey)
        KeychainHelper.delete(refreshKey)
        UserDefaults.standard.removeObject(forKey: accessKey)
        UserDefaults.standard.removeObject(forKey: refreshKey)
    }
}
