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

    /// ID do workout agendado que originou esta corrida (definido quando o usuario
    /// clica "Iniciar treino agora" na dashboard). Usado para marcar o workout como
    /// concluido apos salvar a corrida.
    var pendingWorkoutId: String?

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
                elevationDelta: splitData.elevationDelta
            )
            session.splits.append(split)
        }

        runStore.add(session)

        // Save to HealthKit (best-effort — failure does not block)
        if healthKitService.isHealthDataAvailable {
            do {
                try await healthKitService.requestWriteAuthorization()
                try await healthKitService.saveWorkout(result: result)
            } catch {
                // HealthKit save failed silently; local save is still valid
            }
        }

        // Sync with backend
        do {
            let request = SaveRunRequest(
                sportType: "running",
                dateScheduled: ISO8601DateFormatter().string(from: result.startDate),
                duration: result.durationSeconds,
                distance: result.distanceMeters,
                elevationGain: result.elevationGainMeters,
                calories: result.caloriesBurned,
                averagePace: result.averagePaceSecondsPerKm,
                routePoints: result.locations.map { loc in
                    [
                        "lat": loc.coordinate.latitude,
                        "lng": loc.coordinate.longitude,
                        "alt": loc.altitude,
                        "ts": loc.timestamp.timeIntervalSince1970
                    ]
                },
                splits: result.splits.map { s in
                    SplitRequest(
                        kilometer: s.kilometer,
                        durationSeconds: s.durationSeconds,
                        elevationDelta: s.elevationDelta
                    )
                }
            )

            let response = try await APIClient.shared.saveRun(request)
            session.backendId = response.id
            session.synced = true
            runStore.update(session)
        } catch {
            // Saved locally, will sync later
            saveError = "Salvo localmente. Sincroniza quando houver conexão."
        }

        // Mark the scheduled workout as done if this run was started from the dashboard
        if let workoutId = pendingWorkoutId {
            do {
                _ = try await APIClient.shared.completeWorkout(workoutId: workoutId)
            } catch {
                // Best-effort: workout completion failure does not block the run save
            }
            pendingWorkoutId = nil
        }

        isSaving = false
        isSaved = true
    }

    func dismissSummary() {
        showSummary = false
        lastRunResult = nil
        isSaved = false
        saveError = nil
    }
}
