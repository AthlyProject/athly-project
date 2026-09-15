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
        switch self {
        case .single(let value): return value
        case .multiple(let values): return values.joined(separator: "\n")
        }
    }
}

extension BackendErrorBody {
    /// Texto pronto para exibir, já no idioma do app.
    ///
    /// Ordem: erros de validação campo a campo → código de negócio → texto do servidor. O
    /// fallback importa: um código novo no backend não pode virar tela em branco no app.
    var localizedText: String? {
        if let fieldErrors = errors, !fieldErrors.isEmpty {
            let lines = fieldErrors.compactMap { fieldError -> String? in
                fieldError.code.flatMap(BackendErrorCode.localizedMessage) ?? fieldError.message
            }
            if !lines.isEmpty { return lines.joined(separator: "\n") }
        }

        if let localized = code.flatMap(BackendErrorCode.localizedMessage) {
            return localized
        }

        let fallback = message?.text
        return (fallback?.isEmpty == false) ? fallback : nil
    }
}

/// Tradução dos códigos do backend para as strings do catálogo do app.
///
/// A tradução mora aqui (e não no servidor) para ficar junto do resto das strings da UI, no
/// mesmo `Localizable.xcstrings`. Um código sem entrada nesta tabela cai no `message` do
/// servidor — só códigos que o app realmente mostra ao usuário precisam estar aqui.
enum BackendErrorCode {
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
        case "USER_NOT_FOUND":
            return String(localized: "Usuário não encontrado")

        // MARK: Assinatura

        case "BILLING_SUBSCRIPTION_REQUIRED":
            return String(localized: "Assinatura necessária. Inicie ou renove sua assinatura para continuar.")

        // MARK: Avaliação

        case "ASSESSMENT_TERMS_NOT_ACCEPTED":
            return String(localized: "Você precisa aceitar os termos para continuar.")
        case "ASSESSMENT_PLAN_GENERATION_IN_PROGRESS":
            return String(localized: "Seu plano está sendo gerado. Aguarde a conclusão antes de iniciar uma nova avaliação.")

        // MARK: Treinos

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

        default:
            return nil
        }
    }
}
