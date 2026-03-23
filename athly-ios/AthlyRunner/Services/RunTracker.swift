import Foundation
import CoreLocation
import Combine

@MainActor
final class RunTracker: ObservableObject {
    @Published var state: RunState = .idle
    @Published var elapsedTime: TimeInterval = 0
    @Published var distanceMeters: Double = 0
    @Published var currentPaceSecondsPerKm: Double = 0
    @Published var averagePaceSecondsPerKm: Double = 0
    @Published var currentAltitude: Double = 0
    @Published var elevationGain: Double = 0
    @Published var calories: Double = 0
    @Published var currentSplitKm: Int = 0
    @Published var routeCoordinates: [CLLocationCoordinate2D] = []

    private var timer: Timer?
    private var startTime: Date?
    private var pausedDuration: TimeInterval = 0
    private var pauseStart: Date?
    private var lastLocation: CLLocation?
    private var splitStartTime: Date?
    private var splitStartDistance: Double = 0
    private var lastAltitude: Double?
    private var locationCancellable: AnyCancellable?
    private var locations: [CLLocation] = []

    private let locationManager: LocationManager

    // Pace smoothing buffer
    private var recentSpeeds: [Double] = []
    private let speedBufferSize = 5

    enum RunState {
        case idle, running, paused, finished
    }

    init(locationManager: LocationManager) {
        self.locationManager = locationManager
    }

    // MARK: - Controls

    func start() {
        state = .running
        startTime = Date()
        splitStartTime = Date()
        splitStartDistance = 0
        currentSplitKm = 0
        lastLocation = nil
        lastAltitude = nil
        locations = []
        routeCoordinates = []
        recentSpeeds = []

        locationManager.startTracking()
        startTimer()
        observeLocation()
    }

    func pause() {
        guard state == .running else { return }
        state = .paused
        pauseStart = Date()
        timer?.invalidate()
        timer = nil
    }

    func resume() {
        guard state == .paused else { return }
        state = .running
        if let pauseStart {
            pausedDuration += Date().timeIntervalSince(pauseStart)
        }
        pauseStart = nil
        startTimer()
    }

    func stop() -> RunResult {
        state = .finished
        timer?.invalidate()
        timer = nil
        locationManager.stopTracking()
        locationCancellable?.cancel()

        if let pauseStart {
            pausedDuration += Date().timeIntervalSince(pauseStart)
        }

        let result = RunResult(
            startDate: startTime ?? Date(),
            endDate: Date(),
            distanceMeters: distanceMeters,
            durationSeconds: elapsedTime,
            averagePaceSecondsPerKm: averagePaceSecondsPerKm,
            elevationGainMeters: elevationGain,
            caloriesBurned: calories,
            locations: locations,
            splits: buildSplits()
        )

        reset()
        return result
    }

    func discard() {
        timer?.invalidate()
        timer = nil
        locationManager.stopTracking()
        locationCancellable?.cancel()
        reset()
    }

    // MARK: - Private

    private func reset() {
        state = .idle
        elapsedTime = 0
        distanceMeters = 0
        currentPaceSecondsPerKm = 0
        averagePaceSecondsPerKm = 0
        currentAltitude = 0
        elevationGain = 0
        calories = 0
        currentSplitKm = 0
        routeCoordinates = []
        pausedDuration = 0
        pauseStart = nil
        lastLocation = nil
        lastAltitude = nil
        locations = []
        recentSpeeds = []
    }

    private func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.updateElapsedTime()
            }
        }
    }

    private func updateElapsedTime() {
        guard let startTime, state == .running else { return }
        elapsedTime = Date().timeIntervalSince(startTime) - pausedDuration
        updateCalories()
    }

    private func observeLocation() {
        locationCancellable = locationManager.$currentLocation
            .compactMap { $0 }
            .sink { [weak self] location in
                Task { @MainActor in
                    self?.processNewLocation(location)
                }
            }
    }

    private func processNewLocation(_ location: CLLocation) {
        guard state == .running else { return }

        locations.append(location)
        routeCoordinates.append(location.coordinate)
        currentAltitude = location.altitude

        // Calculate distance
        if let last = lastLocation {
            let delta = location.distance(from: last)

            // Filter out GPS jumps (> 50m between updates at walking/running speed)
            guard delta < 50 else { return }

            distanceMeters += delta

            // Elevation gain (only count positive)
            if let lastAlt = lastAltitude {
                let elevDelta = location.altitude - lastAlt
                if elevDelta > 0.5 { // threshold to reduce noise
                    elevationGain += elevDelta
                }
            }

            // Current pace (smoothed)
            if location.speed > 0.3 { // moving threshold ~1 km/h
                recentSpeeds.append(location.speed)
                if recentSpeeds.count > speedBufferSize {
                    recentSpeeds.removeFirst()
                }
                let avgSpeed = recentSpeeds.reduce(0, +) / Double(recentSpeeds.count)
                currentPaceSecondsPerKm = 1000.0 / avgSpeed
            }

            // Average pace
            if distanceMeters > 0, elapsedTime > 0 {
                averagePaceSecondsPerKm = elapsedTime / (distanceMeters / 1000.0)
            }

            // Split detection
            let currentKm = Int(distanceMeters / 1000.0)
            if currentKm > currentSplitKm {
                currentSplitKm = currentKm
                splitStartTime = Date()
                splitStartDistance = distanceMeters
            }
        }

        lastLocation = location
        lastAltitude = location.altitude
    }

    private func updateCalories() {
        // Rough estimate: ~1 kcal per kg per km for running
        // Using 70kg as default (will be replaced with user weight)
        let weightKg = 70.0
        calories = (distanceMeters / 1000.0) * weightKg * 1.036
    }

    private func buildSplits() -> [SplitData] {
        // Build splits from location data
        var splits: [SplitData] = []
        var splitLocations: [[CLLocation]] = []
        var currentSplitLocs: [CLLocation] = []
        var accumulatedDistance: Double = 0
        var previousLocation: CLLocation?

        for location in locations {
            currentSplitLocs.append(location)
            if let prev = previousLocation {
                accumulatedDistance += location.distance(from: prev)
            }
            previousLocation = location

            if accumulatedDistance >= 1000 {
                splitLocations.append(currentSplitLocs)
                currentSplitLocs = [location]
                accumulatedDistance = accumulatedDistance.truncatingRemainder(dividingBy: 1000)
            }
        }
        if !currentSplitLocs.isEmpty {
            splitLocations.append(currentSplitLocs)
        }

        for (index, locs) in splitLocations.enumerated() {
            guard let first = locs.first, let last = locs.last else { continue }
            let duration = last.timestamp.timeIntervalSince(first.timestamp)
            let elevDelta = last.altitude - first.altitude
            splits.append(SplitData(
                kilometer: index + 1,
                durationSeconds: duration,
                elevationDelta: elevDelta
            ))
        }

        return splits
    }
}

struct RunResult {
    let startDate: Date
    let endDate: Date
    let distanceMeters: Double
    let durationSeconds: Double
    let averagePaceSecondsPerKm: Double
    let elevationGainMeters: Double
    let caloriesBurned: Double
    let locations: [CLLocation]
    let splits: [SplitData]
}

struct SplitData {
    let kilometer: Int
    let durationSeconds: Double
    let elevationDelta: Double

    var paceSecondsPerKm: Double { durationSeconds }

    var formattedPace: String {
        let minutes = Int(paceSecondsPerKm) / 60
        let seconds = Int(paceSecondsPerKm) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}
