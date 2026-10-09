import XCTest
@testable import AthlyRunner

/// Cobre a resolução do erro do backend para o idioma do app: o servidor manda um `code`
/// estável e o texto pt-BR, e o app precisa preferir o código traduzido sem nunca ficar
/// sem mensagem quando o código é desconhecido (app antigo × backend novo).
final class BackendErrorCodeTests: XCTestCase {

    private var incompatibilityMessage: String {
        String(localized: "Não foi possível concluir esta ação devido a uma incompatibilidade com o servidor. Tente novamente mais tarde.")
    }

    private func encodedBody(_ value: [String: Any]) throws -> BackendErrorBody {
        try JSONDecoder().decode(BackendErrorBody.self, from: JSONSerialization.data(withJSONObject: value))
    }

    func testFortyUnknownHeartRateFieldsBecomeOneLocalizedMessage() throws {
        let errors = (0..<20).flatMap { index in
            ["avgHR", "maxHR"].map { field in
                ["field": "runs.\(index).\(field)", "constraint": "whitelistValidation",
                 "code": "VALIDATION_RUNS_HR_WHITELIST_VALIDATION", "message": "property \(field) should not exist"]
            }
        }
        let error = try encodedBody(["code": "VALIDATION_FAILED", "errors": errors])
        XCTAssertEqual(error.localizedText, incompatibilityMessage)
        let attributes = try XCTUnwrap(error.validationAttributes(method: "POST", path: "/ai-planner/health-context", statusCode: 400))
        XCTAssertEqual(attributes["validation.error_count"], "40")
        XCTAssertEqual(attributes["validation.fields"], "runs.avgHR,runs.maxHR")
        XCTAssertEqual(attributes["http.route"], "/ai-planner/health-context")
    }

    func testRecognizesConstraintCodeAndLegacyUnknownPropertyMessages() throws {
        let bodies: [[String: Any]] = [
            ["errors": [["constraint": "whitelistValidation", "message": "texto diferente"]]],
            ["errors": [["code": "VALIDATION_RUNS_MAX_HR_WHITELIST_VALIDATION"]]],
            ["message": Array(repeating: "property maxHR should not exist", count: 40)],
            ["message": ["planningContext.runs.0.property maxHR should not exist"]],
            ["message": "property maxHR should not exist"],
        ]
        for value in bodies {
            XCTAssertEqual(try encodedBody(value).localizedText, incompatibilityMessage)
        }
    }

    func testValidationSummaryTrimsDeduplicatesAndLimitsBothResponseFormats() throws {
        let messages = ["  ", " Primeiro ", "Primeiro", "Segundo\nTerceiro", "Quarto", ""]
        let legacy = try encodedBody(["message": messages])
        let structured = try encodedBody(["code": "VALIDATION_FAILED", "errors": messages.map { ["message": $0] }])
        XCTAssertEqual(legacy.localizedText, "Primeiro\nSegundo\nTerceiro")
        XCTAssertEqual(structured.localizedText, legacy.localizedText)
        XCTAssertNil(try encodedBody(["message": ["", "  ", "\n"]]).localizedText)
    }

    func testEmptyFieldMessagesFallBackToLegacySummary() throws {
        XCTAssertEqual(try encodedBody(["code": "VALIDATION_FAILED", "errors": [["message": " "]],
                                       "message": ["Mensagem útil"]]).localizedText, "Mensagem útil")
    }

    func testValidationTelemetryContainsNoSubmittedValuesOrRouteIdentifiers() throws {
        let error = try encodedBody(["code": "VALIDATION_FAILED", "message": "private-value@example.com",
                                    "errors": [["field": "planningContext.runs.19.maxHR", "constraint": "max",
                                                "code": "VALIDATION_RUNS_MAX_HR_MAX", "message": "private-health-value"]]])
        let attributes = try XCTUnwrap(error.validationAttributes(method: "PATCH", path: "/workouts/private-workout-id/complete", statusCode: 400))
        XCTAssertEqual(attributes["http.route"], "/workouts/:id/complete")
        XCTAssertEqual(attributes["validation.fields"], "planningContext.runs.maxHR")
        XCTAssertFalse(attributes.description.contains("private-"))
        XCTAssertNil(error.validationAttributes(method: "GET", path: "/users/profile", statusCode: 500))
        XCTAssertEqual(error.validationAttributes(method: "GET", path: "/unknown/private-user", statusCode: 400)?["http.route"], "/unknown")
        XCTAssertNil(try body(#"{"code":"WORKOUT_DATE_OCCUPIED","message":"Data ocupada"}"#)
            .validationAttributes(method: "PUT", path: "/workouts/w1", statusCode: 400))
    }

    func testServerErrorRetainsStatusWithoutDisplayingHTTPPrefix() {
        let error = APIError.serverError(400, incompatibilityMessage)
        XCTAssertEqual(error.localizedDescription, incompatibilityMessage)
        guard case .serverError(let status, _) = error else { return XCTFail() }
        XCTAssertEqual(status, 400)
        XCTAssertEqual(APIError.serverError(500, "  \n").localizedDescription,
                       String(localized: "Não foi possível concluir esta ação. Tente novamente mais tarde."))
    }

    func testRequiredAndOptionalRequestsRecordOnceWithoutRetryingOrLeakingPayloads() async throws {
        let recorder = ValidationEventRecorder()
        let responseBody = Data(#"{"statusCode":400,"code":"VALIDATION_FAILED","errors":[{"field":"runs.0.maxHR","constraint":"whitelistValidation","message":"private-response-value"}]}"#.utf8)
        let api = APIClient(transport: { request in
            recorder.request()
            return (responseBody, HTTPURLResponse(url: request.url!, statusCode: 400, httpVersion: nil, headerFields: nil)!)
        }, persistTokens: { _ in }, deleteTokens: {}, recordValidationFailure: { recorder.append($0) })
        await api.setTokens(access: "private-access-token", refresh: "private-refresh-token")
        do { _ = try await api.getUserProfile(); XCTFail("Expected validation failure") }
        catch { XCTAssertEqual(error.localizedDescription, incompatibilityMessage) }
        do { _ = try await api.getActiveGoal(); XCTFail("Expected validation failure") }
        catch { XCTAssertEqual(error.localizedDescription, incompatibilityMessage) }
        XCTAssertEqual(recorder.requestCount, 2)
        XCTAssertEqual(recorder.events.count, 2)
        XCTAssertEqual(recorder.events.map { $0["http.route"] }, ["/users/me", "/goals/active"])
        XCTAssertFalse(recorder.events.description.contains("private-"))
    }

    private func body(_ json: String) throws -> BackendErrorBody {
        try JSONDecoder().decode(BackendErrorBody.self, from: Data(json.utf8))
    }

    func testPrefersMappedCodeOverServerMessage() throws {
        let error = try body("""
        { "statusCode": 401, "code": "AUTH_INVALID_CREDENTIALS", "message": "Credenciais inválidas" }
        """)

        XCTAssertEqual(error.localizedText, String(localized: "Credenciais inválidas"))
    }

    func testMapsGarminPairingCodes() throws {
        let cases = [
            ("CIQ_PAIRING_CODE_INVALID", "Código inválido ou expirado. Confira o código no relógio."),
            ("CIQ_PAIRING_RATE_LIMITED", "Muitas tentativas. Aguarde alguns minutos e tente de novo."),
            ("CIQ_DEVICE_LIMIT_REACHED", "Você já tem 5 relógios conectados. Desconecte um para continuar."),
        ]
        for (code, expected) in cases {
            let error = try body(#"{ "statusCode": 400, "code": "\#(code)", "message": "texto do servidor" }"#)
            XCTAssertEqual(error.localizedText, String(localized: String.LocalizationValue(expected)), code)
        }
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

    func testLegalConsentCodesAreLocalized() {
        // O código do backend tem que bater com a constante usada para detectar o erro no APIClient.
        XCTAssertEqual(BackendErrorCode.legalConsentRequired, "AUTH_LEGAL_CONSENT_REQUIRED")
        XCTAssertEqual(
            APIError.legalConsentRequired.errorDescription,
            String(localized: "Aceite os Termos de Uso e a Política de Privacidade para criar sua conta.")
        )
        XCTAssertNotNil(BackendErrorCode.localizedMessage(for: "VALIDATION_TERMS_ACCEPTED_EQUALS"))
        XCTAssertNotNil(BackendErrorCode.localizedMessage(for: "VALIDATION_PRIVACY_ACCEPTED_EQUALS"))
    }
}

private final class ValidationEventRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var recorded: [[String: String]] = []
    private var requests = 0
    var events: [[String: String]] { lock.withLock { recorded } }
    var requestCount: Int { lock.withLock { requests } }
    func append(_ attributes: [String: String]) { lock.withLock { recorded.append(attributes) } }
    func request() { lock.withLock { requests += 1 } }
}
