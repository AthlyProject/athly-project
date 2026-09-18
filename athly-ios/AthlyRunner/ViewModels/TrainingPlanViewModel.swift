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

@MainActor
final class TrainingPlanViewModel: ObservableObject {
    private static let segmentationLogger = Logger(
        subsystem: "com.athly.runner",
        category: "WorkoutSegmentation"
    )
    @Published var trainingPlanResponse: TrainingPlanResponse?
    @Published var weeks: [Week] = []
    @Published var todayWorkout: WorkoutModel?
    @Published var allWorkouts: [WorkoutModel] = []
    @Published var weeklyGoals: [WeeklyGoalResponse] = []
    @Published var selectedWeekIndex: Int = 0
    @Published var isLoading: Bool = false
    @Published var isGenerating: Bool = false
    @Published var isGeneratingInBackground: Bool = false
    @Published var showNextWeekNotice = false
    private var noticeTask: Task<Void, Never>?
    private var handledClosureIds = Set<String>()
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
    @Published var achievementCount: Int = AchievementStore.shared.count

    private var generationPollTask: Task<Void, Never>?
    private var activeGenerationId: String?
    private let pendingGenerationKey = "athly_pending_plan_generation_id"

    private let resumeDependencies: PlanResumeDependencies

    init(resumeDependencies: PlanResumeDependencies = PlanResumeDependencies()) {
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

    func loadData(reportErrors: Bool = true) async {
        let hasCached = hydrateFromCache()
        if !hasCached {
            isLoading = true
        }
        achievementCount = AchievementStore.shared.count
        if reportErrors { errorMessage = nil }

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

            weeklyGoals = goals
                .filter { $0.status == .GENERATED || $0.status == .LOCKED }
                .sorted { $0.parsedStartDate < $1.parsedStartDate }
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
            if !hasCached && reportErrors {
                errorMessage = error.localizedDescription
            }
        }

        isLoading = false
    }

    @discardableResult
    private func hydrateFromCache() -> Bool {
        guard let snapshot = TrainingPlanCache.shared.load() else { return false }
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

    func completeWorkout(_ workout: WorkoutModel) async {
        do {
            let updated = try await APIClient.shared.completeWorkout(workoutId: workout.id)
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
                if !result.segmentRecords.isEmpty {
                    RunWorkoutLinkStore.shared.storeSegmentation(
                        WorkoutSegmentationResult(
                            segments: result.segmentRecords,
                            origin: .athlyTracker,
                            confidence: .exact,
                            fallbackReason: nil
                        ),
                        for: healthKitUUID
                    )
                }
            }

            let updated = try await APIClient.shared.completeWorkout(
                workoutId: workout.id,
                appleHealthWorkoutUUID: healthKitUUID,
                actualDistanceMeters: result.distanceMeters,
                actualDurationSeconds: result.durationSeconds
            )
            replaceWorkout(updated)
            await handleWeekClosure(updated)
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
            let executionDetail = await buildExecutionDetail(for: workout, healthRun: healthRun)
            if let segmentation = executionDetail?.segmentation {
                RunWorkoutLinkStore.shared.storeSegmentation(segmentation, for: healthRun.id)
            }

            let updated = try await APIClient.shared.completeWorkout(
                workoutId: workout.id,
                appleHealthWorkoutUUID: healthRun.id,
                actualDistanceMeters: healthRun.distanceMeters,
                actualDurationSeconds: healthRun.durationSeconds,
                executionDetails: executionDetail?.payload
            )
            replaceWorkout(updated)
            await handleWeekClosure(updated)
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

    /// Persists a normalized file import first, then performs HealthKit and backend syncs
    /// independently. A denied Health permission never discards the imported run.
    func completeWorkoutWithImportedData(
        _ workout: WorkoutModel,
        imported: ImportedWorkout,
        saveToHealthKit: Bool,
        fallback: ImportedWorkoutHealthKitFallback,
        runStore: RunStore
    ) async -> WorkoutCompletionOutcome {
        errorMessage = nil
        let healthService = HealthKitService()
        var healthKitUUID = workout.appleHealthWorkoutUUID
            ?? RunWorkoutLinkStore.shared.healthKitUUID(forAthlyWorkoutId: workout.id)

        if healthKitUUID == nil, saveToHealthKit {
            healthKitUUID = await healthService.findEquivalentWorkoutUUID(for: imported)
        }

        var healthSummary: HealthKitRunItem?
        if let healthKitUUID {
            healthSummary = try? await healthService.fetchRunningWorkout(uuid: healthKitUUID)
            guard let healthSummary else {
                let message = String(localized: "A corrida vinculada não foi encontrada no Apple Health.")
                errorMessage = message
                return .failure(message)
            }
            let match = ImportedWorkoutMatch.evaluate(
                imported: imported,
                healthStartDate: healthSummary.startDate,
                healthDurationSeconds: healthSummary.durationSeconds,
                healthDistanceMeters: healthSummary.distanceMeters
            )
            guard match.isMatch else {
                let message = String(localized: "O arquivo não corresponde à corrida vinculada (\(match.localizedSummary)).")
                errorMessage = message
                return .failure(message)
            }
        }

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
        let session = runStore.upsert(
            imported: imported,
            athlyWorkoutId: workout.id,
            healthSummary: healthSummary,
            segmentation: candidateSegmentation
        )
        let segmentation = session.workoutSegmentation ?? candidateSegmentation
        var healthSummaryForTotals = healthSummary
        session.healthKitWorkoutUUID = healthKitUUID

        if !saveToHealthKit {
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
                            errorMessage = message
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
                    var result = imported.runResult
                    result.segmentRecords = segmentation.segments
                    guard let newWorkout = try await healthService.saveWorkout(result: result) else {
                        throw HealthKitError.workoutNotReturned
                    }
                    healthKitUUID = newWorkout.uuid.uuidString
                    healthSummaryForTotals = nil
                    session.healthKitRouteSyncStatus = .replacementCreated
                    session.healthKitSyncStatus = .synced
                    session.healthKitSyncError = nil
                    _ = try? await healthService.deleteWorkoutIfOwned(uuid: existingUUID)
                } catch {
                    let message = error.localizedDescription
                    errorMessage = message
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
                var result = imported.runResult
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
                errorMessage = message
                session.healthKitSyncStatus = .failed
                session.healthKitRouteSyncStatus = .failed
                session.healthKitSyncError = message
                runStore.update(session)
                return .failure(message)
            }
        }

        if let healthKitUUID {
            RunWorkoutLinkStore.shared.replaceLink(
                healthKitUUID: healthKitUUID,
                athlyWorkoutId: workout.id
            )
            RunWorkoutLinkStore.shared.storeSegmentation(segmentation, for: healthKitUUID)
        }

        let details = ImportedWorkoutExecutionBuilder.build(
            workout: imported,
            athlyWorkoutId: workout.id,
            healthKitUUID: healthKitUUID,
            healthSummary: healthSummaryForTotals,
            segmentation: segmentation
        )

        let actualDistance = healthSummaryForTotals?.distanceMeters ?? imported.distanceMeters
        let actualDuration = healthSummaryForTotals?.durationSeconds ?? imported.activeDurationSeconds
        let actualPace = healthSummaryForTotals?.averagePaceSecondsPerKm ?? imported.averagePaceSecondsPerKm

        do {
            let updated = try await APIClient.shared.completeWorkout(
                workoutId: workout.id,
                appleHealthWorkoutUUID: healthKitUUID,
                actualDistanceMeters: actualDistance,
                actualDurationSeconds: actualDuration,
                executionDetails: details
            )
            replaceWorkout(updated)
            await handleWeekClosure(updated)
            recordAchievementIfEarned(
                workout: workout,
                actualDistanceMeters: actualDistance,
                actualDurationSeconds: actualDuration,
                actualPaceSecPerKm: actualPace
            )
            return .success
        } catch is CancellationError {
            return .failure(String(localized: "Operação cancelada."))
        } catch let error as URLError where error.code == .cancelled {
            return .failure(String(localized: "Operação cancelada."))
        } catch {
            errorMessage = error.localizedDescription
            return .failure(error.localizedDescription)
        }
    }

    func completeWorkoutSelection(
        _ workout: WorkoutModel,
        selection: WorkoutCompletionSelection,
        fallback: ImportedWorkoutHealthKitFallback = .ask,
        runStore: RunStore
    ) async -> WorkoutCompletionOutcome {
        errorMessage = nil
        switch selection {
        case .none:
            await completeWorkout(workout)
        case .healthKit(let run):
            await completeWorkoutWithHealthData(workout, healthRun: run)
        case .imported(let imported, let saveToHealthKit):
            return await completeWorkoutWithImportedData(
                workout,
                imported: imported,
                saveToHealthKit: saveToHealthKit,
                fallback: fallback,
                runStore: runStore
            )
        }
        if let errorMessage {
            return .failure(errorMessage)
        }
        return .success
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
        do {
            let updated = try await APIClient.shared.rescheduleWorkout(workoutId: workout.id, newDate: dayString)
            replaceWorkout(updated)
            await NotificationService.shared.reschedule(workouts: allWorkouts)
        } catch is CancellationError {
            // ignored
        } catch let error as URLError where error.code == .cancelled {
            // ignored
        } catch {
            errorMessage = error.localizedDescription
        }
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
        startGenerationPolling(generationId: generationId, pollAfterSeconds: 1)
    }

    func cancelPendingGeneration() {
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
