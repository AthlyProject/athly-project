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

    // MARK: - Load Data

    func loadData() async {
        let hasCached = hydrateFromCache()
        if !hasCached {
            isLoading = true
        }
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

            if lastAnalysis == nil {
                lastAnalysis = weeklyGoals.last?.metrics?.asRunAnalysis
            }

            persistToCache()
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

    func generateNextWeek() async {
        isGenerating = true
        errorMessage = nil

        let workoutIdsBefore = Set(allWorkouts.map { $0.id })

        do {
            let request = PlanNextWeekRequest(numberOfRuns: nil, weekStartDate: nil)
            let response = try await APIClient.shared.planNextWeek(request)
            lastAnalysis = response.analysis
            await loadData()
            selectedWeekIndex = max(0, weeks.count - 1)
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

    /// Fluxo unificado: tenta HealthKit → se tiver corridas, usa planFromHealth; senão, planNextWeek (assessment).
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
            if healthRuns.isEmpty {
                let request = PlanNextWeekRequest(numberOfRuns: nil, weekStartDate: nil)
                let response = try await APIClient.shared.planNextWeek(request)
                lastAnalysis = response.analysis
            } else {
                let payloads = healthRuns.map { HealthRunPayload(from: $0) }
                // First generation (no plan yet) → 5 detailed sessions; mid-plan → 7.
                let detailedLimit = trainingPlanResponse == nil ? 5 : 7
                let detailedSessions = await buildDetailedSessions(limit: detailedLimit)
                let request = PlanFromHealthRequest(
                    runs: payloads,
                    detailedSessions: detailedSessions.isEmpty ? nil : detailedSessions,
                    weekStartDate: nil
                )
                let response = try await APIClient.shared.planFromHealth(request)
                lastAnalysis = response.analysis
            }
            await loadData()
            selectedWeekIndex = max(0, weeks.count - 1)
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
                appleHealthWorkoutUUID: healthRun.id
            )
            replaceWorkout(updated)
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

    private func replaceWorkout(_ updated: WorkoutModel) {
        allWorkouts = allWorkouts.map { $0.id == updated.id ? updated : $0 }
        if todayWorkout?.id == updated.id {
            todayWorkout = updated
        }
        weeks = buildWeeks(goals: weeklyGoals, workouts: allWorkouts)
        persistToCache()
    }
}
