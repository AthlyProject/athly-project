import Foundation

extension Notification.Name {
    /// Emitida quando a sessão é definitivamente rejeitada pelo backend (401 e o refresh falhou).
    /// O `AuthViewModel` escuta para deslogar e redirecionar para a tela de login.
    static let athlySessionExpired = Notification.Name("athlySessionExpired")
    /// Emitida pelo `AuthViewModel` em login/registro/restauração (authenticated=true) e logout
    /// (false). O `EntitlementManager` escuta para fazer `Purchases.logIn(userId)`/`logOut()`.
    static let athlyAuthChanged = Notification.Name("athlyAuthChanged")
    /// Emitida pelo AppDelegate quando um push de geração concluída chega ou é aberto.
    static let athlyPlanGenerationPush = Notification.Name("athlyPlanGenerationPush")
}

actor APIClient {
    static let shared = APIClient()

    private var baseURL: String = {
        #if DEBUG
        return "https://api.athlyproject.app"
        #else
        return "https://api.athlyproject.app"
        #endif
    }()

    private var accessToken: String?
    private var refreshToken: String?
    private var refreshTask: Task<Void, Error>?
    private var sessionVersion = UUID()
    private var expiryNotified = false
    private var pendingPersistence: SessionTokens?
    private let transport: @Sendable (URLRequest) async throws -> (Data, URLResponse)
    private let persistTokens: @Sendable (SessionTokens) throws -> Void
    private let deleteTokens: @Sendable () -> Void
    private let recordValidationFailure: @Sendable ([String: String]) -> Void

    init(
        transport: @escaping @Sendable (URLRequest) async throws -> (Data, URLResponse) = {
            try await URLSession.shared.data(for: $0)
        },
        persistTokens: @escaping @Sendable (SessionTokens) throws -> Void = SessionTokenStore.save,
        deleteTokens: @escaping @Sendable () -> Void = SessionTokenStore.clear,
        recordValidationFailure: @escaping @Sendable ([String: String]) -> Void = {
            OTelClient.addEvent("api.validation_failed", attributes: $0)
        }
    ) {
        self.transport = transport
        self.persistTokens = persistTokens
        self.deleteTokens = deleteTokens
        self.recordValidationFailure = recordValidationFailure
    }

    // MARK: - Auth

    /// Instala uma sessão restaurada ou recém-criada; invalida renovações da sessão anterior.
    func setTokens(access: String, refresh: String) {
        refreshTask?.cancel()
        refreshTask = nil
        sessionVersion = UUID()
        expiryNotified = false
        pendingPersistence = nil
        accessToken = access
        refreshToken = refresh
    }

    @discardableResult
    func clearTokens(ifVersion version: UUID? = nil) -> Bool {
        if let version, version != sessionVersion { return false }
        refreshTask?.cancel()
        refreshTask = nil
        sessionVersion = UUID()
        accessToken = nil
        refreshToken = nil
        pendingPersistence = nil
        deleteTokens()
        return true
    }

    private func installLoginTokens(access: String, refresh: String) throws {
        try persistTokens(SessionTokens(accessToken: access, refreshToken: refresh))
        setTokens(access: access, refresh: refresh)
    }

    private func notifySessionExpired(version: UUID) {
        guard sessionVersion == version, !expiryNotified else { return }
        expiryNotified = true
        NotificationCenter.default.post(name: .athlySessionExpired, object: nil,
                                        userInfo: ["sessionVersion": version])
    }

    /// Traduz o erro do backend para o idioma do app.
    ///
    /// O servidor manda um `code` estável junto do `message` em pt-BR; o app resolve o código
    /// no próprio catálogo de strings (ver `BackendErrorCode`) e só cai no texto do servidor
    /// quando o código é desconhecido — assim um código novo no backend degrada para pt-BR em
    /// vez de sumir da tela.
    private static func backendMessage(from data: Data) -> String? {
        guard !data.isEmpty else { return nil }
        return (try? JSONDecoder().decode(BackendErrorBody.self, from: data))?.localizedText
    }

    private static func backendCode(from data: Data) -> String? {
        guard !data.isEmpty else { return nil }
        return (try? JSONDecoder().decode(BackendErrorBody.self, from: data))?.code
    }

    var isAuthenticated: Bool {
        accessToken != nil
    }

    /// Binds a HealthKit capture to the session that started it, including before upload.
    var heartRateSessionIdentifier: UUID { sessionVersion }

    // MARK: - Auth Endpoints

    func login(email: String, password: String) async throws -> AuthResponse {
        let body = LoginRequest(email: email, password: password)
        let response: AuthResponse = try await post("/auth/login", body: body, authenticated: false)
        try installLoginTokens(access: response.accessToken, refresh: response.refreshToken)
        return response
    }

    /// O backend só cria a conta com o aceite explícito de Termos e Privacidade (registra data e
    /// versão de cada documento).
    func register(email: String, password: String) async throws -> AuthResponse {
        let body = RegisterRequest(email: email, password: password, termsAccepted: true, privacyAccepted: true)
        let response: AuthResponse = try await post("/auth/register", body: body, authenticated: false)
        try installLoginTokens(access: response.accessToken, refresh: response.refreshToken)
        return response
    }

    /// Solicita um código de redefinição de senha. O backend sempre responde com a mesma
    /// mensagem genérica, exista ou não o email — evita enumeração de contas.
    @discardableResult
    func forgotPassword(email: String) async throws -> MessageResponse {
        let body = ForgotPasswordRequest(email: email)
        return try await post("/auth/forgot-password", body: body, authenticated: false)
    }

    /// Confirma que o código digitado bate com o que foi enviado por email, sem ainda trocar a
    /// senha — usado no passo intermediário entre "pedir código" e "definir nova senha".
    @discardableResult
    func verifyResetCode(email: String, code: String) async throws -> MessageResponse {
        let body = VerifyResetCodeRequest(email: email, code: code)
        return try await post("/auth/verify-reset-code", body: body, authenticated: false)
    }

    /// Revalida o código e define a nova senha. Em caso de sucesso o backend revoga todas as
    /// sessões existentes — o usuário precisa logar novamente.
    @discardableResult
    func resetPassword(email: String, code: String, newPassword: String) async throws -> MessageResponse {
        let body = ResetPasswordRequest(email: email, code: code, newPassword: newPassword)
        return try await post("/auth/reset-password", body: body, authenticated: false)
    }

    /// `legalConsent`: o usuário aceitou Termos + Privacidade. Obrigatório quando o login cria
    /// uma conta nova — sem ele o backend responde `APIError.legalConsentRequired`.
    func loginWithGoogle(idToken: String, legalConsent: Bool) async throws -> AuthResponse {
        let consent = legalConsent ? true : nil
        let body = GoogleLoginRequest(idToken: idToken, termsAccepted: consent, privacyAccepted: consent)
        let response: AuthResponse = try await post("/auth/google", body: body, authenticated: false)
        try installLoginTokens(access: response.accessToken, refresh: response.refreshToken)
        return response
    }

    func loginWithApple(identityToken: String, fullName: String?, legalConsent: Bool) async throws -> AuthResponse {
        let consent = legalConsent ? true : nil
        let body = AppleLoginRequest(
            identityToken: identityToken,
            fullName: fullName,
            termsAccepted: consent,
            privacyAccepted: consent
        )
        let response: AuthResponse = try await post("/auth/apple", body: body, authenticated: false)
        try installLoginTokens(access: response.accessToken, refresh: response.refreshToken)
        return response
    }

    /// Vincula a conta Apple ao usuário autenticado. Retorna o perfil atualizado.
    func linkApple(identityToken: String) async throws -> UserProfile {
        let body = AppleLoginRequest(identityToken: identityToken, fullName: nil)
        return try await post("/auth/apple/link", body: body)
    }

    /// Desvincula a conta Apple do usuário autenticado. Retorna o perfil atualizado.
    func unlinkApple() async throws -> UserProfile {
        try await delete("/auth/apple/link")
    }

    /// Vincula a conta Google ao usuário autenticado. Retorna o perfil atualizado.
    func linkGoogle(idToken: String) async throws -> UserProfile {
        let body = GoogleLoginRequest(idToken: idToken)
        return try await post("/auth/google/link", body: body)
    }

    /// Desvincula a conta Google do usuário autenticado. Retorna o perfil atualizado.
    func unlinkGoogle() async throws -> UserProfile {
        try await delete("/auth/google/link")
    }

    func getUserProfile() async throws -> UserProfile {
        try await get("/users/me")
    }

    func updateProfile(_ request: UpdateProfileRequest) async throws -> UserProfile {
        try await put("/users/profile", body: request)
    }

    /// Registra o aceite das versões vigentes dos Termos e da Política de Privacidade.
    func acceptLegalConsent() async throws -> UserProfile {
        try await post("/users/me/legal-consent", body: LegalConsentRequest(termsAccepted: true, privacyAccepted: true))
    }

    func getHeartRateZones(session: UUID) async throws -> HeartRateZones {
        guard session == sessionVersion else { throw CancellationError() }
        return try await get("/users/me/heart-rate-zones")
    }

    func syncHeartRateHealth(_ snapshot: HeartRateHealthSnapshot, session: UUID) async throws -> HeartRateZones {
        guard session == sessionVersion else { throw CancellationError() }
        try Task.checkCancellation()
        return try await put("/users/me/heart-rate-health", body: HeartRateHealthRequest(snapshot))
    }

    /// Exclui a conta do usuário e todos os dados relacionados no servidor.
    func deleteAccount() async throws {
        let _: EmptyResponse = try await delete("/users/me")
    }

    // MARK: - Training Plan Endpoints

    /// Backend retorna 200 com body `null` quando o usuário não tem plano; por isso retornamos opcional.
    func getMyTrainingPlan() async throws -> TrainingPlanResponse? {
        try await get("/training-plans/me")
    }

    func getWeeklyGoals(trainingPlanId: String) async throws -> [WeeklyGoalResponse] {
        try await get("/weekly-goals/training-plan/\(trainingPlanId)")
    }

    /// Deleta o plano (cascade no backend). Antes de apagar, o backend captura um laudo das
    /// últimas semanas para brifar a IA na criação do próximo plano.
    func deleteTrainingPlan(_ id: String) async throws {
        let _: EmptyResponse = try await delete("/training-plans/\(id)")
    }

    /// Backend pode retornar 200 com body `null` ou corpo vazio quando não há treino hoje.
    func getTodayWorkout() async throws -> WorkoutModel? {
        let request = try buildRequest(path: "/workouts/today", method: "GET", authenticated: true)
        return try await executeOptional(request)
    }

    func getWorkoutsByTrainingPlan(trainingPlanId: String) async throws -> [WorkoutModel] {
        try await get("/workouts/training-plan/\(trainingPlanId)")
    }

    func completeWorkout(
        workoutId: String,
        appleHealthWorkoutUUID: String? = nil,
        actualDistanceMeters: Double? = nil,
        actualDurationSeconds: Double? = nil,
        executionDetails: DetailedSessionPayload? = nil
    ) async throws -> WorkoutModel {
        let context = try? await PlannerHealthSyncService.shared.capture()
        return try await patchWithBody(
            "/workouts/\(workoutId)/complete",
            body: CompleteWorkoutRequest(appleHealthWorkoutUUID: appleHealthWorkoutUUID,
                                         actualDistanceMeters: actualDistanceMeters,
                                         actualDurationSeconds: actualDurationSeconds,
                                         executionDetails: executionDetails, planningContext: context)
        )
    }

    func skipWorkout(workoutId: String) async throws -> WorkoutModel {
        let context = try? await PlannerHealthSyncService.shared.capture()
        return try await patchWithBody("/workouts/\(workoutId)/skip", body: WorkoutPlanningContextRequest(planningContext: context))
    }

    func syncPlannerHealthContext(_ context: PlannerHealthContextPayload, session expectedSession: UUID? = nil) async throws {
        if let expectedSession { guard expectedSession == sessionVersion else { throw CancellationError() } }
        try Task.checkCancellation()
        struct Response: Decodable { let synced: Bool }
        let _: Response = try await post("/ai-planner/health-context", body: context)
    }

    func resumePlan(retryFailed: Bool = false) async throws -> ResumePlanResponse {
        struct Request: Encodable { let retryFailed: Bool }
        return try await post("/ai-planner/resume", body: Request(retryFailed: retryFailed))
    }

    func latestPlanGeneration() async throws -> AiPlannerGenerationStatusResponse? {
        let request = try buildRequest(path: "/ai-planner/plan-from-health/generations/latest", method: "GET", authenticated: true)
        return try await executeOptional(request)
    }

    /// Desfaz a conclusão de um treino: volta para `scheduled` e limpa, no servidor, a corrida
    /// vinculada, as métricas reais, os detalhes de execução e o feedback.
    func uncompleteWorkout(workoutId: String) async throws -> WorkoutModel {
        try await patch("/workouts/\(workoutId)/uncomplete")
    }

    /// Reagenda um treino para outra data (drag-and-drop no calendário). `newDate` em ISO8601.
    func rescheduleWorkout(workoutId: String, newDate: String) async throws -> WorkoutModel {
        try await put("/workouts/\(workoutId)", body: UpdateWorkoutRequest(date: newDate))
    }

    @discardableResult
    func submitWorkoutFeedback(workoutId: String, feedback: WorkoutFeedbackRequest) async throws -> EmptyResponse {
        try await post("/workouts/\(workoutId)/feedback", body: feedback)
    }

    func planFromHealth(_ request: PlanFromHealthRequest) async throws -> AiPlannerResponse {
        try await post("/ai-planner/plan-from-health", body: request, timeout: 120)
    }

    func startPlanFromHealthGeneration(_ request: PlanFromHealthRequest) async throws -> AiPlannerGenerationStartResponse {
        try await post("/ai-planner/plan-from-health/async", body: request, timeout: 30)
    }

    func getPlanFromHealthGenerationStatus(generationId: String) async throws -> AiPlannerGenerationStatusResponse {
        try await get("/ai-planner/plan-from-health/generations/\(generationId)")
    }

    // MARK: - Remote Notifications

    func registerPushDevice(token: String, environment: String) async throws {
        let _: PushDeviceResponse = try await put(
            "/notifications/devices",
            body: RegisterPushDeviceRequest(token: token, environment: environment)
        )
    }

    func unregisterPushDevice(token: String) async throws {
        let _: EmptyResponse = try await delete("/notifications/devices/\(token)")
    }

    // MARK: - Relógio Garmin (app Connect IQ)

    func listConnectIqDevices() async throws -> [ConnectIqDevice] {
        try await get("/connect-iq/devices")
    }

    /// Confirma o código mostrado no relógio; o relógio recebe o próprio token na consulta seguinte.
    func claimConnectIqPairing(code: String) async throws -> ConnectIqDevice {
        try await post("/connect-iq/pairings/claim", body: ClaimConnectIqPairingRequest(code: code))
    }

    func unpairConnectIqDevice(id: String) async throws {
        let _: EmptyResponse = try await delete("/connect-iq/devices/\(id)")
    }

    // MARK: - Assessment (questionário de onboarding)

    /// Envia o questionário de avaliação (mesmo payload do athly-frontend).
    /// O backend marca `assessmentCompleted = true` no usuário.
    @discardableResult
    func submitAssessment(_ request: AssessmentSubmissionRequest) async throws -> EmptyResponse {
        try await post("/assessment", body: request)
    }

    // MARK: - Billing / Entitlement

    /// Snapshot de entitlement do backend (fonte de verdade do bypass de admin via ADMIN_EMAILS).
    func getEntitlement() async throws -> EntitlementResponse {
        try await get("/billing/entitlement")
    }

    /// Id do usuário Athly decodificado do `sub` do access token (JWT), sem chamada de rede.
    /// Usado para `Purchases.logIn(userId)` (o app_user_id precisa casar com o webhook do RevenueCat).
    func currentUserId() -> String? {
        guard let token = accessToken else { return nil }
        let parts = token.split(separator: ".")
        guard parts.count >= 2 else { return nil }
        var b64 = String(parts[1])
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        while b64.count % 4 != 0 { b64 += "=" }
        guard let data = Data(base64Encoded: b64),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let sub = json["sub"] as? String else { return nil }
        return sub
    }

    // MARK: - Admin Endpoints

    func getAdminWeeklyReport(weeklyGoalId: String) async throws -> AdminWeeklyReportResponse {
        try await get("/weekly-goals/\(weeklyGoalId)/admin-report")
    }

    // MARK: - Goals Endpoints

    func getActiveGoal() async throws -> CreateGoalResponse? {
        let req = try buildRequest(path: "/goals/active", method: "GET", authenticated: true)
        return try await executeOptional(req)
    }

    // MARK: - Token Refresh

    private func refreshTokens(version: UUID) async throws {
        if let refreshTask {
            return try await refreshTask.value
        }
        let task = Task {
            defer { if sessionVersion == version { refreshTask = nil } }
            try await performRefresh(version: version)
        }
        refreshTask = task
        try await task.value
    }

    private func performRefresh(version: UUID) async throws {
        guard let currentRefresh = refreshToken else { throw APIError.unauthorized }
        guard let url = URL(string: baseURL + "/auth/refresh") else { throw APIError.invalidURL }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(RefreshRequest(refreshToken: currentRefresh))
        request.timeoutInterval = 30

        let (data, response) = try await send(request, version: version)
        guard sessionVersion == version else { throw CancellationError() }
        try Task.checkCancellation()
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        if http.statusCode == 401 { throw APIError.unauthorized }
        guard (200...299).contains(http.statusCode) else {
            throw APIError.serverError(http.statusCode, Self.backendMessage(from: data) ?? HTTPURLResponse.localizedString(forStatusCode: http.statusCode))
        }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let tokens = try decoder.decode(SessionTokens.self, from: data)
        // Guarda o par novo em memória mesmo se o Keychain estiver temporariamente indisponível.
        // A próxima requisição tenta persistir novamente antes de usar a sessão.
        accessToken = tokens.accessToken
        refreshToken = tokens.refreshToken
        pendingPersistence = tokens
        try flushPendingTokens()
    }

    private func flushPendingTokens() throws {
        if let tokens = pendingPersistence {
            try persistTokens(tokens)
            pendingPersistence = nil
        }
    }

    private func send(_ request: URLRequest, version: UUID?) async throws -> (Data, URLResponse) {
        do {
            let result = try await transport(request)
            if let version, version != sessionVersion { throw CancellationError() }
            try Task.checkCancellation()
            if let response = result.1 as? HTTPURLResponse, response.statusCode == 400,
               let body = try? JSONDecoder().decode(BackendErrorBody.self, from: result.0),
               let attributes = body.validationAttributes(method: request.httpMethod ?? "GET",
                                                          path: request.url?.path ?? "",
                                                          statusCode: response.statusCode) {
                recordValidationFailure(attributes)
            }
            return result
        } catch {
            if let version, version != sessionVersion { throw CancellationError() }
            throw error
        }
    }

    /// Um único caminho de autenticação para respostas obrigatórias e opcionais.
    private func authenticatedData(for request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let version = sessionVersion
        let authenticated = request.value(forHTTPHeaderField: "Authorization") != nil
        if authenticated { try flushPendingTokens() }
        let (data, response) = try await send(request, version: authenticated ? version : nil)
        if authenticated, version != sessionVersion { throw CancellationError() }
        try Task.checkCancellation()
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard http.statusCode == 401 else { return (data, http) }
        guard authenticated else {
            throw APIError.serverError(401, Self.backendMessage(from: data) ?? String(localized: "Não autorizado"))
        }

        do {
            // Uma resposta atrasada do token antigo aproveita o refresh já concluído.
            if request.value(forHTTPHeaderField: "Authorization") == accessToken.map({ "Bearer \($0)" }) {
                try await refreshTokens(version: version)
            }
        } catch APIError.unauthorized {
            guard version == sessionVersion else { throw CancellationError() }
            notifySessionExpired(version: version)
            throw APIError.unauthorized
        }
        guard version == sessionVersion else { throw CancellationError() }
        try Task.checkCancellation()
        try flushPendingTokens()
        guard let token = accessToken else { throw APIError.unauthorized }
        var retry = request
        retry.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (retryData, retryResponse) = try await send(retry, version: version)
        guard version == sessionVersion else { throw CancellationError() }
        try Task.checkCancellation()
        guard let retryHTTP = retryResponse as? HTTPURLResponse else { throw APIError.invalidResponse }
        if retryHTTP.statusCode == 401 {
            notifySessionExpired(version: version)
            throw APIError.unauthorized
        }
        return (retryData, retryHTTP)
    }

    // MARK: - HTTP

    private func get<T: Decodable>(_ path: String, authenticated: Bool = true) async throws -> T {
        let request = try buildRequest(path: path, method: "GET", authenticated: authenticated)
        return try await execute(request)
    }

    private func post<B: Encodable, T: Decodable>(_ path: String, body: B, authenticated: Bool = true, timeout: TimeInterval = 30) async throws -> T {
        var request = try buildRequest(path: path, method: "POST", authenticated: authenticated, timeout: timeout)
        request.httpBody = try JSONEncoder().encode(body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return try await execute(request)
    }

    private func put<B: Encodable, T: Decodable>(_ path: String, body: B, authenticated: Bool = true) async throws -> T {
        var request = try buildRequest(path: path, method: "PUT", authenticated: authenticated)
        request.httpBody = try JSONEncoder().encode(body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return try await execute(request)
    }

    private func patch<T: Decodable>(_ path: String, authenticated: Bool = true) async throws -> T {
        var request = try buildRequest(path: path, method: "PATCH", authenticated: authenticated)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return try await execute(request)
    }

    private func patchWithBody<B: Encodable, T: Decodable>(_ path: String, body: B, authenticated: Bool = true) async throws -> T {
        var request = try buildRequest(path: path, method: "PATCH", authenticated: authenticated)
        request.httpBody = try JSONEncoder().encode(body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return try await execute(request)
    }

    private func delete<T: Decodable>(_ path: String, authenticated: Bool = true) async throws -> T {
        let request = try buildRequest(path: path, method: "DELETE", authenticated: authenticated)
        return try await execute(request)
    }

    private func buildRequest(path: String, method: String, authenticated: Bool, timeout: TimeInterval = 30) throws -> URLRequest {
        guard let url = URL(string: baseURL + path) else {
            throw APIError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = timeout

        // Correlation headers — backend logs these to link iOS spans ↔ server request logs
        request.setValue(OTelClient.sessionId, forHTTPHeaderField: "X-Athly-Session-Id")
        if let traceId = OTelClient.currentTraceId {
            request.setValue(traceId, forHTTPHeaderField: "X-Athly-Trace-Id")
        }

        if authenticated {
            guard let token = accessToken else {
                throw APIError.unauthorized
            }
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return request
    }

    private func execute<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, httpResponse) = try await authenticatedData(for: request)

        switch httpResponse.statusCode {
        case 200...299:
            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase
            decoder.dateDecodingStrategy = .iso8601
            let decodableData = data.isEmpty ? Data("null".utf8) : data
            do {
                return try decoder.decode(T.self, from: decodableData)
            } catch {
                let raw = String(data: decodableData, encoding: .utf8) ?? ""
                print("[APIClient] Decode failed for \(T.self): \(error)")
                if let de = error as? DecodingError {
                    switch de {
                    case .keyNotFound(let key, let ctx): print("[APIClient] keyNotFound: \(key.stringValue) – \(ctx.debugDescription)")
                    case .typeMismatch(let type, let ctx): print("[APIClient] typeMismatch: \(type) – \(ctx.debugDescription)")
                    case .valueNotFound(let type, let ctx): print("[APIClient] valueNotFound: \(type) – \(ctx.debugDescription)")
                    case .dataCorrupted(let ctx): print("[APIClient] dataCorrupted – \(ctx.debugDescription)")
                    @unknown default: break
                    }
                }
                print("[APIClient] Response snippet: \(raw.prefix(800))...")
                throw error
            }
        case 404:
            throw APIError.notFound
        default:
            if Self.backendCode(from: data) == BackendErrorCode.legalConsentRequired {
                throw APIError.legalConsentRequired
            }
            let message = Self.backendMessage(from: data)
                ?? String(data: data, encoding: .utf8)
                ?? String(localized: "Unknown error")
            throw APIError.serverError(httpResponse.statusCode, message)
        }
    }

    /// Versão do execute que retorna nil em vez de throw para 404 e resposta vazia.
    private func executeOptional<T: Decodable>(_ request: URLRequest) async throws -> T? {
        let (data, httpResponse) = try await authenticatedData(for: request)

        switch httpResponse.statusCode {
        case 200...299:
            if data.isEmpty { return nil }
            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase
            decoder.dateDecodingStrategy = .iso8601
            return try? decoder.decode(T.self, from: data)
        case 404:
            return nil
        default:
            if Self.backendCode(from: data) == BackendErrorCode.legalConsentRequired {
                throw APIError.legalConsentRequired
            }
            let message = Self.backendMessage(from: data)
                ?? String(data: data, encoding: .utf8)
                ?? String(localized: "Unknown error")
            throw APIError.serverError(httpResponse.statusCode, message)
        }
    }
}

// MARK: - Request/Response Models

struct LoginRequest: Encodable {
    let email: String
    let password: String
}

struct RegisterRequest: Encodable {
    let email: String
    let password: String
    let termsAccepted: Bool
    let privacyAccepted: Bool
}

struct LegalConsentRequest: Encodable {
    let termsAccepted: Bool
    let privacyAccepted: Bool
}

struct AuthResponse: Decodable {
    let accessToken: String
    let refreshToken: String
}

struct ForgotPasswordRequest: Encodable {
    let email: String
}

struct VerifyResetCodeRequest: Encodable {
    let email: String
    let code: String
}

struct ResetPasswordRequest: Encodable {
    let email: String
    let code: String
    let newPassword: String
}

struct MessageResponse: Decodable {
    let message: String
}

// Aceite legal opcional: `nil` não é enviado (login de conta existente).
struct GoogleLoginRequest: Encodable {
    let idToken: String
    var termsAccepted: Bool? = nil
    var privacyAccepted: Bool? = nil
}

struct AppleLoginRequest: Encodable {
    let identityToken: String
    let fullName: String?
    var termsAccepted: Bool? = nil
    var privacyAccepted: Bool? = nil
}

struct RefreshRequest: Encodable {
    let refreshToken: String
}

struct RefreshResponse: Decodable {
    let accessToken: String
    let refreshToken: String
}

struct CompleteWorkoutRequest: Encodable {
    let appleHealthWorkoutUUID: String?
    let actualDistanceMeters: Double?
    let actualDurationSeconds: Double?
    let executionDetails: DetailedSessionPayload?
    let planningContext: PlannerHealthContextPayload?

    enum CodingKeys: String, CodingKey {
        case appleHealthWorkoutUUID = "appleHealthWorkoutUUID"
        case actualDistanceMeters
        case actualDurationSeconds
        case executionDetails
        case planningContext
    }
}

private struct RegisterPushDeviceRequest: Encodable {
    let token: String
    let environment: String
}

private struct PushDeviceResponse: Decodable {
    let id: String
    let environment: String
}

// MARK: - Assessment payload v2 (espelha SubmitAssessmentDto do backend)

struct AssessmentSubmissionRequest: Encodable, Sendable {
    // P1 — Informações
    var gender: String?
    var weight: Double?
    var height: Double?
    var restingHeartRate: Int?
    var maxHeartRate: Int?
    // P2 — Motivação
    var motivations: [String] = []
    // P3 — Frequência
    var runningFrequency: String?
    // P4 — Nível
    var fitnessLevel: String?
    // P5 — Pace (seconds/km, e.g. 345 = 5:45/km)
    var comfortPaceSeconds: Int?
    // P6 — Objetivos
    var objective: String?
    var objectiveDistance: String?
    var objectiveType: String?
    var targetTime: String?
    // P9 — Dias disponíveis para treinar (chaves em inglês: monday…sunday)
    var availableDays: [String] = []
    // Required by backend
    var termsAccepted: Bool = true
}

struct EntitlementResponse: Decodable, Sendable {
    let entitled: Bool
    let isAdmin: Bool
    let isFounderEligible: Bool?
    /// Fim do trial backend (ISO). Null quando não aplicável (admin, assinante ou expirado).
    let trialEndsAt: String?
    /// Dias restantes do trial backend. Null quando não aplicável.
    let trialDaysRemaining: Int?
}

struct UserProfile: Decodable {
    let id: String
    let name: String?
    let username: String?
    let email: String
    let gender: String?
    let dateOfBirth: String?
    let weight: Double?
    let height: Double?
    let availableDays: [String]?
    let fitnessLevel: String?
    let restingHeartRate: Int?
    let maxHeartRate: Int?
    let assessmentCompleted: Bool?
    let appleLinked: Bool?
    let googleLinked: Bool?
    let hasPassword: Bool?
    /// `true` → falta aceite (ou é de versão antiga) dos Termos/Privacidade: bloqueia o app.
    let legalConsentRequired: Bool?
}

// MARK: - Errors

enum APIError: LocalizedError {
    case invalidURL
    case unauthorized
    case notFound
    case invalidResponse
    /// Login social que criaria uma conta nova sem aceite de Termos/Privacidade.
    case legalConsentRequired
    case serverError(Int, String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return String(localized: "URL inválida")
        case .unauthorized: return String(localized: "Sessão expirada. Faça login novamente.")
        case .notFound: return String(localized: "Recurso não encontrado")
        case .invalidResponse: return String(localized: "Resposta inválida do servidor")
        case .legalConsentRequired:
            return BackendErrorCode.localizedMessage(for: BackendErrorCode.legalConsentRequired)
        case .serverError(_, let msg):
            let message = msg.trimmingCharacters(in: .whitespacesAndNewlines)
            return message.isEmpty
                ? String(localized: "Não foi possível concluir esta ação. Tente novamente mais tarde.")
                : message
        }
    }
}

private struct WorkoutPlanningContextRequest: Encodable {
    let planningContext: PlannerHealthContextPayload?
}
