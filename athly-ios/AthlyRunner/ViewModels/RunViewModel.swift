import Foundation
import SwiftData
import CoreLocation

@MainActor
final class RunViewModel: ObservableObject {
    @Published var tracker: RunTracker
    @Published var showSummary = false
    @Published var lastRunResult: RunResult?
    @Published var isSaving = false
    @Published var saveError: String?

    private let locationManager: LocationManager

    init(locationManager: LocationManager) {
        self.locationManager = locationManager
        self.tracker = RunTracker(locationManager: locationManager)
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
    }

    func saveRun(modelContext: ModelContext) async {
        guard let result = lastRunResult else { return }

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
            point.runSession = session
            session.routePoints.append(point)
        }

        for splitData in result.splits {
            let split = Split(
                kilometer: splitData.kilometer,
                durationSeconds: splitData.durationSeconds,
                elevationDelta: splitData.elevationDelta
            )
            split.runSession = session
            session.splits.append(split)
        }

        modelContext.insert(session)
        try? modelContext.save()

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
            try? modelContext.save()
        } catch {
            // Saved locally, will sync later
            saveError = "Salvo localmente. Sincroniza quando houver conexão."
        }

        isSaving = false
        showSummary = false
        lastRunResult = nil
    }
}
