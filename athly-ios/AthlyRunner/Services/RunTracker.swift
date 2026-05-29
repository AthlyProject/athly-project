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
    @Published var liveActivityDisabled = false
    @Published var activeSegmentIndex: Int = 0

    private(set) var playlist: [ActiveSegment] = []
    private var segmentStartDistance: Double = 0
    private var segmentStartElapsed: TimeInterval = 0
    private var countdownFired: Bool = false

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

    // Sliding window for real-time pace (GPS timestamp-based)
    private var paceWindow: [CLLocation] = []
    private let paceWindowSeconds: Double = 20
    /// Gap (em s) entre fixes que indica entrega de GPS interrompida (ex.: tela bloqueada).
    /// Acima disso a janela de pace é zerada para não cruzar o buraco e mostrar pace lento.
    private let paceGapResetSeconds: Double = 6
    /// Velocidade máxima plausível em corrida (m/s ≈ 2:23/km). Acima disso é salto de GPS.
    private let maxPlausibleSpeed: Double = 7.0

    enum RunState {
        case idle, running, paused, finished
    }

    init(locationManager: LocationManager) {
        self.locationManager = locationManager
    }

    /// Título do treino vinculado (para o Live Activity widget)
    var workoutTitle: String = ""

    // MARK: - Segment API

    var currentSegment: ActiveSegment? {
        guard activeSegmentIndex < playlist.count else { return nil }
        return playlist[activeSegmentIndex]
    }

    var nextSegment: ActiveSegment? {
        let next = activeSegmentIndex + 1
        guard next < playlist.count else { return nil }
        return playlist[next]
    }

    var segmentProgress: Double {
        guard let seg = currentSegment else { return 0 }
        switch seg.end.by {
        case .distanceM:
            return min(1.0, (distanceMeters - segmentStartDistance) / max(1, seg.end.value))
        case .durationSec:
            return min(1.0, (elapsedTime - segmentStartElapsed) / max(1, seg.end.value))
        case .reps:
            return 0
        }
    }

    func loadPlaylist(_ workoutSegments: WorkoutSegments?) {
        playlist = workoutSegments?.flatten() ?? []
        activeSegmentIndex = 0
    }

    func skipSegment() {
        guard activeSegmentIndex < playlist.count else { return }
        advanceSegment(skipped: true)
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
        paceWindow = []
        activeSegmentIndex = 0
        segmentStartDistance = 0
        segmentStartElapsed = 0
        countdownFired = false

        locationManager.startTracking()
        startTimer()
        observeLocation()

        if let first = playlist.first {
            CueOrchestrator.shared.fire(.boundary(to: first))
        }

        Task { @MainActor in
            let result = await LiveActivityManager.shared.startActivity(workoutTitle: workoutTitle)
            if case .disabledBySystem = result {
                liveActivityDisabled = true
            }
        }
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

        let stopTime = Date()
        if let pauseStart {
            pausedDuration += stopTime.timeIntervalSince(pauseStart)
        }

        let finalDuration = stopTime.timeIntervalSince(startTime ?? stopTime) - pausedDuration
        let finalPace = distanceMeters > 0 ? finalDuration / (distanceMeters / 1000.0) : 0

        let result = RunResult(
            startDate: startTime ?? stopTime,
            endDate: stopTime,
            distanceMeters: distanceMeters,
            durationSeconds: finalDuration,
            averagePaceSecondsPerKm: finalPace,
            elevationGainMeters: elevationGain,
            caloriesBurned: calories,
            locations: locations,
            splits: buildSplits()
        )

        LiveActivityManager.shared.endActivity()
        reset()
        return result
    }

    func discard() {
        timer?.invalidate()
        timer = nil
        locationManager.stopTracking()
        locationCancellable?.cancel()
        LiveActivityManager.shared.endActivity()
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
        paceWindow = []
        activeSegmentIndex = 0
        segmentStartDistance = 0
        segmentStartElapsed = 0
        countdownFired = false
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
        checkSegmentBoundary()
        LiveActivityManager.shared.updateActivity(
            elapsedSeconds: Int(elapsedTime),
            distanceMeters: distanceMeters,
            paceSecondsPerKm: currentPaceSecondsPerKm
        )
    }

    private func observeLocation() {
        // Assina o fluxo ordenado de todos os pontos (não `$currentLocation`, que coalesce
        // e perde pontos do lote entregue ao desbloquear a tela).
        locationCancellable = locationManager.locationUpdates
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
            let dt = location.timestamp.timeIntervalSince(last.timestamp)

            // Filtro de salto de GPS por plausibilidade de velocidade (em vez de um limite
            // fixo de 50m). Um gap legítimo com a tela bloqueada gera um delta grande, mas
            // com dt grande → velocidade plausível → contamos a distância (sem subcontar).
            // Já um teleporte de GPS tem dt pequeno → velocidade absurda → ignoramos (sem
            // atualizar lastLocation, para medir o próximo ponto a partir do último bom).
            let impliedSpeed = dt > 0 ? delta / dt : .infinity
            guard impliedSpeed <= maxPlausibleSpeed else { return }

            distanceMeters += delta

            // Elevation gain (only count positive)
            if let lastAlt = lastAltitude {
                let elevDelta = location.altitude - lastAlt
                if elevDelta > 0.5 { // threshold to reduce noise
                    elevationGain += elevDelta
                }
            }

            // Current pace — sliding time-window from GPS coordinates (same method as splits).
            // Se houve um buraco na entrega de GPS (tela bloqueada), zera a janela para ela
            // reconstruir a partir de fixes novos em vez de cruzar o gap e mostrar pace lento.
            if let lastInWindow = paceWindow.last,
               location.timestamp.timeIntervalSince(lastInWindow.timestamp) > paceGapResetSeconds {
                paceWindow.removeAll()
            }
            paceWindow.append(location)
            while let first = paceWindow.first,
                  location.timestamp.timeIntervalSince(first.timestamp) > paceWindowSeconds {
                paceWindow.removeFirst()
            }
            if paceWindow.count >= 2 {
                var windowDist: Double = 0
                for i in 1..<paceWindow.count {
                    windowDist += paceWindow[i].distance(from: paceWindow[i - 1])
                }
                let windowTime = paceWindow.last!.timestamp.timeIntervalSince(paceWindow.first!.timestamp)
                if windowDist > 5, windowTime > 0 {
                    currentPaceSecondsPerKm = (windowTime / windowDist) * 1000.0
                }
            }

            // Average pace
            if distanceMeters > 0, elapsedTime > 0 {
                averagePaceSecondsPerKm = elapsedTime / (distanceMeters / 1000.0)
            }

            checkSegmentBoundary()

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

    private func checkSegmentBoundary() {
        guard !playlist.isEmpty, activeSegmentIndex < playlist.count else { return }
        let seg = playlist[activeSegmentIndex]

        switch seg.end.by {
        case .distanceM:
            let done = distanceMeters - segmentStartDistance
            let remaining = seg.end.value - done
            if !countdownFired && currentPaceSecondsPerKm > 0 && remaining > 0 {
                let etaSec = remaining * currentPaceSecondsPerKm / 1000.0
                if etaSec <= 3.5 {
                    countdownFired = true
                    CueOrchestrator.shared.fire(.countdown3)
                }
            }
            if done >= seg.end.value { advanceSegment(skipped: false) }

        case .durationSec:
            let done = elapsedTime - segmentStartElapsed
            let remaining = seg.end.value - done
            if !countdownFired && remaining > 0 && remaining <= 3.0 {
                countdownFired = true
                CueOrchestrator.shared.fire(.countdown3)
            }
            if done >= seg.end.value { advanceSegment(skipped: false) }

        case .reps:
            break // manual skip only
        }
    }

    private func advanceSegment(skipped: Bool) {
        let completed = playlist[activeSegmentIndex]
        activeSegmentIndex += 1
        countdownFired = false
        segmentStartDistance = distanceMeters
        segmentStartElapsed = elapsedTime

        let isSetDone = !skipped
            && completed.setIndex != nil
            && completed.setIndex == completed.setTotal

        guard activeSegmentIndex < playlist.count else { return }
        let next = playlist[activeSegmentIndex]

        if isSetDone {
            CueOrchestrator.shared.fire(.setComplete(
                setLabel: completed.label,
                setsTotal: completed.setTotal ?? 0
            ))
            Task { @MainActor [weak self] in
                try? await Task.sleep(nanoseconds: 1_400_000_000)
                guard let self, self.activeSegmentIndex < self.playlist.count else { return }
                CueOrchestrator.shared.fire(.boundary(to: self.playlist[self.activeSegmentIndex]))
            }
        } else {
            CueOrchestrator.shared.fire(.boundary(to: next))
        }
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
