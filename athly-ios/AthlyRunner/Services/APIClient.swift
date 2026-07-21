import Foundation

extension Notification.Name {
    static let athlyTokensRefreshed = Notification.Name("athlyTokensRefreshed")
    /// Emitida quando a sessão é definitivamente rejeitada pelo backend (401 e o refresh falhou).
    /// O `AuthViewModel` escuta para deslogar e redirecionar para a tela de login.
    static let athlySessionExpired = Notification.Name("athlySessionExpired")
    /// Emitida pelo `AuthViewModel` em login/registro/restauração (authenticated=true) e logout
    /// (false). O `EntitlementManager` escuta para fazer `Purchases.logIn(userId)`/`logOut()`.
    static let athlyAuthChanged = Notification.Name("athlyAuthChanged")
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
    private var isRefreshing = false

    private init() {}

    // MARK: - Auth

    func setTokens(access: String, refresh: String) {
        self.accessToken = access
        self.refreshToken = refresh
    }

    func clearTokens() {
        accessToken = nil
        refreshToken = nil
    }

    /// Avisa que a sessão morreu de vez (401 + refresh falhou). Ponto único para o app reagir
    /// (logout + redirect ao login), independente de o chamador engolir o erro lançado.
    private func notifySessionExpired() {
        NotificationCenter.default.post(name: .athlySessionExpired, object: nil)
    }

    /// Extrai a mensagem de erro do corpo padrão do NestJS: `{ "message": string | string[] }`.
    private static func backendMessage(from data: Data) -> String? {
        guard !data.isEmpty else { return nil }

        struct BackendError: Decodable {
            let message: Message?
            enum Message: Decodable {
                case single(String)
                case multiple([String])
                init(from decoder: Decoder) throws {
                    let container = try decoder.singleValueContainer()
                    if let text = try? container.decode(String.self) {
                        self = .single(text)
                    } else {
                        self = .multiple((try? container.decode([String].self)) ?? [])
                    }
                }
                var text: String {
                    switch self {
                    case .single(let value): return value
                    case .multiple(let values): return values.joined(separator: "\n")
                    }
                }
            }
        }

        let text = (try? JSONDecoder().decode(BackendError.self, from: data))?.message?.text
        return (text?.isEmpty == false) ? text : nil
    }

    var isAuthenticated: Bool {
        accessToken != nil
    }

    // MARK: - Auth Endpoints

    func login(email: String, password: String) async throws -> AuthResponse {
        let body = LoginRequest(email: email, password: password)
        let response: AuthResponse = try await post("/auth/login", body: body, authenticated: false)
        setTokens(access: response.accessToken, refresh: response.refreshToken)
        return response
    }

    func register(email: String, name: String, password: String, confirmPassword: String, dateOfBirth: String, weight: Double, height: Double) async throws -> AuthResponse {
        let body = RegisterRequest(email: email, name: name, password: password, confirmPassword: confirmPassword, dateOfBirth: dateOfBirth, weight: weight, height: height)
        let response: AuthResponse = try await post("/auth/register", body: body, authenticated: false)
        setTokens(access: response.accessToken, refresh: response.refreshToken)
        return response
    }

    func loginWithGoogle(idToken: String) async throws -> AuthResponse {
        let body = GoogleLoginRequest(idToken: idToken)
        let response: AuthResponse = try await post("/auth/google", body: body, authenticated: false)
        setTokens(access: response.accessToken, refresh: response.refreshToken)
        return response
    }

    func loginWithApple(identityToken: String, fullName: String?) async throws -> AuthResponse {
        let body = AppleLoginRequest(identityToken: identityToken, fullName: fullName)
        let response: AuthResponse = try await post("/auth/apple", body: body, authenticated: false)
        setTokens(access: response.accessToken, refresh: response.refreshToken)
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
        if appleHealthWorkoutUUID != nil || actualDistanceMeters != nil || actualDurationSeconds != nil {
            return try await patchWithBody(
                "/workouts/\(workoutId)/complete",
                body: CompleteWorkoutRequest(
                    appleHealthWorkoutUUID: appleHealthWorkoutUUID,
                    actualDistanceMeters: actualDistanceMeters,
                    actualDurationSeconds: actualDurationSeconds,
                    executionDetails: executionDetails
                )
            )
        }
        return try await patch("/workouts/\(workoutId)/complete")
    }

    func skipWorkout(workoutId: String) async throws -> WorkoutModel {
        try await patch("/workouts/\(workoutId)/skip")
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

    func createGoal(_ request: CreateGoalRequest) async throws -> CreateGoalResponse {
        try await post("/goals", body: request)
    }

    func getActiveGoal() async throws -> CreateGoalResponse? {
        let req = try buildRequest(path: "/goals/active", method: "GET", authenticated: true)
        return try await executeOptional(req)
    }

    // MARK: - Token Refresh

    private func refreshTokens() async throws {
        guard let currentRefresh = refreshToken else {
            throw APIError.unauthorized
        }

        let body = RefreshRequest(refreshToken: currentRefresh)
        guard let url = URL(string: baseURL + "/auth/refresh") else {
            throw APIError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        request.timeoutInterval = 30

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw APIError.unauthorized
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let refreshResponse = try decoder.decode(RefreshResponse.self, from: data)

        setTokens(access: refreshResponse.accessToken, refresh: refreshResponse.refreshToken)

        let userInfo: [String: String] = [
            "accessToken": refreshResponse.accessToken,
            "refreshToken": refreshResponse.refreshToken
        ]
        NotificationCenter.default.post(name: .athlyTokensRefreshed, object: nil, userInfo: userInfo)
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
        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

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
        case 401:
            // Requisições não autenticadas (login/registro/apple/google) não têm Authorization:
            // não tentam refresh nem sinalizam "sessão expirada" — mostram o motivo real do backend
            // (ex.: "Token da Apple inválido", "Login com Apple não está configurado").
            guard request.value(forHTTPHeaderField: "Authorization") != nil else {
                throw APIError.serverError(401, Self.backendMessage(from: data) ?? "Não autorizado")
            }
            if !isRefreshing {
                isRefreshing = true
                defer { isRefreshing = false }
                do {
                    try await refreshTokens()
                    var retryRequest = request
                    if let token = accessToken {
                        retryRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                    }
                    let (retryData, retryResponse) = try await URLSession.shared.data(for: retryRequest)
                    guard let retryHttp = retryResponse as? HTTPURLResponse else {
                        throw APIError.invalidResponse
                    }
                    if (200...299).contains(retryHttp.statusCode) {
                        let decoder = JSONDecoder()
                        decoder.keyDecodingStrategy = .convertFromSnakeCase
                        decoder.dateDecodingStrategy = .iso8601
                        let decodableData = retryData.isEmpty ? Data("null".utf8) : retryData
                        return try decoder.decode(T.self, from: decodableData)
                    }
                } catch {
                    notifySessionExpired()
                    throw APIError.unauthorized
                }
            }
            throw APIError.unauthorized
        case 404:
            throw APIError.notFound
        default:
            let message = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw APIError.serverError(httpResponse.statusCode, message)
        }
    }

    /// Versão do execute que retorna nil em vez de throw para 404 e resposta vazia.
    private func executeOptional<T: Decodable>(_ request: URLRequest) async throws -> T? {
        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            if data.isEmpty { return nil }
            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase
            decoder.dateDecodingStrategy = .iso8601
            return try? decoder.decode(T.self, from: data)
        case 404:
            return nil
        case 401:
            guard request.value(forHTTPHeaderField: "Authorization") != nil else {
                throw APIError.serverError(401, Self.backendMessage(from: data) ?? "Não autorizado")
            }
            if !isRefreshing {
                isRefreshing = true
                defer { isRefreshing = false }
                do {
                    try await refreshTokens()
                    var retryRequest = request
                    if let token = accessToken {
                        retryRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                    }
                    let (retryData, retryResponse) = try await URLSession.shared.data(for: retryRequest)
                    guard let retryHttp = retryResponse as? HTTPURLResponse else {
                        throw APIError.invalidResponse
                    }
                    if (200...299).contains(retryHttp.statusCode) {
                        if retryData.isEmpty { return nil }
                        let decoder = JSONDecoder()
                        decoder.keyDecodingStrategy = .convertFromSnakeCase
                        decoder.dateDecodingStrategy = .iso8601
                        return try? decoder.decode(T.self, from: retryData)
                    }
                    if retryHttp.statusCode == 404 { return nil }
                } catch {
                    notifySessionExpired()
                    throw APIError.unauthorized
                }
            }
            throw APIError.unauthorized
        default:
            let message = String(data: data, encoding: .utf8) ?? "Unknown error"
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
    let name: String
    let password: String
    let confirmPassword: String
    let dateOfBirth: String
    let weight: Double
    let height: Double
}

struct AuthResponse: Decodable {
    let accessToken: String
    let refreshToken: String
}

struct GoogleLoginRequest: Encodable {
    let idToken: String
}

struct AppleLoginRequest: Encodable {
    let identityToken: String
    let fullName: String?
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

    enum CodingKeys: String, CodingKey {
        case appleHealthWorkoutUUID = "appleHealthWorkoutUUID"
        case actualDistanceMeters
        case actualDurationSeconds
        case executionDetails
    }
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
    let dateOfBirth: String?
    let weight: Double?
    let height: Double?
    let availableDays: [String]?
    let assessmentCompleted: Bool?
    let appleLinked: Bool?
    let googleLinked: Bool?
    let hasPassword: Bool?
}

// MARK: - Errors

enum APIError: LocalizedError {
    case invalidURL
    case unauthorized
    case notFound
    case invalidResponse
    case serverError(Int, String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "URL inválida"
        case .unauthorized: return "Sessão expirada. Faça login novamente."
        case .notFound: return "Recurso não encontrado"
        case .invalidResponse: return "Resposta inválida do servidor"
        case .serverError(let code, let msg): return "Erro \(code): \(msg)"
        }
    }
}
