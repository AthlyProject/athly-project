import Foundation
import SwiftUI
import OSLog
#if !targetEnvironment(simulator)
import HealthKit
#endif

@MainActor
struct PlanResumeDependencies {
    var isAuthenticated: @MainActor () async -> Bool = { await APIClient.shared.isAuthenticated }
    var syncHealth: @MainActor () async -> Void = { await PlannerHealthSyncService.shared.sync() }
    var request: @MainActor (Bool) async throws -> ResumePlanResponse = { try await APIClient.shared.resumePlan(retryFailed: $0) }
    var latest: @MainActor () async throws -> AiPlannerGenerationStatusResponse? = { try await APIClient.shared.latestPlanGeneration() }
}

struct PlanLoadDependencies {
    var plan: @MainActor () async throws -> TrainingPlanResponse? = { try await APIClient.shared.getMyTrainingPlan() }
    var goals: @MainActor (String) async throws -> [WeeklyGoalResponse] = { try await APIClient.shared.getWeeklyGoals(trainingPlanId: $0) }
    var workouts: @MainActor (String) async throws -> [WorkoutModel] = { try await APIClient.shared.getWorkoutsByTrainingPlan(trainingPlanId: $0) }
    var activeGoal: @MainActor () async throws -> CreateGoalResponse? = { try await APIClient.shared.getActiveGoal() }
    var notify: @MainActor ([WorkoutModel]) async -> Void = { await NotificationService.shared.reschedule(workouts: $0) }
}

struct WorkoutCompletionDependencies {
    var request: @MainActor (String, String?, Double?, Double?, DetailedSessionPayload?) async throws -> WorkoutModel = {
        try await APIClient.shared.completeWorkout(workoutId: $0, appleHealthWorkoutUUID: $1,
            actualDistanceMeters: $2, actualDurationSeconds: $3, executionDetails: $4)
    }
    var fetchHealthRun: @MainActor (String) async throws -> HealthKitRunItem? = {
        try await HealthKitService().fetchRunningWorkout(uuid: $0)
    }
    private var injectedLinks: RunWorkoutLinkStore?
    var links: RunWorkoutLinkStore { injectedLinks ?? .shared }

    init(request: @escaping @MainActor (String, String?, Double?, Double?, DetailedSessionPayload?) async throws -> WorkoutModel = {
        try await APIClient.shared.completeWorkout(workoutId: $0, appleHealthWorkoutUUID: $1, actualDistanceMeters: $2, actualDurationSeconds: $3, executionDetails: $4)
    }, fetchHealthRun: @escaping @MainActor (String) async throws -> HealthKitRunItem? = {
        try await HealthKitService().fetchRunningWorkout(uuid: $0)
    }, links: RunWorkoutLinkStore? = nil) {
        self.request = request
        self.fetchHealthRun = fetchHealthRun
        self.injectedLinks = links
    }
}

struct PlanRescheduleDependencies {
    var request: @MainActor (String, String) async throws -> WorkoutModel = {
        try await APIClient.shared.rescheduleWorkout(workoutId: $0, newDate: $1)
    }
    var notify: @MainActor ([WorkoutModel]) async -> Void = {
        await NotificationService.shared.reschedule(workouts: $0)
    }
}

enum WorkoutRescheduleDecision: Equatable {
    case allowed, sameDay, differentWeek, occupied, unavailable

    var message: String? {
        switch self {
        case .allowed, .sameDay: return nil
        case .differentWeek: return String(localized: "Só é possível reagendar treinos dentro da mesma semana.")
        case .occupied: return String(localized: "Já existe um treino neste dia. Escolha um dia vazio.")
        case .unavailable: return String(localized: "Só é possível reagendar treinos agendados.")
        }
    }

    static func evaluate(workoutID: String, day: Date, workouts: [WorkoutModel]) -> Self {
        guard let workout = workouts.first(where: { $0.id == workoutID }),
              workout.status == .scheduled, workout.sportType != .other else { return .unavailable }
        let calendar = Calendar.current
        if workout.isOnDay(day) { return .sameDay }
        var weekCalendar = calendar
        weekCalendar.firstWeekday = 2
        guard weekCalendar.dateInterval(of: .weekOfYear, for: workout.parsedDate)?.start ==
                weekCalendar.dateInterval(of: .weekOfYear, for: day)?.start else { return .differentWeek }
        if workouts.contains(where: {
            $0.id != workoutID && $0.trainingPlanId == workout.trainingPlanId &&
            $0.sportType != .other && $0.isOnDay(day)
        }) { return .occupied }
        return .allowed
    }
}

@MainActor
final class TrainingPlanViewModel: ObservableObject {
    private static let segmentationLogger = Logger(
        subsystem: "com.athly.runner",
        category: "WorkoutSegmentation"
    )
    @Published var trainingPlanResponse: TrainingPlanResponse?
    @Published var weeks: [Week] = []
    @Published var todayWorkout: WorkoutModel?
    @Published private(set) var confirmedWorkoutsRevision = 0
    @Published var allWorkouts: [WorkoutModel] = [] {
        didSet { workoutIndex = WorkoutIndex(allWorkouts); workoutsRevision += 1 }
    }
    @Published private(set) var workoutsRevision = 0
    private var workoutIndex = WorkoutIndex()
    private var dataLoadTask: Task<Void, Never>?
    private var dataLoadID = UUID()
    private var lastSuccessfulLoad: Date?
    @Published var weeklyGoals: [WeeklyGoalResponse] = []
    @Published var selectedWeekIndex: Int = 0
    @Published var isLoading: Bool = false
    @Published var isGenerating: Bool = false
    @Published var isGeneratingInBackground: Bool = false
    @Published var showNextWeekNotice = false
    private var noticeTask: Task<Void, Never>?
    private var handledClosureIds = Set<String>()
    @Published private(set) var isRescheduling = false
    @Published var isDeleting: Bool = false
    @Published var errorMessage: String?
    @Published var generationErrorMessage: String?
    @Published var canRetryGeneration = false
    @Published var isResumingPlan = false
    private var resumeRefreshTask: Task<Void, Never>?
    private var resumeVersion = 0
    private var resumableGenerationIds = Set<String>()
    @Published var lastAnalysis: RunAnalysis?
    /// Meta ativa do usuário (inclui o veredito de viabilidade vs. objetivo) — usada na tela de detalhe do plano.
    @Published var activeGoal: CreateGoalResponse?
    /// Conquistas: treinos de tentativa de objetivo em que o atleta atingiu a meta (ver `AchievementStore`).
    @Published var achievementCount: Int = 0

    private var generationPollTask: Task<Void, Never>?
    private var activeGenerationId: String?
    private let pendingGenerationKey = "athly_pending_plan_generation_id"

    private let loadDependencies: PlanLoadDependencies
    private let completionDependencies: WorkoutCompletionDependencies
    private var completingWorkoutIds: Set<String> = []
    private var loadVersion = 0
    private let rescheduleDependencies: PlanRescheduleDependencies
    private let resumeDependencies: PlanResumeDependencies

    init(resumeDependencies: PlanResumeDependencies = PlanResumeDependencies(),
         rescheduleDependencies: PlanRescheduleDependencies = PlanRescheduleDependencies(),
         completionDependencies: WorkoutCompletionDependencies = WorkoutCompletionDependencies(),
         loadDependencies: PlanLoadDependencies = PlanLoadDependencies()) {
        self.loadDependencies = loadDependencies
        self.completionDependencies = completionDependencies
        self.rescheduleDependencies = rescheduleDependencies
        self.resumeDependencies = resumeDependencies
    }

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
        workoutIndex.thisWeek
    }

    static func isDayCompleted(_ day: Date, workouts: [WorkoutModel]) -> Bool {
        let planned = workouts.filter { $0.isOnDay(day) && $0.sportType != .other }
        return !planned.isEmpty && planned.allSatisfy { $0.status == .done }
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
        workoutIndex.streak
    }

    func workouts(on day: Date) -> [WorkoutModel] {
        workoutIndex.byDay[Calendar.current.startOfDay(for: day)] ?? []
    }

    func workout(id: String) -> WorkoutModel? { workoutIndex.byID[id] }

    func refreshCalendar() {
        workoutIndex = WorkoutIndex(allWorkouts)
        workoutsRevision += 1
        todayWorkout = workouts(on: Date()).first
        objectWillChange.send()
    }

    /// Used by tab activation. Explicit refreshes and generation/mutation paths still force a read.
    func loadIfNeeded() async { await loadData(force: false) }

    func invalidateDataLoad() {
        isLoading = false
        loadVersion += 1
        lastSuccessfulLoad = nil
        dataLoadID = UUID()
        dataLoadTask?.cancel()
        dataLoadTask = nil
    }

    // MARK: - Load Data

    func loadData(reportErrors: Bool = true, force: Bool = true) async {
        if let dataLoadTask { await dataLoadTask.value; return }
        if !force, let lastSuccessfulLoad, Date().timeIntervalSince(lastSuccessfulLoad) < 60 { return }
        let id = UUID()
        dataLoadID = id
        let task = Task { await self.performLoad(reportErrors: reportErrors) }
        dataLoadTask = task
        await task.value
        if dataLoadID == id { dataLoadTask = nil }
    }

    private func performLoad(reportErrors: Bool) async {
        let interval = PerformanceTrace.signposter.beginInterval("PlanLoad")
        defer { PerformanceTrace.signposter.endInterval("PlanLoad", interval) }
        loadVersion += 1
        let version = loadVersion
        if allWorkouts.isEmpty && trainingPlanResponse == nil { isLoading = true }
        await LocalStoresBootstrap.prepare()
        guard loadVersion == version else { return }
        let hasCached = allWorkouts.isEmpty ? await hydrateFromCache() : true
        guard loadVersion == version else { return }
        isLoading = !hasCached
        achievementCount = AchievementStore.shared.count
        if reportErrors { errorMessage = nil }

        do {
            guard let plan = try await loadDependencies.plan() else {
                guard loadVersion == version else { return }
                if !hasCached {
                    trainingPlanResponse = nil
                    weeks = []
                    allWorkouts = []
                    weeklyGoals = []
                    todayWorkout = nil
                }
                lastSuccessfulLoad = Date()
                isLoading = false
                return
            }
            async let goalsTask = loadDependencies.goals(plan.id)
            async let workoutsTask = loadDependencies.workouts(plan.id)

            let (goals, workouts) = try await (goalsTask, workoutsTask)
            guard loadVersion == version else { return }
            lastSuccessfulLoad = Date()
            trainingPlanResponse = plan
            completionDependencies.links.reconcileConfirmedWorkouts(workouts)

            weeklyGoals = goals
                .filter { $0.status == .GENERATED || $0.status == .LOCKED }
                .sorted { $0.parsedStartDate < $1.parsedStartDate }
            allWorkouts = workouts
            todayWorkout = Self.todayWorkout(from: allWorkouts)

            let selectedID = weeks.indices.contains(selectedWeekIndex) ? weeks[selectedWeekIndex].id : nil
            weeks = buildWeeks(goals: weeklyGoals, workouts: allWorkouts)
            confirmedWorkoutsRevision += 1
            selectedWeekIndex = selectedID.flatMap { id in weeks.firstIndex { $0.id == id } } ?? currentWeekIndex()
            isLoading = false

            if let freshAnalysis = weeklyGoals.last?.metrics?.asRunAnalysis {
                lastAnalysis = freshAnalysis
            }

            // Meta ativa (com feasibility) para a tela de detalhe — falha aqui não quebra o load do plano.
            let freshGoal = try? await loadDependencies.activeGoal()
            guard loadVersion == version else { return }
            activeGoal = freshGoal

            persistToCache()
            await loadDependencies.notify(allWorkouts)
        } catch APIError.notFound {
            guard loadVersion == version else { return }
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
            if loadVersion == version && !hasCached && reportErrors {
                errorMessage = error.localizedDescription
            }
        }

        if loadVersion == version { isLoading = false }
    }

    @discardableResult
    private func hydrateFromCache() async -> Bool {
        let version = loadVersion
        guard let snapshot = await TrainingPlanCache.shared.loadFromDisk(), loadVersion == version else { return false }
        trainingPlanResponse = snapshot.trainingPlan
        weeklyGoals = snapshot.weeklyGoals.filter {
            $0.status == .GENERATED || $0.status == .LOCKED
        }
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
        invalidateDataLoad()
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

        do {
            let request = (try? await PlannerHealthSyncService.shared.buildInput(
                detailedLimit: trainingPlanResponse == nil ? 5 : 7, requestAuthorization: true
            )) ?? PlanFromHealthRequest(runs: [], detailedSessions: nil, weekStartDate: nil)
            let response = try await APIClient.shared.startPlanFromHealthGeneration(request)
            startGenerationPolling(
                generationId: response.generationId,
                pollAfterSeconds: response.pollAfterSeconds
            )
            await NotificationService.shared.requestAuthorizationIfNeeded()
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

        do {
            let request = try await PlannerHealthSyncService.shared.buildInput(
                detailedLimit: trainingPlanResponse == nil ? 5 : 7, requestAuthorization: false, suppliedRuns: runs)
            let response = try await APIClient.shared.startPlanFromHealthGeneration(request)
            startGenerationPolling(
                generationId: response.generationId,
                pollAfterSeconds: response.pollAfterSeconds
            )
            await NotificationService.shared.requestAuthorizationIfNeeded()
        } catch is CancellationError {
            // ignored
        } catch let error as URLError where error.code == .cancelled {
            // ignored
        } catch {
            errorMessage = error.localizedDescription
        }

        isGenerating = false
    }

    // MARK: - Complete / Skip

    @discardableResult
    func completeWorkout(_ workout: WorkoutModel) async -> WorkoutCompletionOutcome {
        guard beginCompletion(workout.id) else { return completionInProgress }
        defer { completingWorkoutIds.remove(workout.id) }
        return await confirmCompletion(workout)
    }

    @discardableResult
    func completeWorkoutWithRunResult(
        _ workout: WorkoutModel, result: RunResult, healthKitUUID: String?
    ) async -> WorkoutCompletionOutcome {
        guard beginCompletion(workout.id) else { return completionInProgress }
        defer { completingWorkoutIds.remove(workout.id) }
        let segmentation = result.segmentRecords.isEmpty ? nil : WorkoutSegmentationResult(
            segments: result.segmentRecords, origin: .athlyTracker, confidence: .exact, fallbackReason: nil)
        return await confirmCompletion(workout, healthKitUUID: healthKitUUID,
            distance: result.distanceMeters, duration: result.durationSeconds,
            pace: result.averagePaceSecondsPerKm, segmentation: segmentation)
    }

    @discardableResult
    func completeWorkoutWithHealthData(_ workout: WorkoutModel, healthRun: HealthKitRunItem) async -> WorkoutCompletionOutcome {
        guard beginCompletion(workout.id) else { return completionInProgress }
        defer { completingWorkoutIds.remove(workout.id) }
        let detail = await buildExecutionDetail(for: workout, healthRun: healthRun)
        return await confirmCompletion(workout, healthKitUUID: healthRun.id,
            distance: healthRun.distanceMeters, duration: healthRun.durationSeconds,
            pace: healthRun.averagePaceSecondsPerKm, executionDetails: detail?.payload,
            segmentation: detail?.segmentation)
    }

    private var completionInProgress: WorkoutCompletionOutcome {
        .failure(String(localized: "A conclusão deste treino já está em andamento. Aguarde."))
    }

    private func beginCompletion(_ workoutId: String) -> Bool {
        guard completingWorkoutIds.insert(workoutId).inserted else { return false }
        return true
    }

    /// Completion errors belong to the caller presenting WorkoutCompletionOutcome, not the global alert.
    /// The server confirmation is the commit point for every completion entry point.
    private func confirmCompletion(
        _ workout: WorkoutModel, healthKitUUID: String? = nil,
        distance: Double? = nil, duration: Double? = nil, pace: Double? = nil,
        executionDetails: DetailedSessionPayload? = nil,
        segmentation: WorkoutSegmentationResult? = nil,
        onConfirmed: () -> Void = {}
    ) async -> WorkoutCompletionOutcome {
        do {
            await LocalStoresBootstrap.prepare()
            try Task.checkCancellation()
            let updated = try await completionDependencies.request(workout.id, healthKitUUID, distance, duration, executionDetails)
            guard updated.id == workout.id, updated.status == .done || updated.status == .partial else {
                let message = String(localized: "O servidor não confirmou a conclusão do treino. Tente novamente.")
                return .failure(message)
            }
            if let uuid = healthKitUUID {
                completionDependencies.links.replaceLink(healthKitUUID: uuid, athlyWorkoutId: workout.id)
                if let segmentation { completionDependencies.links.storeSegmentation(segmentation, for: uuid) }
            }
            completionDependencies.links.reconcileConfirmedWorkouts([updated])
            onConfirmed()
            replaceWorkout(updated)
            try await completionDependencies.links.flush()
            if let distance, let duration, let pace {
                recordAchievementIfEarned(workout: workout, actualDistanceMeters: distance,
                    actualDurationSeconds: duration, actualPaceSecPerKm: pace)
            }
            await handleWeekClosure(updated)
            return .success
        } catch is CancellationError {
            return .failure(String(localized: "Operação cancelada."))
        } catch let error as URLError where error.code == .cancelled {
            return .failure(String(localized: "Operação cancelada."))
        } catch {
            Self.segmentationLogger.error("Completion failed workoutId=\(workout.id, privacy: .public): \(error.localizedDescription, privacy: .public)")
            return .failure(error.localizedDescription)
        }
    }

    func completeWorkoutWithImportedData(
        _ workout: WorkoutModel,
        imported: ImportedWorkout,
        saveToHealthKit: Bool,
        fallback: ImportedWorkoutHealthKitFallback,
        runStore: RunStore
    ) async -> WorkoutCompletionOutcome {
        guard beginCompletion(workout.id) else { return completionInProgress }
        defer { completingWorkoutIds.remove(workout.id) }
        let workout = allWorkouts.first { $0.id == workout.id } ?? workout
        let healthService = HealthKitService()
        let localOnly = !saveToHealthKit || fallback == .localOnly
        var oldHealthKitUUIDToDelete: String?
        var healthKitUUID = workout.appleHealthWorkoutUUID
            ?? completionDependencies.links.healthKitUUID(forAthlyWorkoutId: workout.id)
            ?? runStore.session(forImportedFingerprint: imported.fingerprint, workoutId: workout.id)?.healthKitWorkoutUUID
        // Keeping the imported file locally must work even if HealthKit is unreadable.
        if localOnly { healthKitUUID = workout.appleHealthWorkoutUUID }

        if healthKitUUID == nil, !localOnly {
            healthKitUUID = await healthService.findEquivalentWorkoutUUID(for: imported)
        }

        var healthSummary: HealthKitRunItem?
        if let uuid = healthKitUUID, !localOnly {
            healthSummary = try? await completionDependencies.fetchHealthRun(uuid)
            if healthSummary == nil && fallback == .ask {
                return .healthKitFallbackRequired(String(localized: "A corrida vinculada não foi encontrada no Apple Health."))
            }
            if healthSummary == nil { healthKitUUID = nil }
        }
        if let healthSummary {
            let match = ImportedWorkoutMatch.evaluate(
                imported: imported,
                healthStartDate: healthSummary.startDate,
                healthDurationSeconds: healthSummary.durationSeconds,
                healthDistanceMeters: healthSummary.distanceMeters
            )
            guard match.isMatch else {
                let message = String(localized: "O arquivo não corresponde à corrida vinculada (\(match.localizedSummary)).")
                return .failure(message)
            }
        }

        await runStore.loadIfNeeded()
        let (candidateSegmentation, importedResult, importedPoints, importedSplits) = await Task.detached(priority: .userInitiated) {
            let reconstructed = WorkoutSegmentationEngine.reconstruct(
                prescription: workout.segments,
                startDate: imported.startDate,
                endDate: imported.endDate,
                route: imported.route,
                pauses: imported.pauseIntervals
            )
            let candidateSegmentation = reconstructed.hasSegments
                ? reconstructed
                : WorkoutSegmentationEngine.fromThirdPartyLaps(
                    imported.laps,
                    fallbackReason: reconstructed.fallbackReason
                ) ?? reconstructed
            let result = imported.runResult
            let points = imported.route.map(RoutePoint.init(location:))
            let splits = result.splits.map { Split(kilometer: $0.kilometer, durationSeconds: $0.durationSeconds,
                                                   distanceMeters: $0.distanceMeters, elevationDelta: $0.elevationDelta) }
            return (candidateSegmentation, result, points, splits)
        }.value
        guard !Task.isCancelled else { return .failure(String(localized: "Operação cancelada.")) }
        let session = runStore.upsert(
            imported: imported,
            athlyWorkoutId: workout.id,
            healthSummary: healthSummary,
            segmentation: candidateSegmentation,
            confirmWorkoutLink: false,
            preparedResult: importedResult,
            preparedPoints: importedPoints,
            preparedSplits: importedSplits
        )
        let segmentation = session.workoutSegmentation ?? candidateSegmentation
        var healthSummaryForTotals = healthSummary
        session.healthKitWorkoutUUID = healthKitUUID ?? session.healthKitWorkoutUUID

        if localOnly {
            session.healthKitSyncStatus = .notRequested
            session.healthKitSyncError = nil
            session.healthKitRouteSyncStatus = .localOnly
            runStore.update(session)
        } else if let existingUUID = healthKitUUID {
            switch fallback {
            case .ask:
                if imported.hasRoute {
                    do {
                        healthKitUUID = try await healthService.attachImportedRoute(
                            imported,
                            toWorkoutUUID: existingUUID
                        )
                        session.healthKitRouteSyncStatus = .attached
                        session.healthKitSyncStatus = .synced
                        session.healthKitSyncError = nil
                    } catch let healthError as HealthKitError {
                        if case .importedWorkoutMismatch = healthError {
                            let message = healthError.localizedDescription
                            session.healthKitRouteSyncStatus = .failed
                            session.healthKitSyncError = message
                            runStore.update(session)
                            return .failure(message)
                        }
                        let message = healthError.localizedDescription
                        session.healthKitRouteSyncStatus = .failed
                        session.healthKitSyncError = message
                        runStore.update(session)
                        return .healthKitFallbackRequired(message)
                    } catch {
                        let message = error.localizedDescription
                        session.healthKitRouteSyncStatus = .failed
                        session.healthKitSyncError = message
                        runStore.update(session)
                        return .healthKitFallbackRequired(message)
                    }
                } else {
                    session.healthKitRouteSyncStatus = .localOnly
                }
            case .localOnly:
                session.healthKitRouteSyncStatus = .localOnly
                session.healthKitSyncStatus = .synced
                session.healthKitSyncError = nil
            case .createCopy:
                do {
                    _ = try await healthService.requestWriteAuthorization()
                    var result = importedResult
                    result.segmentRecords = segmentation.segments
                    guard let newWorkout = try await healthService.saveWorkout(result: result) else {
                        throw HealthKitError.workoutNotReturned
                    }
                    healthKitUUID = newWorkout.uuid.uuidString
                    healthSummaryForTotals = nil
                    session.healthKitRouteSyncStatus = .replacementCreated
                    session.healthKitSyncStatus = .synced
                    session.healthKitSyncError = nil
                    if healthKitUUID != existingUUID { oldHealthKitUUIDToDelete = existingUUID }
                } catch {
                    let message = error.localizedDescription
                    session.healthKitRouteSyncStatus = .failed
                    session.healthKitSyncError = message
                    runStore.update(session)
                    return .failure(message)
                }
            }
            session.healthKitWorkoutUUID = healthKitUUID
            runStore.update(session)
        } else {
            do {
                _ = try await healthService.requestWriteAuthorization()
                var result = importedResult
                result.segmentRecords = segmentation.segments
                guard let created = try await healthService.saveWorkout(result: result) else {
                    throw HealthKitError.workoutNotReturned
                }
                healthKitUUID = created.uuid.uuidString
                healthSummaryForTotals = nil
                session.healthKitWorkoutUUID = healthKitUUID
                session.healthKitSyncStatus = .synced
                session.healthKitSyncError = nil
                session.healthKitRouteSyncStatus = imported.hasRoute ? .attached : .localOnly
                runStore.update(session)
            } catch {
                let message = error.localizedDescription
                session.healthKitSyncStatus = .failed
                session.healthKitRouteSyncStatus = .failed
                session.healthKitSyncError = message
                runStore.update(session)
                return .failure(message)
            }
        }

        let payloadUUID = healthKitUUID
        let payloadSummary = healthSummaryForTotals
        let payloadSegmentation = segmentation
        let details = await Task.detached(priority: .userInitiated) {
            ImportedWorkoutExecutionBuilder.build(
                workout: imported,
                athlyWorkoutId: workout.id,
                healthKitUUID: payloadUUID,
                healthSummary: payloadSummary,
                segmentation: payloadSegmentation
            )
        }.value
        do { try await runStore.flush() } catch { return .failure(error.localizedDescription) }

        let actualDistance = healthSummaryForTotals?.distanceMeters ?? imported.distanceMeters
        let actualDuration = healthSummaryForTotals?.durationSeconds ?? imported.activeDurationSeconds
        let actualPace = healthSummaryForTotals?.averagePaceSecondsPerKm ?? imported.averagePaceSecondsPerKm

        let outcome = await confirmCompletion(workout, healthKitUUID: healthKitUUID,
            distance: actualDistance, duration: actualDuration, pace: actualPace,
            executionDetails: details, segmentation: segmentation, onConfirmed: {
                session.athlyWorkoutId = workout.id
                runStore.update(session)
            })
        if case .success = outcome {
            do { try await runStore.flush() } catch { return .failure(error.localizedDescription) }
        }
        if case .success = outcome, let oldHealthKitUUIDToDelete {
            _ = try? await healthService.deleteWorkoutIfOwned(uuid: oldHealthKitUUIDToDelete)
        }
        return outcome
    }

    func completeWorkoutSelection(
        _ workout: WorkoutModel,
        selection: WorkoutCompletionSelection,
        fallback: ImportedWorkoutHealthKitFallback = .ask,
        runStore: RunStore
    ) async -> WorkoutCompletionOutcome {
        switch selection {
        case .none:
            return await completeWorkout(workout)
        case .healthKit(let run):
            return await completeWorkoutWithHealthData(workout, healthRun: run)
        case .imported(let imported, let saveToHealthKit):
            return await completeWorkoutWithImportedData(
                workout,
                imported: imported,
                saveToHealthKit: saveToHealthKit,
                fallback: fallback,
                runStore: runStore
            )
        }
    }

    private func buildExecutionDetail(for workout: WorkoutModel, healthRun: HealthKitRunItem) async -> WorkoutExecutionDetail? {
        #if targetEnvironment(simulator)
        Self.segmentationLogger.notice("Reconstrução HealthKit indisponível no simulador")
        return nil
        #else
        let service = HealthKitService()
        guard service.isHealthDataAvailable else {
            Self.segmentationLogger.error("HealthKit indisponível ao reconstruir uuid=\(healthRun.id, privacy: .public)")
            return nil
        }
        do {
            guard let rawWorkout = try await service.fetchRawWorkout(uuid: healthRun.id) else {
                Self.segmentationLogger.error("HKWorkout não encontrado uuid=\(healthRun.id, privacy: .public)")
                return nil
            }
            return try await WorkoutDetailFetcher().buildExecutionDetail(
                for: rawWorkout,
                athlyWorkoutId: workout.id,
                prescribedWorkout: workout
            )
        } catch {
            Self.segmentationLogger.error(
                "Falha ao reconstruir uuid=\(healthRun.id, privacy: .public): \(error.localizedDescription, privacy: .public)"
            )
            return nil
        }
        #endif
    }

    /// Desvincula a corrida de um treino concluído: volta o treino para `scheduled` no servidor
    /// e limpa todo o estado local, liberando a corrida para ser assinalada de novo (a mesma ou
    /// outra dentro da janela de busca). Retorna `true` quando o servidor confirmou.
    @discardableResult
    func uncompleteWorkout(_ workout: WorkoutModel, runStore: RunStore) async -> Bool {
        errorMessage = nil
        do {
            let updated = try await APIClient.shared.uncompleteWorkout(workoutId: workout.id)
            // Só limpa o estado local depois do 200: em caso de falha o vínculo continua íntegro.
            RunWorkoutLinkStore.shared.unlinkAll(athlyWorkoutId: workout.id)
            runStore.detach(athlyWorkoutId: workout.id)
            AchievementStore.shared.remove(workoutId: workout.id)
            achievementCount = AchievementStore.shared.count
            replaceWorkout(updated)
            // O lembrete local só é agendado para treinos `scheduled`, então precisa voltar.
            await NotificationService.shared.reschedule(workouts: allWorkouts)
            return true
        } catch is CancellationError {
            return false
        } catch let error as URLError where error.code == .cancelled {
            return false
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func skipWorkout(_ workout: WorkoutModel) async {
        do {
            let updated = try await APIClient.shared.skipWorkout(workoutId: workout.id)
            replaceWorkout(updated)
            await handleWeekClosure(updated)
        } catch is CancellationError {
            // ignored
        } catch let error as URLError where error.code == .cancelled {
            // ignored
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Reagenda um treino para `newDate` (drag-and-drop no calendário do Plano) e re-agenda
    /// as notificações locais, já que a data mudou.
    /// `dayString` é uma data pura `yyyy-MM-dd` no calendário local. O backend só persiste
    /// o dia (retorna a data sem horário), então enviar timestamp UTC deslocava o dia em
    /// fusos a leste de UTC — a data pura mantém o dia estável em qualquer fuso.
    func rescheduleWorkout(_ workout: WorkoutModel, toDay dayString: String) async {
        guard !isRescheduling else { return }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.isLenient = false
        guard let day = formatter.date(from: dayString), formatter.string(from: day) == dayString else { return }
        let decision = rescheduleDecision(workoutID: workout.id, day: day)
        guard decision == .allowed else {
            if let message = decision.message { errorMessage = message }
            return
        }
        isRescheduling = true
        defer { isRescheduling = false }
        do {
            let updated = try await rescheduleDependencies.request(workout.id, dayString)
            replaceWorkout(updated)
            await rescheduleDependencies.notify(allWorkouts)
        } catch is CancellationError {
            // ignored
        } catch let error as URLError where error.code == .cancelled {
            // ignored
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func rescheduleDecision(workoutID: String, day: Date) -> WorkoutRescheduleDecision {
        WorkoutRescheduleDecision.evaluate(workoutID: workoutID, day: day, workouts: allWorkouts)
    }

    private func handleWeekClosure(_ workout: WorkoutModel) async {
        guard let closure = workout.nextWeekGeneration, closure.closed else { return }
        let key = closure.generationId ?? workout.weeklyGoalId ?? workout.id
        guard handledClosureIds.insert(key).inserted else { return }
        await loadData(reportErrors: false)
        await NotificationService.shared.reschedule(workouts: allWorkouts)
        guard let generationId = closure.generationId else { return }
        if closure.status == "failed" {
            generationErrorMessage = String(localized: "Não foi possível gerar a próxima semana. Tente novamente mais tarde.")
            return
        }
        guard closure.status != "completed" else { return }
        showNextWeekNotice = true
        noticeTask?.cancel()
        noticeTask = Task { [weak self] in
            do { try await Task.sleep(nanoseconds: 6_000_000_000) } catch { return }
            self?.showNextWeekNotice = false
        }
        startGenerationPolling(generationId: generationId, pollAfterSeconds: closure.pollAfterSeconds)
    }

    func refreshAutomaticGeneration(retryFailed: Bool = false) async {
        guard await resumeDependencies.isAuthenticated() else { return }
        if let resumeRefreshTask {
            await resumeRefreshTask.value
            return
        }
        let version = resumeVersion
        isResumingPlan = true
        let task = Task { [weak self] in
            guard let self else { return }
            await self.resumeDependencies.syncHealth()
            guard !Task.isCancelled, self.resumeVersion == version else { return }
            do {
                let response = try await self.resumeDependencies.request(retryFailed)
                guard !Task.isCancelled, self.resumeVersion == version else { return }
                if let generation = response.generation {
                    self.resumableGenerationIds.insert(generation.generationId)
                    await self.applyDiscoveredGeneration(generation, showNotice: true)
                    if response.started { await self.loadData(reportErrors: false) }
                } else if let generation = try await self.resumeDependencies.latest() {
                    guard !Task.isCancelled, self.resumeVersion == version else { return }
                    await self.applyDiscoveredGeneration(generation, showNotice: false)
                }
            } catch {
                guard !Task.isCancelled, self.resumeVersion == version else { return }
                if retryFailed {
                    self.generationErrorMessage = String(localized: "Não foi possível preparar seus treinos. Tente novamente.")
                    self.canRetryGeneration = true
                }
                // Automatic failures are retried on the next activation; saved polling IDs still work.
            }
        }
        resumeRefreshTask = task
        await task.value
        if resumeVersion == version {
            resumeRefreshTask = nil
            isResumingPlan = false
        }
    }

    private func applyDiscoveredGeneration(_ generation: AiPlannerGenerationStatusResponse, showNotice: Bool) async {
        if generation.status == "queued" || generation.status == "processing" {
            if showNotice && handledClosureIds.insert(generation.generationId).inserted {
                showNextWeekNotice = true
                noticeTask?.cancel()
                noticeTask = Task { [weak self] in
                    do { try await Task.sleep(nanoseconds: 6_000_000_000) } catch { return }
                    self?.showNextWeekNotice = false
                }
            }
            if activeGenerationId != generation.generationId {
                startGenerationPolling(generationId: generation.generationId, pollAfterSeconds: generation.pollAfterSeconds)
            }
        } else if generation.status == "completed" {
            invalidateDataLoad()
            generationErrorMessage = nil
            canRetryGeneration = false
            await loadData(reportErrors: false)
        } else if generation.status == "failed" {
            generationErrorMessage = String(localized: "Não foi possível preparar seus treinos. Tente novamente.")
            canRetryGeneration = resumableGenerationIds.contains(generation.generationId)
        }
    }

    // MARK: - Background generation polling

    private func startGenerationPolling(
        generationId: String,
        pollAfterSeconds: Int
    ) {
        generationPollTask?.cancel()
        generationErrorMessage = nil
        canRetryGeneration = false
        activeGenerationId = generationId
        UserDefaults.standard.set(generationId, forKey: pendingGenerationKey)
        isGeneratingInBackground = true
        generationPollTask = Task { [weak self] in
            guard let self else { return }
            await self.pollUntilGenerationCompletes(
                generationId: generationId,
                intervalSeconds: pollAfterSeconds
            )
            if self.activeGenerationId == generationId {
                self.isGeneratingInBackground = false
            }
        }
    }

    private func pollUntilGenerationCompletes(
        generationId: String,
        intervalSeconds: Int
    ) async {
        let intervalNanoseconds = UInt64(max(1, intervalSeconds)) * 1_000_000_000
        while !Task.isCancelled {
            do {
                let status = try await APIClient.shared.getPlanFromHealthGenerationStatus(generationId: generationId)
                if status.status == "failed" {
                    canRetryGeneration = resumableGenerationIds.contains(generationId)
                    generationErrorMessage = canRetryGeneration
                        ? String(localized: "Não foi possível preparar seus treinos. Tente novamente.")
                        : String(localized: "Não foi possível gerar a próxima semana. Tente novamente mais tarde.")
                    clearPendingGeneration(generationId)
                    return
                }
                if status.status == "completed" {
                    invalidateDataLoad()
                    await loadData(reportErrors: false)

                    // Só encerra quando os mesmos IDs confirmados pelo job também estiverem
                    // visíveis no contrato de leitura usado pela UI.
                    if let weeklyGoalId = status.weeklyGoalId,
                       !weeklyGoals.contains(where: { $0.id == weeklyGoalId }) {
                        try? await Task.sleep(nanoseconds: intervalNanoseconds)
                        continue
                    }
                    let expectedWorkoutIds = Set(status.workoutIds ?? [])
                    let visibleWorkoutIds = Set(allWorkouts.map(\.id))
                    if !expectedWorkoutIds.isSubset(of: visibleWorkoutIds) {
                        try? await Task.sleep(nanoseconds: intervalNanoseconds)
                        continue
                    }

                    if let weeklyGoalId = status.weeklyGoalId,
                       let index = weeks.firstIndex(where: { $0.id == weeklyGoalId }) {
                        selectedWeekIndex = index
                    } else {
                        selectedWeekIndex = max(0, weeks.count - 1)
                    }
                    await NotificationService.shared.reschedule(workouts: allWorkouts)
                    clearPendingGeneration(generationId)
                    return
                }
            } catch {
                // Falha transitória de rede: o ID persistido permite retomar depois.
            }
            try? await Task.sleep(nanoseconds: intervalNanoseconds)
        }
    }

    func resumePendingGenerationIfNeeded() {
        guard let generationId = UserDefaults.standard.string(forKey: pendingGenerationKey),
              activeGenerationId != generationId else { return }
        startGenerationPolling(generationId: generationId, pollAfterSeconds: 2)
    }

    func handleGenerationPush(generationId: String) {
        invalidateDataLoad()
        startGenerationPolling(generationId: generationId, pollAfterSeconds: 1)
    }

    func cancelPendingGeneration() {
        invalidateDataLoad()
        trainingPlanResponse = nil
        allWorkouts = []
        weeks = []
        weeklyGoals = []
        todayWorkout = nil
        activeGoal = nil
        lastAnalysis = nil
        resumeVersion += 1
        resumeRefreshTask?.cancel()
        resumeRefreshTask = nil
        isResumingPlan = false
        canRetryGeneration = false
        resumableGenerationIds.removeAll()
        noticeTask?.cancel()
        showNextWeekNotice = false
        generationErrorMessage = nil
        handledClosureIds.removeAll()
        generationPollTask?.cancel()
        generationPollTask = nil
        activeGenerationId = nil
        isGeneratingInBackground = false
        UserDefaults.standard.removeObject(forKey: pendingGenerationKey)
    }

    private func clearPendingGeneration(_ generationId: String) {
        guard activeGenerationId == generationId else { return }
        activeGenerationId = nil
        generationPollTask = nil
        isGeneratingInBackground = false
        if UserDefaults.standard.string(forKey: pendingGenerationKey) == generationId {
            UserDefaults.standard.removeObject(forKey: pendingGenerationKey)
        }
    }

    // MARK: - Private Helpers

    private func buildWeeks(goals: [WeeklyGoalResponse], workouts: [WorkoutModel]) -> [Week] {
        goals.enumerated().map { index, goal in
            let weekWorkouts = workoutIndex.byGoal[goal.id] ?? []
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
        invalidateDataLoad() // Discard reads started before this confirmed mutation.
        isLoading = false
        allWorkouts = allWorkouts.map { $0.id == updated.id ? updated : $0 }
        todayWorkout = Self.todayWorkout(from: allWorkouts)
        weeks = buildWeeks(goals: weeklyGoals, workouts: allWorkouts)
        persistToCache()
    }
}
