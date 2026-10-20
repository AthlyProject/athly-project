import XCTest
@testable import AthlyRunner

/// Análise da meta antes do plano: decodificação da resposta, escolhas do atleta e formulário de meta.
@MainActor
final class GoalAnalysisTests: XCTestCase {
    // Resposta real do backend local (cenario-medio, meia em 1:45).
    private let analysisJSON = """
    {
      "goal": { "summary": "Treinar para meia maratona em 1:45:00", "targetDistance": "half",
                "targetTime": "1:45:00", "eventDate": "2027-01-03" },
      "applicable": true, "verdict": "unrealistic", "lowConfidence": false, "hasHistory": true,
      "title": "Meta difícil para esta data",
      "message": "Até a prova, a projeção é 1:50:30, acima da meta de 1:45:00.",
      "numbers": { "currentVdot": 38.6, "requiredVdot": 42.6, "targetTimeSec": 6300, "timeTodaySec": 6859,
                   "timeAtEventSec": 6626, "weeksAvailable": 10, "daysAvailable": 75,
                   "enduranceDemonstrated": false, "longestKm": 13, "requiredLongestKm": 15.8,
                   "weeklyKm": 23.7, "requiredWeeklyKm": 31.6 },
      "alternatives": [
        { "id": "both-15k-1:23:00", "axis": "both", "source": "objective",
          "summary": "15K em 1:23:00 no mesmo dia",
          "goal": { "objectiveDistance": "15k", "objectiveType": "target_time",
                    "targetTime": "1:23:00", "eventDate": "2027-01-03" } }
      ]
    }
    """

    private func analysis(_ json: String? = nil) throws -> GoalAnalysis {
        try JSONDecoder().decode(GoalAnalysis.self, from: Data((json ?? analysisJSON).utf8))
    }

    private let health = PlanFromHealthRequest(runs: [], detailedSessions: nil, weekStartDate: nil, runsReadFrom: "2026-08-18T10:00:00.000Z")

    private func goal(_ summary: String) -> CreateGoalResponse {
        CreateGoalResponse(
            id: "goal-2", rawText: summary,
            parsedGoal: ParsedGoal(isRunningRelated: true, targetDistance: "15k", targetTime: "1:23:00",
                                   eventDate: "2027-01-03", eventName: nil, experienceLevel: nil,
                                   summary: summary, rejectionReason: nil),
            feasibility: nil, active: true, createdAt: "2026-10-20T12:00:00.000Z")
    }

    /// Registra as chamadas para conferir o que foi pedido ao backend.
    private final class Calls {
        var buildInput = 0
        var analyzed: [GoalAnalysisRequest] = []
        var replaced: [GoalDraft] = []
    }

    private func viewModel(
        mode: GoalAnalysisViewModel.Mode,
        calls: Calls,
        buildFails: Bool = false,
        replaceFails: Bool = false
    ) throws -> GoalAnalysisViewModel {
        let analysis = try analysis()
        let health = health
        let goal = goal("Treinar para 15K em 1:23:00")
        return GoalAnalysisViewModel(mode: mode, detailedLimit: 5, dependencies: .init(
            buildInput: { _ in
                calls.buildInput += 1
                if buildFails { throw URLError(.notConnectedToInternet) }
                return health
            },
            analyze: { calls.analyzed.append($0); return analysis },
            replaceGoal: { draft in
                calls.replaced.append(draft)
                if replaceFails { throw APIError.serverError(409, "Seu plano está sendo gerado.") }
                return goal
            }
        ))
    }

    func testDecodesTheAnalysisAndToleratesAnOlderBackend() throws {
        let full = try analysis()
        XCTAssertTrue(full.isApplicable)
        XCTAssertEqual(full.verdict, "unrealistic")
        XCTAssertEqual(full.numbers?.requiredLongestKm, 15.8)
        XCTAssertEqual(full.options.first?.goal.objectiveDistance, "15k")

        let minimal = try analysis(#"{ "goal": { "summary": "Meta" }, "title": "t", "message": "m" }"#)
        XCTAssertTrue(minimal.isApplicable)
        XCTAssertTrue(minimal.options.isEmpty)
        XCTAssertNil(minimal.numbers)
    }

    func testKeepingTheGoalAtOnboardingGeneratesWithTheSameHealth() async throws {
        let calls = Calls()
        let vm = try viewModel(mode: .onboarding, calls: calls)
        await vm.load()
        XCTAssertEqual(vm.analysis?.title, "Meta difícil para esta data")
        XCTAssertNil(calls.analyzed.first?.goal)

        guard case .kept(let input)? = await vm.confirm() else { return XCTFail("esperava manter a meta") }
        XCTAssertEqual(input.runsReadFrom, health.runsReadFrom)
        XCTAssertEqual(calls.buildInput, 1, "o Health é lido uma vez só")
        XCTAssertTrue(calls.replaced.isEmpty)
    }

    func testAcceptingAnAlternativeReplacesTheGoalAndSavesItsAnalysis() async throws {
        let calls = Calls()
        let vm = try viewModel(mode: .onboarding, calls: calls)
        await vm.load()
        vm.selectedAlternativeID = "both-15k-1:23:00"

        guard case .replaced(let goal, _)? = await vm.confirm() else { return XCTFail("esperava a troca") }
        XCTAssertEqual(goal.parsedGoal.targetDistance, "15k")
        XCTAssertEqual(calls.replaced, [GoalDraft(objectiveDistance: "15k", objectiveType: "target_time",
                                                  targetTime: "1:23:00", eventDate: "2027-01-03")])
        XCTAssertEqual(calls.analyzed.count, 2, "a análise da meta nova grava a viabilidade")
        XCTAssertNil(calls.analyzed.last?.goal)
    }

    func testChangeModeAnalyzesTheDraftAndConfirmsIt() async throws {
        let calls = Calls()
        let draft = GoalDraft(objectiveDistance: "10k", objectiveType: "workload", targetTime: nil, eventDate: "2026-12-06")
        let vm = try viewModel(mode: .change(draft), calls: calls)
        await vm.load()
        XCTAssertEqual(calls.analyzed.first?.goal, draft)

        guard case .replaced? = await vm.confirm() else { return XCTFail("esperava a troca") }
        XCTAssertEqual(calls.replaced, [draft])
    }

    func testAFailedReplaceKeepsTheScreenWithTheMessage() async throws {
        let calls = Calls()
        let vm = try viewModel(mode: .change(GoalDraft(objectiveDistance: "5k", objectiveType: "workload")),
                               calls: calls, replaceFails: true)
        await vm.load()
        let outcome = await vm.confirm()
        XCTAssertNil(outcome)
        XCTAssertNotNil(vm.errorMessage)
        XCTAssertFalse(vm.isConfirming)
    }

    func testWithoutHealthAccessTheAnalysisRunsWithoutRuns() async throws {
        let calls = Calls()
        let vm = try viewModel(mode: .onboarding, calls: calls, buildFails: true)
        await vm.load()
        XCTAssertEqual(calls.analyzed.first?.runs.count, 0)
        guard case .kept(let input) = await vm.continueWithoutAnalysis() else { return XCTFail() }
        XCTAssertTrue(input.runs.isEmpty)
        XCTAssertEqual(calls.buildInput, 1)
    }

    // MARK: - Formulário de meta

    func testGoalFormPrefillsFromTheActiveGoal() {
        let parsed = ParsedGoal(isRunningRelated: true, targetDistance: "15k", targetTime: "1:23:00",
                                eventDate: GoalFormatting.civilDateString(Date().addingTimeInterval(40 * 86_400)),
                                eventName: nil, experienceLevel: nil, summary: "s", rejectionReason: nil)
        let form = GoalFormState(parsedGoal: parsed)
        XCTAssertEqual(form.objectiveDistance, "15k")
        XCTAssertEqual(form.objectiveType, "target_time")
        XCTAssertTrue(form.hasEventDate)
        XCTAssertNil(form.validationMessage)
        XCTAssertEqual(form.draft, GoalDraft(objectiveDistance: "15k", objectiveType: "target_time",
                                             targetTime: "1:23:00", eventDate: parsed.eventDate))
    }

    func testGoalFormValidatesLikeTheBackend() {
        var form = GoalFormState()
        XCTAssertNotNil(form.validationMessage)
        form.objectiveDistance = "half"
        form.objectiveType = "target_time"
        form.targetTimeText = "1h45"
        XCTAssertNotNil(form.validationMessage)
        form.targetTimeText = "1:45:00"
        XCTAssertNil(form.validationMessage)
        form.objectiveType = "workload"
        XCTAssertNil(form.draft.targetTime, "sem tempo alvo o tempo não vai para o backend")
        XCTAssertNil(form.draft.eventDate)
    }
}
