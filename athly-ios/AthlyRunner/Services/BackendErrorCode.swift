import Foundation

/// Corpo de erro da API: `{ statusCode, error, code, message, errors? }`.
///
/// `code` é o identificador estável definido em `athly-backend/src/common/errors/error-codes.ts`;
/// `message` é o texto pt-BR do servidor, usado como fallback quando o código é desconhecido
/// (app antigo contra backend novo, ou erro sem código ainda).
struct BackendErrorBody: Decodable {
    let code: String?
    let message: BackendErrorMessage?
    /// Detalhe por campo nos 400 de validação (`code` == `VALIDATION_FAILED`).
    let errors: [FieldError]?

    struct FieldError: Decodable {
        let field: String?
        let constraint: String?
        let code: String?
        let message: String?
    }
}

/// O Nest manda `message` como string nos erros de negócio e como `[String]` nos de validação.
enum BackendErrorMessage: Decodable {
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
        values.joined(separator: "\n")
    }

    var values: [String] {
        switch self {
        case .single(let value): return [value]
        case .multiple(let values): return values
        }
    }
}

extension BackendErrorBody {
    /// Texto pronto para exibir, já no idioma do app.
    ///
    /// Ordem: erros de validação campo a campo → código de negócio → texto do servidor. O
    /// fallback importa: um código novo no backend não pode virar tela em branco no app.
    var localizedText: String? {
        if hasUnknownProperties {
            return String(localized: "Não foi possível concluir esta ação devido a uma incompatibilidade com o servidor. Tente novamente mais tarde.")
        }
        if let fieldErrors = errors, !fieldErrors.isEmpty {
            let lines = fieldErrors.compactMap { fieldError -> String? in
                fieldError.code.flatMap(BackendErrorCode.localizedMessage) ?? fieldError.message
            }
            if let summary = Self.summary(lines) { return summary }
        }

        if let localized = code.flatMap(BackendErrorCode.localizedMessage) {
            return localized
        }

        if isValidationFailure { return Self.summary(message?.values ?? []) }
        let fallback = message?.text.trimmingCharacters(in: .whitespacesAndNewlines)
        return (fallback?.isEmpty == false) ? fallback : nil
    }

    private var isValidationFailure: Bool {
        if code == "VALIDATION_FAILED" || errors?.isEmpty == false || hasUnknownProperties { return true }
        if case .multiple = message { return true }
        return false
    }

    private var hasUnknownProperties: Bool {
        if errors?.contains(where: {
            $0.constraint == "whitelistValidation" || $0.code?.hasSuffix("_WHITELIST_VALIDATION") == true
        }) == true { return true }
        // Older Nest responses only contain messages, sometimes prefixed with array paths.
        let lines = (message?.values ?? []) + (errors?.compactMap(\.message) ?? [])
        return lines.contains {
            $0.range(of: #"(?:^|[.\s])property\s+\S+\s+should not exist\s*$"#,
                     options: .regularExpression) != nil
        }
    }

    private static func summary(_ values: [String]) -> String? {
        var seen = Set<String>()
        let lines = values.flatMap { $0.components(separatedBy: .newlines) }
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty && seen.insert($0).inserted }
        return lines.isEmpty ? nil : lines.prefix(3).joined(separator: "\n")
    }

    /// Only structural metadata goes to telemetry; messages can contain submitted values.
    func validationAttributes(method: String, path: String, statusCode: Int) -> [String: String]? {
        guard statusCode == 400, isValidationFailure else { return nil }
        func identifiers(_ values: [String]) -> String {
            Array(Set(values.filter {
                $0.count <= 120 && $0.range(of: #"^[A-Za-z_][A-Za-z0-9_.]*$"#,
                                            options: .regularExpression) != nil
            })).sorted().prefix(12).joined(separator: ",")
        }
        let fieldErrors = errors ?? []
        let fields = fieldErrors.compactMap(\.field).map {
            $0.split(separator: ".").filter { Int($0) == nil }.joined(separator: ".")
        }
        return [
            "http.request.method": method,
            "http.route": Self.normalizedRoute(path),
            "http.response.status_code": String(statusCode),
            "validation.code": "VALIDATION_FAILED",
            "validation.error_count": String(fieldErrors.isEmpty ? message?.values.count ?? 0 : fieldErrors.count),
            "validation.codes": identifiers(fieldErrors.compactMap(\.code)),
            "validation.fields": identifiers(fields),
            "validation.constraints": identifiers(fieldErrors.compactMap(\.constraint)),
            "validation.unknown_properties": String(hasUnknownProperties),
        ]
    }

    private static func normalizedRoute(_ path: String) -> String {
        // Explicit templates avoid leaking IDs, query strings or unexpected URL contents.
        let routes = [
            "/ai-planner/health-context", "/ai-planner/plan-from-health", "/ai-planner/plan-from-health/async",
            "/ai-planner/resume", "/ai-planner/plan-from-health/generations/latest",
            "/ai-planner/plan-from-health/generations/:id",
            "/workouts/today", "/workouts/training-plan/:id", "/workouts/:id",
            "/workouts/:id/complete", "/workouts/:id/skip", "/workouts/:id/uncomplete", "/workouts/:id/feedback",
            "/training-plans/me", "/training-plans/:id", "/weekly-goals/training-plan/:id", "/weekly-goals/:id/admin-report",
            "/users/me", "/users/profile", "/users/me/heart-rate-health", "/users/me/heart-rate-zones", "/goals/active",
            "/auth/login", "/auth/register", "/auth/refresh", "/auth/google", "/auth/apple",
            "/auth/forgot-password", "/auth/verify-reset-code", "/auth/reset-password",
            "/auth/apple/link", "/auth/google/link",
        ]
        let parts = path.split(separator: "/")
        return routes.first { route in
            let template = route.split(separator: "/")
            return parts.count == template.count && zip(parts, template).allSatisfy { $1 == ":id" || $0 == $1 }
        } ?? "/unknown"
    }
}

/// Tradução dos códigos do backend para as strings do catálogo do app.
///
/// A tradução mora aqui (e não no servidor) para ficar junto do resto das strings da UI, no
/// mesmo `Localizable.xcstrings`. Um código sem entrada nesta tabela cai no `message` do
/// servidor — só códigos que o app realmente mostra ao usuário precisam estar aqui.
enum BackendErrorCode {
    /// Login social que criaria uma conta nova sem aceite de Termos/Privacidade — o app pede o
    /// aceite e reenvia o login (ver `APIError.legalConsentRequired`).
    static let legalConsentRequired = "AUTH_LEGAL_CONSENT_REQUIRED"

    static func localizedMessage(for code: String) -> String? {
        switch code {

        // MARK: Autenticação

        case "AUTH_INVALID_CREDENTIALS":
            return String(localized: "Credenciais inválidas")
        case "AUTH_EMAIL_ALREADY_REGISTERED":
            return String(localized: "Email já cadastrado")
        case "AUTH_SOCIAL_ACCOUNT_NO_PASSWORD":
            return String(localized: "Esta conta usa login social. Entre com Apple ou Google.")
        case "AUTH_SOCIAL_ACCOUNT_UNIDENTIFIED":
            return String(localized: "Não foi possível identificar a conta. Tente novamente.")
        case "AUTH_RESET_CODE_INVALID":
            return String(localized: "Código inválido ou expirado")
        case "AUTH_REFRESH_TOKEN_INVALID", "AUTH_REFRESH_TOKEN_EXPIRED":
            return String(localized: "Sessão expirada. Faça login novamente.")
        case "AUTH_GOOGLE_NOT_CONFIGURED":
            return String(localized: "O login com Google não está disponível no momento.")
        case "AUTH_GOOGLE_TOKEN_INVALID":
            return String(localized: "Não foi possível validar seu login com o Google. Tente novamente.")
        case "AUTH_GOOGLE_ALREADY_LINKED":
            return String(localized: "Esta conta Google já está vinculada a outro usuário.")
        case "AUTH_APPLE_NOT_CONFIGURED":
            return String(localized: "O login com Apple não está disponível no momento.")
        case "AUTH_APPLE_TOKEN_INVALID":
            return String(localized: "Não foi possível validar seu login com a Apple. Tente novamente.")
        case "AUTH_APPLE_ALREADY_LINKED":
            return String(localized: "Esta conta Apple já está vinculada a outro usuário.")
        case "AUTH_LAST_CREDENTIAL":
            return String(localized: "Defina uma senha ou vincule outra conta antes de desvincular esta.")
        case "AUTH_ADMIN_ACCESS_DENIED":
            return String(localized: "Acesso restrito.")
        case legalConsentRequired:
            return String(localized: "Aceite os Termos de Uso e a Política de Privacidade para criar sua conta.")
        case "USER_NOT_FOUND":
            return String(localized: "Usuário não encontrado")
        case "HEART_RATE_RANGE_INVALID":
            return String(localized: "Revise a FC de repouso e a FC máxima: os valores precisam formar cinco zonas válidas.")
        case "HEART_RATE_HEALTH_INVALID":
            return String(localized: "Dados de frequência cardíaca inválidos ou desatualizados.")

        // MARK: Assinatura

        case "BILLING_SUBSCRIPTION_REQUIRED":
            return String(localized: "Assinatura necessária. Inicie ou renove sua assinatura para continuar.")

        // MARK: Avaliação

        case "ASSESSMENT_TERMS_NOT_ACCEPTED":
            return String(localized: "Você precisa aceitar os termos para continuar.")
        case "ASSESSMENT_PLAN_GENERATION_IN_PROGRESS":
            return String(localized: "Seu plano está sendo gerado. Aguarde a conclusão antes de iniciar uma nova avaliação.")

        // MARK: Treinos

        case "WORKOUT_DATE_OCCUPIED":
            return String(localized: "Já existe um treino neste dia. Escolha um dia vazio.")
        case "WORKOUT_NOT_RESCHEDULABLE":
            return String(localized: "Só é possível reagendar treinos agendados.")
        case "WORKOUT_NOT_FOUND":
            return String(localized: "Treino não encontrado")
        case "WORKOUT_FEEDBACK_FAILED":
            return String(localized: "Não foi possível salvar seu feedback. Tente novamente.")
        case "WORKOUT_COMPLETE_FAILED":
            return String(localized: "Não foi possível concluir o treino. Tente novamente mais tarde.")
        case "EQUIPMENT_NOT_FOUND":
            return String(localized: "Equipamento não encontrado")

        // MARK: Plano de treino

        case "WEEKLY_GOAL_NOT_FOUND":
            return String(localized: "Meta semanal não encontrada")
        case "TRAINING_PLAN_NOT_FOUND":
            return String(localized: "Plano de treino não encontrado")
        case "TRAINING_PLAN_ALREADY_EXISTS":
            return String(localized: "Você já tem um plano de treino. Atualize ou exclua o atual antes de criar outro.")
        case "TRAINING_PLAN_LOCKED":
            return String(localized: "Este plano de treino está bloqueado e não pode ser alterado.")
        case "TRAINING_PLAN_CLOSED":
            return String(localized: "Este plano de treino foi encerrado. Exclua-o e crie um novo para gerar um plano.")
        case "WEEKLY_PLAN_ALREADY_EXISTS":
            return String(localized: "Já existe um plano para esta semana. Exclua a semana atual e seus treinos antes de gerar de novo.")
        case "WEEKLY_PLAN_GENERATION_IN_PROGRESS":
            return String(localized: "Uma geração para esta semana já está em andamento.")

        // MARK: Geração por IA

        case "PLAN_GENERATION_NOT_FOUND":
            return String(localized: "Geração não encontrada")
        case "AI_UNAVAILABLE":
            return String(localized: "A geração de planos está indisponível no momento. Tente novamente mais tarde.")
        case "AI_PLAN_GENERATION_FAILED":
            return String(localized: "Não foi possível gerar seu plano agora. Tente novamente.")

        // MARK: Relógio Garmin

        case "CIQ_PAIRING_CODE_INVALID":
            return String(localized: "Código inválido ou expirado. Confira o código no relógio.")
        case "CIQ_PAIRING_RATE_LIMITED":
            return String(localized: "Muitas tentativas. Aguarde alguns minutos e tente de novo.")
        case "CIQ_DEVICE_LIMIT_REACHED":
            return String(localized: "Você já tem 5 relógios conectados. Desconecte um para continuar.")

        // MARK: Validação de payload
        //
        // Códigos derivados de campo + constraint do class-validator, ver
        // `athly-backend/src/common/errors/validation-exception.factory.ts`. `password` e
        // `newPassword` são a mesma regra em endpoints diferentes.

        case "VALIDATION_EMAIL_IS_EMAIL":
            return String(localized: "Email inválido")
        case "VALIDATION_EMAIL_IS_NOT_EMPTY":
            return String(localized: "Email é obrigatório")
        case "VALIDATION_PASSWORD_IS_NOT_EMPTY", "VALIDATION_NEW_PASSWORD_IS_NOT_EMPTY":
            return String(localized: "Senha é obrigatória")
        case "VALIDATION_PASSWORD_MIN_LENGTH", "VALIDATION_NEW_PASSWORD_MIN_LENGTH":
            return String(localized: "Senha deve ter no mínimo 8 caracteres")
        case "VALIDATION_PASSWORD_MATCHES", "VALIDATION_NEW_PASSWORD_MATCHES":
            return String(localized: "Senha deve conter letras maiúsculas, minúsculas e números")
        case "VALIDATION_CODE_MATCHES":
            return String(localized: "Código inválido")
        case "VALIDATION_TERMS_ACCEPTED_EQUALS":
            return String(localized: "Você precisa aceitar os Termos de Uso")
        case "VALIDATION_PRIVACY_ACCEPTED_EQUALS":
            return String(localized: "Você precisa aceitar a Política de Privacidade")

        default:
            return nil
        }
    }
}
