import Foundation

/// Análise da meta antes do plano: lê o Health uma vez, pede a análise ao backend e confirma a
/// escolha (manter a meta, uma alternativa ou, na troca de meta, o rascunho editado). O mesmo
/// Health segue para a geração, para análise e plano usarem os mesmos dados.
@MainActor
final class GoalAnalysisViewModel: ObservableObject {
    enum Mode: Equatable {
        /// Logo depois do onboarding: a meta já está ativa; manter não chama o backend.
        case onboarding
        /// Troca de meta no meio do ciclo: o rascunho só vira meta ao confirmar.
        case change(GoalDraft)
    }

    enum Phase {
        case loading
        case loaded(GoalAnalysis)
        case failed(String)
    }

    enum Outcome {
        case kept(PlanFromHealthRequest)
        case replaced(CreateGoalResponse, PlanFromHealthRequest)
    }

    struct Dependencies {
        var buildInput: @MainActor (_ detailedLimit: Int) async throws -> PlanFromHealthRequest
        var analyze: @MainActor (GoalAnalysisRequest) async throws -> GoalAnalysis
        var replaceGoal: @MainActor (GoalDraft) async throws -> CreateGoalResponse

        static let live = Dependencies(
            buildInput: { try await PlannerHealthSyncService.shared.buildInput(detailedLimit: $0, requestAuthorization: true) },
            analyze: { try await APIClient.shared.analyzeGoal($0) },
            replaceGoal: { try await APIClient.shared.replaceActiveGoal($0) }
        )
    }

    @Published private(set) var phase: Phase = .loading
    /// Nil = manter a meta (ou o rascunho, na troca).
    @Published var selectedAlternativeID: String?
    @Published private(set) var isConfirming = false
    @Published var errorMessage: String?

    let mode: Mode
    private let detailedLimit: Int
    private let dependencies: Dependencies
    private var healthInput: PlanFromHealthRequest?

    init(mode: Mode, detailedLimit: Int, dependencies: Dependencies = .live) {
        self.mode = mode
        self.detailedLimit = detailedLimit
        self.dependencies = dependencies
    }

    var analysis: GoalAnalysis? {
        if case .loaded(let analysis) = phase { return analysis }
        return nil
    }

    var selectedAlternative: GoalAnalysis.Alternative? {
        analysis?.options.first { $0.id == selectedAlternativeID }
    }

    var isChange: Bool {
        if case .change = mode { return true }
        return false
    }

    func load() async {
        phase = .loading
        errorMessage = nil
        let input = await healthInputOnce()
        let draft: GoalDraft?
        if case .change(let changed) = mode { draft = changed } else { draft = nil }
        do {
            phase = .loaded(try await dependencies.analyze(GoalAnalysisRequest(health: input, goal: draft)))
        } catch is CancellationError {
            // A tela saiu; nada a mostrar.
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    /// Confirma a escolha. Nil quando a troca falha (a mensagem fica em `errorMessage`).
    func confirm() async -> Outcome? {
        let input = await healthInputOnce()
        let draft: GoalDraft?
        if let alternative = selectedAlternative {
            draft = alternative.goal
        } else if case .change(let changed) = mode {
            draft = changed
        } else {
            draft = nil
        }
        guard let draft else { return .kept(input) }
        isConfirming = true
        errorMessage = nil
        defer { isConfirming = false }
        do {
            let goal = try await dependencies.replaceGoal(draft)
            // Grava a viabilidade da meta nova para o cartão do plano; falhar aqui não desfaz a troca.
            _ = try? await dependencies.analyze(GoalAnalysisRequest(health: input, goal: nil))
            return .replaced(goal, input)
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    /// Onboarding sem análise (backend antigo, sem rede): segue com a meta como está.
    func continueWithoutAnalysis() async -> Outcome {
        .kept(await healthInputOnce())
    }

    /// Lê o Health uma vez. Sem acesso ao Health, segue sem corridas, como a geração já faz.
    private func healthInputOnce() async -> PlanFromHealthRequest {
        if let healthInput { return healthInput }
        let input = (try? await dependencies.buildInput(detailedLimit))
            ?? PlanFromHealthRequest(runs: [], detailedSessions: nil, weekStartDate: nil)
        healthInput = input
        return input
    }
}
