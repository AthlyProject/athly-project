import XCTest
@testable import AthlyRunner

/// Cobre a resolução do erro do backend para o idioma do app: o servidor manda um `code`
/// estável e o texto pt-BR, e o app precisa preferir o código traduzido sem nunca ficar
/// sem mensagem quando o código é desconhecido (app antigo × backend novo).
final class BackendErrorCodeTests: XCTestCase {

    private func body(_ json: String) throws -> BackendErrorBody {
        try JSONDecoder().decode(BackendErrorBody.self, from: Data(json.utf8))
    }

    func testPrefersMappedCodeOverServerMessage() throws {
        let error = try body("""
        { "statusCode": 401, "code": "AUTH_INVALID_CREDENTIALS", "message": "Credenciais inválidas" }
        """)

        XCTAssertEqual(error.localizedText, String(localized: "Credenciais inválidas"))
    }

    func testFallsBackToServerMessageForUnknownCode() throws {
        let error = try body("""
        { "statusCode": 409, "code": "SOMETHING_NEW_FROM_THE_FUTURE", "message": "Mensagem do servidor" }
        """)

        XCTAssertEqual(error.localizedText, "Mensagem do servidor")
    }

    func testFallsBackToServerMessageWhenThereIsNoCode() throws {
        // Erros que ainda não passaram pelas exceções com código (ex.: 500 inesperado).
        let error = try body("""
        { "statusCode": 500, "message": "Internal server error" }
        """)

        XCTAssertEqual(error.localizedText, "Internal server error")
    }

    func testJoinsLocalizedValidationErrors() throws {
        let error = try body("""
        {
          "statusCode": 400,
          "code": "VALIDATION_FAILED",
          "message": ["Email inválido", "Senha deve ter no mínimo 8 caracteres"],
          "errors": [
            { "field": "email", "code": "VALIDATION_EMAIL_IS_EMAIL", "message": "Email inválido" },
            { "field": "password", "code": "VALIDATION_PASSWORD_MIN_LENGTH", "message": "Senha deve ter no mínimo 8 caracteres" }
          ]
        }
        """)

        let expected = [
            String(localized: "Email inválido"),
            String(localized: "Senha deve ter no mínimo 8 caracteres"),
        ].joined(separator: "\n")
        XCTAssertEqual(error.localizedText, expected)
    }

    func testUnknownValidationCodeKeepsItsOwnServerMessage() throws {
        let error = try body("""
        {
          "statusCode": 400,
          "code": "VALIDATION_FAILED",
          "message": ["Email inválido", "campo novo inválido"],
          "errors": [
            { "field": "email", "code": "VALIDATION_EMAIL_IS_EMAIL", "message": "Email inválido" },
            { "field": "novoCampo", "code": "VALIDATION_NOVO_CAMPO_IS_STRING", "message": "campo novo inválido" }
          ]
        }
        """)

        let expected = String(localized: "Email inválido") + "\ncampo novo inválido"
        XCTAssertEqual(error.localizedText, expected)
    }

    /// Corpo de validação antigo (só `message: [String]`), caso um backend não atualizado responda.
    func testDecodesLegacyValidationArrayWithoutErrors() throws {
        let error = try body("""
        { "statusCode": 400, "message": ["Email inválido", "Senha é obrigatória"] }
        """)

        XCTAssertEqual(error.localizedText, "Email inválido\nSenha é obrigatória")
    }

    func testReturnsNilWhenThereIsNothingToShow() throws {
        XCTAssertNil(try body("{ \"statusCode\": 500 }").localizedText)
        XCTAssertNil(try body("{ \"statusCode\": 500, \"message\": \"\" }").localizedText)
    }

    func testRefreshTokenCodesShareTheSessionExpiredCopy() {
        let expired = String(localized: "Sessão expirada. Faça login novamente.")
        XCTAssertEqual(BackendErrorCode.localizedMessage(for: "AUTH_REFRESH_TOKEN_INVALID"), expired)
        XCTAssertEqual(BackendErrorCode.localizedMessage(for: "AUTH_REFRESH_TOKEN_EXPIRED"), expired)
    }
}
