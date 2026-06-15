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
    @Published var showWorkoutFeedback = false

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
        tracker.start()
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
    }

    func discardRun() {
        tracker.discard()
        showSummary = false
        lastRunResult = nil
        isSaved = false
        saveError = nil
        pendingWorkout = nil
        lastSavedHealthKitUUID = nil
        showWorkoutFeedback = false
    }

    func saveRun(runStore: RunStore) async {
        guard let result = lastRunResult, !isSaved else { return }

        isSaving = true
        saveError = nil

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

        // Save to HealthKit (best-effort — failure does not block)
        if healthKitService.isHealthDataAvailable {
            do {
                try await healthKitService.requestWriteAuthorization()
                let savedWorkout = try await healthKitService.saveWorkout(result: result)
                if let uuid = savedWorkout?.uuid.uuidString {
                    lastSavedHealthKitUUID = uuid
                    if let workout = pendingWorkout {
                        RunWorkoutLinkStore.shared.link(healthKitUUID: uuid, athlyWorkoutId: workout.id)
                    }
                }
            } catch {
                // HealthKit save failed silently; local save is still valid
            }
        }

        // HealthKit-first: a corrida fica durável no Apple Health (salvo acima) e o histórico
        // é lido de lá. O backend só guarda a camada de coaching (plano/metas/feedback) +
        // o vínculo via appleHealthWorkoutUUID no completeWorkout — não persistimos a corrida crua.
        isSaving = false
        isSaved = true

        if pendingWorkout != nil {
            showWorkoutFeedback = true
        }
    }

    func dismissSummary() {
        showSummary = false
        lastRunResult = nil
        isSaved = false
        saveError = nil
    }
}
