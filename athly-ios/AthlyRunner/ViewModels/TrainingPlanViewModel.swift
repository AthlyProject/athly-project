import Foundation
import SwiftUI
#if !targetEnvironment(simulator)
import HealthKit
#endif

@MainActor
final class TrainingPlanViewModel: ObservableObject {
    @Published var trainingPlanResponse: TrainingPlanResponse?
    @Published var weeks: [Week] = []
    @Published var todayWorkout: WorkoutModel?
    @Published var allWorkouts: [WorkoutModel] = []
    @Published var weeklyGoals: [WeeklyGoalResponse] = []
    @Published var selectedWeekIndex: Int = 0
    @Published var isLoading: Bool = false
    @Published var isGenerating: Bool = false
    @Published var isGeneratingInBackground: Bool = false
    @Published var isDeleting: Bool = false
    @Published var errorMessage: String?
    @Published var lastAnalysis: RunAnalysis?
    /// Meta ativa do usuário (inclui o veredito de viabilidade vs. objetivo) — usada na tela de detalhe do plano.
    @Published var activeGoal: CreateGoalResponse?
    /// Conquistas: treinos de tentativa de objetivo em que o atleta atingiu a meta (ver `AchievementStore`).
    @Published var achievementCount: Int = AchievementStore.shared.count

    private var generationPollTask: Task<Void, Never>?

    // MARK: - Computed Properties

    var currentWeekWorkouts: [WorkoutModel] {
        guard selectedWeekIndex < weeks.count else { return [] }
        return weeks[selectedWeekIndex].workouts
    }

    var completedThisWeek: Int {
        currentWeekWorkouts.filter { $0.status == .done }.count
    }

    var totalThisWeek: Int {
        currentWeekWorkouts.count
    }

    var weeklyProgress: Double {
        guard totalThisWeek > 0 else { return 0 }
        return Double(completedThisWeek) / Double(totalThisWeek)
    }

    var nextWorkout: WorkoutModel? {
        currentWeekWorkouts.first { $0.status == .scheduled }
    }

    // MARK: - Semana corrente (Dashboard)
    //
    // Derivado direto de `allWorkouts` pela semana de calendário (segunda→domingo) que contém hoje,
    // independente de `weeklyGoals`/`selectedWeekIndex`. Evita o falso "Nenhum treino planejado"
    // quando o plano não tem weeklyGoal ou o vínculo `weeklyGoalId` está quebrado. O `PlanView`
    // continua usando as props acima, baseadas na semana selecionada para navegação.

    private var thisWeekInterval: DateInterval? {
        var cal = Calendar.current
        cal.firstWeekday = 2 // segunda-feira
        return cal.dateInterval(of: .weekOfYear, for: Date())
    }

    var thisWeekWorkouts: [WorkoutModel] {
        guard let interval = thisWeekInterval else { return currentWeekWorkouts }
        return allWorkouts
            .filter { $0.sportType != .other && interval.contains($0.parsedDate) }
            .sorted { $0.parsedDate < $1.parsedDate }
    }

    var thisWeekCompleted: Int {
        thisWeekWorkouts.filter { $0.status == .done }.count
    }

    var thisWeekTotal: Int {
        thisWeekWorkouts.count
    }

    var thisWeekProgress: Double {
        guard thisWeekTotal > 0 else { return 0 }
        return Double(thisWeekCompleted) / Double(thisWeekTotal)
    }

    var thisWeekNext: WorkoutModel? {
        let startOfToday = Calendar.current.startOfDay(for: Date())
        return thisWeekWorkouts.first {
            $0.status == .scheduled && $0.parsedDate >= startOfToday
        }
    }

    /// WeeklyGoal da semana atualmente selecionada (usada para exibir cards de AI insight).
    var currentWeekGoal: WeeklyGoalResponse? {
        guard selectedWeekIndex < weeks.count else { return nil }
        return weeks[selectedWeekIndex].weeklyGoal
    }

    /// Próximos 5 treinos (a partir de hoje), ordenados por data; usado na tela Plano.
    var nextFiveWorkouts: [WorkoutModel] {
        let startOfToday = Calendar.current.startOfDay(for: Date())
        return allWorkouts
            .filter { $0.parsedDate >= startOfToday && $0.sportType != .other }
            .sorted { $0.parsedDate < $1.parsedDate }
            .prefix(5)
            .map { $0 }
    }

    /// Sequência (ofensiva): treinos prescritos consecutivos concluídos, de hoje pra trás.
    /// Regra em `StreakCalculator` (pulado/passado-não-marcado quebra; treino de hoje pendente é neutro).
    var currentStreak: Int {
        let entries = allWorkouts
            .filter { $0.sportType != .other }
            .map { (date: $0.parsedDate, status: $0.status) }
        return StreakCalculator.currentStreak(entries: entries)
    }

    // MARK: - Load Data

    func loadData() async {
        let hasCached = hydrateFromCache()
        if !hasCached {
            isLoading = true
        }
        achievementCount = AchievementStore.shared.count
        errorMessage = nil

        do {
            guard let plan = try await APIClient.shared.getMyTrainingPlan() else {
                if !hasCached {
                    trainingPlanResponse = nil
                    weeks = []
                    allWorkouts = []
                    weeklyGoals = []
                    todayWorkout = nil
                }
                isLoading = false
                return
            }
            trainingPlanResponse = plan

            async let goalsTask = APIClient.shared.getWeeklyGoals(trainingPlanId: plan.id)
            async let workoutsTask = APIClient.shared.getWorkoutsByTrainingPlan(trainingPlanId: plan.id)

            let (goals, workouts) = try await (goalsTask, workoutsTask)

            weeklyGoals = goals.sorted { $0.parsedStartDate < $1.parsedStartDate }
            allWorkouts = workouts
            todayWorkout = Self.todayWorkout(from: allWorkouts)

            weeks = buildWeeks(goals: weeklyGoals, workouts: allWorkouts)
            selectedWeekIndex = currentWeekIndex()
            isLoading = false

            if let freshAnalysis = weeklyGoals.last?.metrics?.asRunAnalysis {
                lastAnalysis = freshAnalysis
            }

            // Meta ativa (com feasibility) para a tela de detalhe — falha aqui não quebra o load do plano.
            activeGoal = try? await APIClient.shared.getActiveGoal()

            persistToCache()
            await NotificationService.shared.reschedule(workouts: allWorkouts)
        } catch APIError.notFound {
            if !hasCached {
                trainingPlanResponse = nil
                weeks = []
                allWorkouts = []
                weeklyGoals = []
                todayWorkout = nil
            }
        } catch is CancellationError {
            // task lifecycle cancellation — not a real error
        } catch let error as URLError where error.code == .cancelled {
            // URLSession cancellation — not a real error
        } catch {
            if !hasCached {
                errorMessage = error.localizedDescription
            }
        }

        isLoading = false
    }

    @discardableResult
    private func hydrateFromCache() -> Bool {
        guard let snapshot = TrainingPlanCache.shared.load() else { return false }
        trainingPlanResponse = snapshot.trainingPlan
        weeklyGoals = snapshot.weeklyGoals
        allWorkouts = snapshot.allWorkouts
        todayWorkout = Self.todayWorkout(from: allWorkouts) ?? snapshot.todayWorkout.flatMap {
            $0.sportType != .other && $0.isToday ? $0 : nil
        }
        if lastAnalysis == nil {
            lastAnalysis = snapshot.lastAnalysis
        }
        weeks = buildWeeks(goals: weeklyGoals, workouts: allWorkouts)
        selectedWeekIndex = currentWeekIndex()
        return true
    }

    private func persistToCache() {
        let snapshot = TrainingPlanCacheSnapshot(
            trainingPlan: trainingPlanResponse,
            weeklyGoals: weeklyGoals,
            allWorkouts: allWorkouts,
            todayWorkout: todayWorkout,
            lastAnalysis: lastAnalysis,
            updatedAt: Date()
        )
        TrainingPlanCache.shared.save(snapshot)
    }

    /// Carrega a meta ativa (com feasibility) sob demanda, se ainda não estiver em memória.
    func loadActiveGoalIfNeeded() async {
        guard activeGoal == nil else { return }
        activeGoal = try? await APIClient.shared.getActiveGoal()
    }

    // MARK: - Delete Plan

    /// Deleta o plano atual. O backend captura um laudo das últimas semanas (continuidade da IA)
    /// antes do cascade. Limpa o estado local e o cache. Retorna `true` em caso de sucesso.
    @discardableResult
    func deleteTrainingPlan() async -> Bool {
        guard let plan = trainingPlanResponse else { return false }
        isDeleting = true
        defer { isDeleting = false }
        do {
            try await APIClient.shared.deleteTrainingPlan(plan.id)
            trainingPlanResponse = nil
            weeks = []
            allWorkouts = []
            weeklyGoals = []
            todayWorkout = nil
            lastAnalysis = nil
            activeGoal = nil
            selectedWeekIndex = 0
            TrainingPlanCache.shared.clear()
            await NotificationService.shared.reschedule(workouts: [])
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    // MARK: - Generate Next Week

    /// Fluxo unificado via Apple Health: gera o plano com `planFromHealth`. Sem corridas no
    /// HealthKit, envia runs vazias e o backend gera um plano de avaliação (cold start).
    func generateNextWeekWithHealth() async {
        isGenerating = true
        errorMessage = nil

        let service: any HealthKitRunningWorkoutsProviding = {
            #if targetEnvironment(simulator)
            return MockHealthKitService()
            #else
            return HealthKitService()
            #endif
        }()

        var healthRuns: [HealthKitRunItem] = []

        if service.isHealthDataAvailable {
            do {
                try await service.requestReadAuthorization()
                healthRuns = try await service.fetchLatestRunningWorkouts(limit: 20)
            } catch {
                // HealthKit indisponível ou negado → continua sem runs (assessment path)
            }
        }

        let workoutIdsBefore = Set(allWorkouts.map { $0.id })
        let generatedWeeklyGoalIdsBefore = Set(
            weeklyGoals
                .filter { $0.status == .GENERATED }
                .map { $0.id }
        )

        do {
            let payloads = healthRuns.map { HealthRunPayload(from: $0) }
            // Com corridas → sessões detalhadas (5 na 1ª geração, 7 depois). Sem corridas →
            // runs vazias e o backend cai no plano de avaliação (cold start).
            let detailedSessions = healthRuns.isEmpty
                ? []
                : await buildDetailedSessions(limit: trainingPlanResponse == nil ? 5 : 7)
            let request = PlanFromHealthRequest(
                runs: payloads,
                detailedSessions: detailedSessions.isEmpty ? nil : detailedSessions,
                weekStartDate: nil
            )
            let response = try await APIClient.shared.startPlanFromHealthGeneration(request)
            startGenerationPolling(
                workoutIdsBefore: workoutIdsBefore,
                generatedWeeklyGoalIdsBefore: generatedWeeklyGoalIdsBefore,
                generationId: response.generationId,
                pollAfterSeconds: response.pollAfterSeconds
            )
        } catch is CancellationError {
            // ignored
        } catch let error as URLError where error.code == .cancelled {
            // ignored
        } catch {
            errorMessage = error.localizedDescription
        }

        isGenerating = false
    }

    func generateFromHealth(runs: [HealthKitRunItem]) async {
        guard !runs.isEmpty else { return }
        isGenerating = true
        errorMessage = nil

        let workoutIdsBefore = Set(allWorkouts.map { $0.id })
        let generatedWeeklyGoalIdsBefore = Set(
            weeklyGoals
                .filter { $0.status == .GENERATED }
                .map { $0.id }
        )

        do {
            let payloads = runs.map { HealthRunPayload(from: $0) }
            let detailedLimit = trainingPlanResponse == nil ? 5 : 7
            let detailedSessions = await buildDetailedSessions(limit: detailedLimit)
            let request = PlanFromHealthRequest(
                runs: payloads,
                detailedSessions: detailedSessions.isEmpty ? nil : detailedSessions,
                weekStartDate: nil
            )
            let response = try await APIClient.shared.startPlanFromHealthGeneration(request)
            startGenerationPolling(
                workoutIdsBefore: workoutIdsBefore,
                generatedWeeklyGoalIdsBefore: generatedWeeklyGoalIdsBefore,
                generationId: response.generationId,
                pollAfterSeconds: response.pollAfterSeconds
            )
        } catch is CancellationError {
            // ignored
        } catch let error as URLError where error.code == .cancelled {
            // ignored
        } catch {
            errorMessage = error.localizedDescription
        }

        isGenerating = false
    }

    // MARK: - Detailed session builder (for enriched planFromHealth payload)

    /// Fetches the last N raw HKWorkouts, resolves the prescribed workout link via
    /// `RunWorkoutLinkStore`, and builds per-segment payloads for the AI planner.
    /// Skips silently on the simulator (no real HealthKit) or when authorization is missing.
    private func buildDetailedSessions(limit: Int) async -> [DetailedSessionPayload] {
        #if targetEnvironment(simulator)
        return []
        #else
        let service = HealthKitService()
        guard service.isHealthDataAvailable else { return [] }

        do {
            let rawWorkouts = try await service.fetchLatestRawRunningWorkouts(limit: limit)
            let fetcher = WorkoutDetailFetcher()
            var results: [DetailedSessionPayload] = []
            for workout in rawWorkouts {
                let uuid = workout.uuid.uuidString
                let athlyWorkoutId = RunWorkoutLinkStore.shared.athlyWorkoutId(for: uuid)
                if let payload = try? await fetcher.buildDetailedSession(
                    for: workout,
                    athlyWorkoutId: athlyWorkoutId
                ) {
                    results.append(payload)
                }
            }
            return results
        } catch {
            return []
        }
        #endif
    }

    // MARK: - Complete / Skip

    func completeWorkout(_ workout: WorkoutModel) async {
        do {
            let updated = try await APIClient.shared.completeWorkout(workoutId: workout.id)
            replaceWorkout(updated)
        } catch is CancellationError {
            // ignored
        } catch let error as URLError where error.code == .cancelled {
            // ignored
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Conclui um treino prescrito usando a corrida que acabou de ser registrada pelo tracker Athly.
    /// O HealthKit UUID é opcional: se a escrita HealthKit falhar, ainda enviamos as métricas reais.
    func completeWorkoutWithRunResult(
        _ workout: WorkoutModel,
        result: RunResult,
        healthKitUUID: String?
    ) async {
        do {
            if let healthKitUUID {
                RunWorkoutLinkStore.shared.link(healthKitUUID: healthKitUUID, athlyWorkoutId: workout.id)
            }

            let updated = try await APIClient.shared.completeWorkout(
                workoutId: workout.id,
                appleHealthWorkoutUUID: healthKitUUID,
                actualDistanceMeters: result.distanceMeters,
                actualDurationSeconds: result.durationSeconds
            )
            replaceWorkout(updated)
            recordAchievementIfEarned(
                workout: workout,
                actualDistanceMeters: result.distanceMeters,
                actualDurationSeconds: result.durationSeconds,
                actualPaceSecPerKm: result.averagePaceSecondsPerKm
            )
        } catch is CancellationError {
            // ignored
        } catch let error as URLError where error.code == .cancelled {
            // ignored
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Conclui um treino prescrito vinculando dados reais de uma corrida do HealthKit.
    func completeWorkoutWithHealthData(_ workout: WorkoutModel, healthRun: HealthKitRunItem) async {
        do {
            RunWorkoutLinkStore.shared.link(healthKitUUID: healthRun.id, athlyWorkoutId: workout.id)
            let executionDetails = await buildExecutionDetails(for: workout, healthRun: healthRun)

            let updated = try await APIClient.shared.completeWorkout(
                workoutId: workout.id,
                appleHealthWorkoutUUID: healthRun.id,
                actualDistanceMeters: healthRun.distanceMeters,
                actualDurationSeconds: healthRun.durationSeconds,
                executionDetails: executionDetails
            )
            replaceWorkout(updated)
            recordAchievementIfEarned(
                workout: workout,
                actualDistanceMeters: healthRun.distanceMeters,
                actualDurationSeconds: healthRun.durationSeconds,
                actualPaceSecPerKm: healthRun.averagePaceSecondsPerKm
            )
        } catch is CancellationError {
            // ignored
        } catch let error as URLError where error.code == .cancelled {
            // ignored
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func buildExecutionDetails(for workout: WorkoutModel, healthRun: HealthKitRunItem) async -> DetailedSessionPayload? {
        #if targetEnvironment(simulator)
        return nil
        #else
        let service = HealthKitService()
        guard service.isHealthDataAvailable else { return nil }
        guard let rawWorkout = try? await service.fetchRawWorkout(uuid: healthRun.id) else {
            return nil
        }
        let fetcher = WorkoutDetailFetcher()
        return try? await fetcher.buildDetailedSession(
            for: rawWorkout,
            athlyWorkoutId: workout.id,
            prescribedWorkout: workout
        )
        #endif
    }

    func skipWorkout(_ workout: WorkoutModel) async {
        do {
            let updated = try await APIClient.shared.skipWorkout(workoutId: workout.id)
            replaceWorkout(updated)
        } catch is CancellationError {
            // ignored
        } catch let error as URLError where error.code == .cancelled {
            // ignored
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Background generation polling

    private func startGenerationPolling(
        workoutIdsBefore: Set<String>,
        generatedWeeklyGoalIdsBefore: Set<String>,
        generationId: String,
        pollAfterSeconds: Int
    ) {
        generationPollTask?.cancel()
        isGeneratingInBackground = true
        generationPollTask = Task { [weak self] in
            guard let self else { return }
            _ = await self.pollUntilNewWorkouts(
                workoutIdsBefore: workoutIdsBefore,
                generatedWeeklyGoalIdsBefore: generatedWeeklyGoalIdsBefore,
                generationId: generationId,
                intervalSeconds: pollAfterSeconds
            )
            self.isGeneratingInBackground = false
        }
    }

    private func pollUntilNewWorkouts(
        workoutIdsBefore: Set<String>,
        generatedWeeklyGoalIdsBefore: Set<String>,
        generationId: String,
        intervalSeconds: Int
    ) async -> Bool {
        let intervalNanoseconds = UInt64(max(1, intervalSeconds)) * 1_000_000_000
        while !Task.isCancelled {
            try? await Task.sleep(nanoseconds: intervalNanoseconds)
            if Task.isCancelled { return false }
            do {
                let status = try await APIClient.shared.getPlanFromHealthGenerationStatus(generationId: generationId)
                if status.status == "failed" {
                    errorMessage = status.error ?? status.message
                    return false
                }
            } catch APIError.notFound {
                // O status fica em memória no backend; em deploy multi-instância, outro pod pode não
                // conhecer o generationId. Continua pela fonte de verdade persistida: weeklyGoals/workouts.
            } catch {
                // Falha transitória de rede: mantém o polling sem encerrar por timeout.
            }

            await loadData()
            let currentIds = Set(allWorkouts.map { $0.id })
            let generatedGoalIds = Set(
                weeklyGoals
                    .filter { $0.status == .GENERATED }
                    .map { $0.id }
            )
            if !currentIds.subtracting(workoutIdsBefore).isEmpty ||
                !generatedGoalIds.subtracting(generatedWeeklyGoalIdsBefore).isEmpty {
                selectedWeekIndex = max(0, weeks.count - 1)
                await NotificationService.shared.requestAuthorizationIfNeeded()
                await NotificationService.shared.reschedule(workouts: allWorkouts)
                await NotificationService.shared.notifyWeeklyPlanGenerated()
                return true
            }
        }
        return false
    }

    // MARK: - Private Helpers

    private func buildWeeks(goals: [WeeklyGoalResponse], workouts: [WorkoutModel]) -> [Week] {
        goals.enumerated().map { index, goal in
            let weekWorkouts = workouts
                .filter { $0.weeklyGoalId == goal.id }
                .sorted { $0.parsedDate < $1.parsedDate }
            return Week(id: goal.id, number: index + 1, weeklyGoal: goal, workouts: weekWorkouts)
        }
    }

    private func currentWeekIndex() -> Int {
        let today = Date()
        for (index, week) in weeks.enumerated() {
            guard let goal = week.weeklyGoal else { continue }
            if today >= goal.parsedStartDate && today <= goal.parsedEndDate {
                return index
            }
        }
        // Default to last week
        return max(0, weeks.count - 1)
    }

    private static func todayWorkout(from workouts: [WorkoutModel]) -> WorkoutModel? {
        workouts
            .filter { $0.sportType != .other && $0.isToday }
            .sorted { $0.parsedDate < $1.parsedDate }
            .first
    }

    /// Validação sem I.A. ao fim do treino: se for tentativa de objetivo (`isGoalAttempt`) e o
    /// resultado real bater a meta planejada (distância + pace), conta como conquista.
    private func recordAchievementIfEarned(
        workout: WorkoutModel,
        actualDistanceMeters: Double,
        actualDurationSeconds: Double,
        actualPaceSecPerKm: Double
    ) {
        guard WorkoutObjectiveValidator.isObjectiveAchieved(
            workout: workout,
            actualDistanceMeters: actualDistanceMeters,
            actualDurationSeconds: actualDurationSeconds,
            actualPaceSecPerKm: actualPaceSecPerKm
        ) else { return }
        AchievementStore.shared.record(workoutId: workout.id)
        achievementCount = AchievementStore.shared.count
    }

    private func replaceWorkout(_ updated: WorkoutModel) {
        allWorkouts = allWorkouts.map { $0.id == updated.id ? updated : $0 }
        todayWorkout = Self.todayWorkout(from: allWorkouts)
        weeks = buildWeeks(goals: weeklyGoals, workouts: allWorkouts)
        persistToCache()
    }
}
