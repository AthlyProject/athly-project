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
    @Published var errorMessage: String?
    @Published var lastAnalysis: RunAnalysis?
    /// Conquistas: treinos de tentativa de objetivo em que o atleta atingiu a meta (ver `AchievementStore`).
    @Published var achievementCount: Int = AchievementStore.shared.count

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
        thisWeekWorkouts.first { $0.status == .scheduled }
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
            async let todayTask = APIClient.shared.getTodayWorkout()

            let (goals, workouts, today) = try await (goalsTask, workoutsTask, todayTask)

            weeklyGoals = goals.sorted { $0.parsedStartDate < $1.parsedStartDate }
            allWorkouts = workouts
            todayWorkout = today

            weeks = buildWeeks(goals: weeklyGoals, workouts: allWorkouts)
            selectedWeekIndex = currentWeekIndex()

            if let freshAnalysis = weeklyGoals.last?.metrics?.asRunAnalysis {
                lastAnalysis = freshAnalysis
            }

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
        todayWorkout = snapshot.todayWorkout
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
            let response = try await APIClient.shared.planFromHealth(request)
            lastAnalysis = response.analysis
            await loadData()
            selectedWeekIndex = max(0, weeks.count - 1)
            // Onboarding: após gerar o plano, oferece os lembretes e (re)agenda.
            await NotificationService.shared.requestAuthorizationIfNeeded()
            await NotificationService.shared.reschedule(workouts: allWorkouts)
        } catch is CancellationError {
            // ignored
        } catch let error as URLError where error.code == .cancelled {
            // ignored
        } catch let error as URLError where error.code == .timedOut {
            // Backend ainda está gerando — iniciar polling silencioso
            await pollUntilNewWorkouts(workoutIdsBefore: workoutIdsBefore)
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

        do {
            let payloads = runs.map { HealthRunPayload(from: $0) }
            let detailedLimit = trainingPlanResponse == nil ? 5 : 7
            let detailedSessions = await buildDetailedSessions(limit: detailedLimit)
            let request = PlanFromHealthRequest(
                runs: payloads,
                detailedSessions: detailedSessions.isEmpty ? nil : detailedSessions,
                weekStartDate: nil
            )
            let response = try await APIClient.shared.planFromHealth(request)
            lastAnalysis = response.analysis
            await loadData()
            selectedWeekIndex = max(0, weeks.count - 1)
            // Onboarding: após gerar o plano, oferece os lembretes e (re)agenda.
            await NotificationService.shared.requestAuthorizationIfNeeded()
            await NotificationService.shared.reschedule(workouts: allWorkouts)
        } catch is CancellationError {
            // ignored
        } catch let error as URLError where error.code == .cancelled {
            // ignored
        } catch let error as URLError where error.code == .timedOut {
            await pollUntilNewWorkouts(workoutIdsBefore: workoutIdsBefore)
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

    /// Conclui um treino prescrito vinculando dados reais de uma corrida do HealthKit.
    func completeWorkoutWithHealthData(_ workout: WorkoutModel, healthRun: HealthKitRunItem) async {
        do {
            RunWorkoutLinkStore.shared.link(healthKitUUID: healthRun.id, athlyWorkoutId: workout.id)

            let updated = try await APIClient.shared.completeWorkout(
                workoutId: workout.id,
                appleHealthWorkoutUUID: healthRun.id,
                actualDistanceMeters: healthRun.distanceMeters,
                actualDurationSeconds: healthRun.durationSeconds
            )
            replaceWorkout(updated)
            recordAchievementIfEarned(workout: workout, healthRun: healthRun)
        } catch is CancellationError {
            // ignored
        } catch let error as URLError where error.code == .cancelled {
            // ignored
        } catch {
            errorMessage = error.localizedDescription
        }
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

    // MARK: - Polling helper (used after a timeout during generation)

    private func pollUntilNewWorkouts(workoutIdsBefore: Set<String>) async {
        let maxAttempts = 18
        for _ in 0..<maxAttempts {
            try? await Task.sleep(nanoseconds: 5_000_000_000) // 5s
            if Task.isCancelled { break }
            await loadData()
            let currentIds = Set(allWorkouts.map { $0.id })
            if !currentIds.subtracting(workoutIdsBefore).isEmpty {
                selectedWeekIndex = max(0, weeks.count - 1)
                break
            }
        }
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

    /// Validação sem I.A. ao fim do treino: se for tentativa de objetivo (`isGoalAttempt`) e o
    /// resultado real bater a meta planejada (distância + pace), conta como conquista.
    private func recordAchievementIfEarned(workout: WorkoutModel, healthRun: HealthKitRunItem) {
        guard WorkoutObjectiveValidator.isObjectiveAchieved(
            workout: workout,
            actualDistanceMeters: healthRun.distanceMeters,
            actualDurationSeconds: healthRun.durationSeconds,
            actualPaceSecPerKm: healthRun.averagePaceSecondsPerKm
        ) else { return }
        AchievementStore.shared.record(workoutId: workout.id)
        achievementCount = AchievementStore.shared.count
    }

    private func replaceWorkout(_ updated: WorkoutModel) {
        allWorkouts = allWorkouts.map { $0.id == updated.id ? updated : $0 }
        if todayWorkout?.id == updated.id {
            todayWorkout = updated
        }
        weeks = buildWeeks(goals: weeklyGoals, workouts: allWorkouts)
        persistToCache()
    }
}
