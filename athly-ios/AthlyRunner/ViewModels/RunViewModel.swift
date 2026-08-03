import Foundation
import CoreLocation
import Combine

@MainActor
final class RunViewModel: ObservableObject {
    @Published var tracker: RunTracker
    @Published var showSummary = false
    @Published var lastRunResult: RunResult?
    @Published var isSaving = false
    @Published var isSaved = false
    @Published var saveError: String?
    @Published private(set) var healthKitWriteDenied = false
    @Published var showWorkoutFeedback = false
    @Published var targetAlert: RunTargetAlert?

    /// Workout agendado que originou esta corrida (definido quando o usuario
    /// clica "Iniciar treino agora" na dashboard). Após salvar, dispara a sheet de feedback.
    var pendingWorkout: WorkoutModel? {
        didSet {
            tracker.loadPlaylist(pendingWorkout?.segments)
            tracker.workoutTitle = pendingWorkout?.title ?? ""
        }
    }

    /// UUID do HKWorkout gravado no Apple Health após esta corrida ser finalizada.
    /// Usado para linkar com o treino prescrito e alimentar análise detalhada na IA.
    private(set) var lastSavedHealthKitUUID: String?

    private let locationManager: LocationManager
    private let healthKitService = HealthKitService()
    private var trackerCancellable: AnyCancellable?
    private var lastSavedSession: RunSession?

    init(locationManager: LocationManager) {
        self.locationManager = locationManager
        self.tracker = RunTracker(locationManager: locationManager)
        bindTracker()
    }

    /// Forward tracker's objectWillChange so SwiftUI re-renders this ViewModel's observers.
    func bindTracker() {
        trackerCancellable = tracker.objectWillChange
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.objectWillChange.send()
            }
    }

    var isRunning: Bool { tracker.state == .running }
    var isPaused: Bool { tracker.state == .paused }
    var isActive: Bool { tracker.state == .running || tracker.state == .paused }

    func startRun() {
        if !locationManager.hasPermission {
            locationManager.requestAlwaysPermission()
            return
        }
        tracker.userWeightKg = UserMetrics.weightKg ?? 70
        tracker.configureTargetAlert(targetAlert)
        tracker.start()
        targetAlert = nil
    }

    func pauseRun() {
        tracker.pause()
    }

    func resumeRun() {
        tracker.resume()
    }

    func finishRun() {
        let result = tracker.stop()
        lastRunResult = result
        showSummary = true
        targetAlert = nil
    }

    func discardRun() {
        tracker.discard()
        showSummary = false
        lastRunResult = nil
        isSaved = false
        saveError = nil
        healthKitWriteDenied = false
        pendingWorkout = nil
        lastSavedHealthKitUUID = nil
        lastSavedSession = nil
        showWorkoutFeedback = false
        targetAlert = nil
    }

    func saveRun(runStore: RunStore) async {
        guard let result = lastRunResult, !isSaved else { return }

        isSaving = true
        saveError = nil
        healthKitWriteDenied = false
        lastSavedHealthKitUUID = nil

        // Save locally
        let session = RunSession(sportType: "running")
        session.startDate = result.startDate
        session.endDate = result.endDate
        session.distanceMeters = result.distanceMeters
        session.durationSeconds = result.durationSeconds
        session.averagePaceSecondsPerKm = result.averagePaceSecondsPerKm
        session.elevationGainMeters = result.elevationGainMeters
        session.caloriesBurned = result.caloriesBurned
        session.status = "completed"
        session.segmentRecords = result.segmentRecords
        if !result.segmentRecords.isEmpty {
            session.workoutSegmentation = WorkoutSegmentationResult(
                segments: result.segmentRecords,
                origin: .athlyTracker,
                confidence: .exact,
                fallbackReason: nil
            )
        }
        session.pauseIntervals = result.pauseIntervals
        session.athlyWorkoutId = pendingWorkout?.id
        session.healthKitSyncStatus = healthKitService.isHealthDataAvailable ? .pending : .unavailable
        session.healthKitSyncError = nil

        for location in result.locations {
            let point = RoutePoint(location: location)
            session.routePoints.append(point)
        }

        for splitData in result.splits {
            let split = Split(
                kilometer: splitData.kilometer,
                durationSeconds: splitData.durationSeconds,
                distanceMeters: splitData.distanceMeters,
                elevationDelta: splitData.elevationDelta
            )
            session.splits.append(split)
        }

        runStore.add(session)
        lastSavedSession = session

        // Save to HealthKit (best-effort; local history remains the fallback source of truth).
        if healthKitService.isHealthDataAvailable {
            do {
                lastSavedHealthKitUUID = try await healthKitService.syncWorkout(
                    result: result,
                    session: session,
                    runStore: runStore
                )
            } catch {
                handleHealthKitSyncError(error)
            }
        } else {
            session.healthKitSyncStatus = .unavailable
            session.healthKitSyncError = HealthKitError.notAvailable.localizedDescription
            runStore.update(session)
            saveError = "Corrida salva no Athly. Apple Health indisponível neste dispositivo."
        }

        isSaving = false
        isSaved = true

        if pendingWorkout != nil {
            showWorkoutFeedback = true
        }
    }

    var canRetryHealthKitSync: Bool {
        guard let session = lastSavedSession else { return false }
        return healthKitService.isHealthDataAvailable
            && session.healthKitWorkoutUUID == nil
            && session.healthKitSyncStatus != .synced
    }

    func retryHealthKitSync(runStore: RunStore) async {
        guard !isSaving,
              let result = lastRunResult,
              let session = lastSavedSession,
              session.healthKitWorkoutUUID == nil else {
            return
        }

        isSaving = true
        saveError = nil
        healthKitWriteDenied = false
        defer { isSaving = false }

        do {
            lastSavedHealthKitUUID = try await healthKitService.syncWorkout(
                result: result,
                session: session,
                runStore: runStore
            )
        } catch {
            handleHealthKitSyncError(error)
        }
    }

    /// Reavalia o status ao voltar dos Ajustes sem criar um workout automaticamente.
    func refreshHealthKitWriteAuthorization() {
        guard healthKitWriteDenied else { return }
        let snapshot = healthKitService.writeAuthorizationSnapshot()
        guard snapshot.canWriteWorkout else { return }
        healthKitWriteDenied = false
        saveError = "Permissão atualizada. Toque em Tentar novamente para enviar ao Apple Health."
    }

    private func handleHealthKitSyncError(_ error: Error) {
        if let healthKitError = error as? HealthKitError,
           case .writeDenied = healthKitError {
            healthKitWriteDenied = true
        }
        saveError = "Corrida salva no Athly. \(error.localizedDescription)"
    }

    func dismissSummary() {
        showSummary = false
        lastRunResult = nil
        isSaved = false
        saveError = nil
        healthKitWriteDenied = false
        lastSavedHealthKitUUID = nil
        lastSavedSession = nil
        targetAlert = nil
    }
}
