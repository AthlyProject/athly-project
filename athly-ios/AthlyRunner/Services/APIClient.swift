import Foundation

actor APIClient {
    static let shared = APIClient()

    #if targetEnvironment(simulator)
    private var baseURL: String = "http://localhost:4000"
    #else
    private var baseURL: String = "https://athly-project-production.up.railway.app"
    #endif
    private var accessToken: String?
    private var refreshToken: String?

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

    func register(email: String, userName: String, name: String, password: String, confirmPassword: String, dateOfBirth: String, weight: Double, height: Double) async throws -> AuthResponse {
        let body = RegisterRequest(email: email, userName: userName, name: name, password: password, confirmPassword: confirmPassword, dateOfBirth: dateOfBirth, weight: weight, height: height)
        let response: AuthResponse = try await post("/auth/register", body: body, authenticated: false)
        setTokens(access: response.accessToken, refresh: response.refreshToken)
        return response
    }

    // MARK: - Run Endpoints

    func saveRun(_ run: SaveRunRequest) async throws -> SaveRunResponse {
        try await post("/workouts", body: run)
    }

    func getRunHistory() async throws -> [WorkoutResponse] {
        try await get("/workouts/history")
    }

    func getUserProfile() async throws -> UserProfile {
        try await get("/users/me")
    }

    // MARK: - Training Plan Endpoints

    /// Backend retorna 200 com body `null` quando o usuário não tem plano; por isso retornamos opcional.
    func getMyTrainingPlan() async throws -> TrainingPlanResponse? {
        try await get("/training-plans/me")
    }

    func getWeeklyGoals(trainingPlanId: String) async throws -> [WeeklyGoalResponse] {
        try await get("/weekly-goals/training-plan/\(trainingPlanId)")
    }

    /// Backend pode retornar 200 com body `null` ou corpo vazio quando não há treino hoje.
    func getTodayWorkout() async throws -> WorkoutModel? {
        let request = try buildRequest(path: "/workouts/today", method: "GET", authenticated: true)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        switch httpResponse.statusCode {
        case 200...299:
            if data.isEmpty { return nil }
            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode(WorkoutModel?.self, from: data)
        case 404:
            return nil
        case 401:
            throw APIError.unauthorized
        default:
            let message = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw APIError.serverError(httpResponse.statusCode, message)
        }
    }

    func getWorkoutsByTrainingPlan(trainingPlanId: String) async throws -> [WorkoutModel] {
        try await get("/workouts/training-plan/\(trainingPlanId)")
    }

    func completeWorkout(workoutId: String) async throws -> WorkoutModel {
        try await patch("/workouts/\(workoutId)/complete")
    }

    func skipWorkout(workoutId: String) async throws -> WorkoutModel {
        try await patch("/workouts/\(workoutId)/skip")
    }

    func planNextWeek(_ request: PlanNextWeekRequest) async throws -> PlanNextWeekResponse {
        try await post("/ai-planner/plan-next-week", body: request)
    }

    func planFromHealth(_ request: PlanFromHealthRequest) async throws -> AiPlannerResponse {
        try await post("/ai-planner/plan-from-health", body: request)
    }

    // MARK: - HTTP

    private func get<T: Decodable>(_ path: String, authenticated: Bool = true) async throws -> T {
        let request = try buildRequest(path: path, method: "GET", authenticated: authenticated)
        return try await execute(request)
    }

    private func post<B: Encodable, T: Decodable>(_ path: String, body: B, authenticated: Bool = true) async throws -> T {
        var request = try buildRequest(path: path, method: "POST", authenticated: authenticated)
        request.httpBody = try JSONEncoder().encode(body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return try await execute(request)
    }

    private func patch<T: Decodable>(_ path: String, authenticated: Bool = true) async throws -> T {
        var request = try buildRequest(path: path, method: "PATCH", authenticated: authenticated)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return try await execute(request)
    }

    private func buildRequest(path: String, method: String, authenticated: Bool) throws -> URLRequest {
        guard let url = URL(string: baseURL + path) else {
            throw APIError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 30

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
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                let raw = String(data: data, encoding: .utf8) ?? ""
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
            throw APIError.unauthorized
        case 404:
            throw APIError.notFound
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
    let userName: String
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

struct SaveRunRequest: Encodable {
    let sportType: String
    let dateScheduled: String
    let duration: Double
    let distance: Double
    let elevationGain: Double
    let calories: Double
    let averagePace: Double
    let routePoints: [[String: Double]]
    let splits: [SplitRequest]
}

struct SplitRequest: Encodable {
    let kilometer: Int
    let durationSeconds: Double
    let elevationDelta: Double
}

struct SaveRunResponse: Decodable {
    let id: String
}

struct WorkoutResponse: Decodable {
    let id: String
    let sportType: String?
    let dateScheduled: String?
    let status: String?
}

struct UserProfile: Decodable {
    let id: String
    let name: String?
    let email: String
    let weight: Double?
    let height: Double?
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
