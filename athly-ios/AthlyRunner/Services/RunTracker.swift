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
    private var segmentStartDate: Date?
    /// Fronteiras reais dos segmentos executados — vão para o HealthKit como
    /// HKWorkoutEvents para a análise da IA reconstruir a estrutura do treino.
    private var segmentRecords: [SegmentRecord] = []
    private var countdownFired: Bool = false
    private var targetAlert: RunTargetAlert?
    private var targetAlertFired = false

    private var timer: Timer?
    private var startTime: Date?
    private var pausedDuration: TimeInterval = 0
    private var pauseStart: Date?
    /// Janelas de pausa explícita (botão de pausa). Vão para o `RunResult` e persistem no
    /// `RunSession` para o cálculo offline de splits descontar a pausa igual ao caminho ao vivo.
    private var pauseIntervals: [SplitCalculator.PauseInterval] = []
    private var lastLocation: CLLocation?
    private var splitStartTime: Date?
    private var splitStartDistance: Double = 0
    /// Ganho de elevação filtrado (gate de vAcc + suavização + deadband). Ver ElevationAccumulator.
    private var elevationAccumulator = ElevationAccumulator()
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
    /// Sem fix aceito há mais que isto → o pace exibido é invalidado ("--:--").
    /// Congelar o último valor bom mostrava 5'10 na tela enquanto o GPS estava cego.
    private let paceStaleSeconds: Double = 8
    /// Gap máximo que ainda recebe crédito de distância pela velocidade pré-gap.
    private let maxBridgeGapSeconds: Double = 90
    /// Velocidade recente (m/s, EMA) — preferindo o Doppler do GPS, muito mais estável
    /// que deltas de posição. Base do pace exibido e do crédito de distância em gaps.
    private var recentSpeedMps: Double = 0
    /// Momento do último resume — um gap que contém uma pausa não recebe crédito de distância.
    private var lastResumeDate: Date?
    /// Throttle dos updates da Live Activity (o relógio do widget anda sozinho via timerInterval).
    private var lastLiveActivityPush: Date = .distantPast

    enum RunState {
        case idle, running, paused, finished
    }

    init(locationManager: LocationManager) {
        self.locationManager = locationManager
    }

    /// Título do treino vinculado (para o Live Activity widget)
    var workoutTitle: String = ""

    /// Peso do usuário (kg) usado na estimativa de calorias. Definido em `RunViewModel.startRun`.
    var userWeightKg: Double = 70

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

    func configureTargetAlert(_ alert: RunTargetAlert?) {
        targetAlert = alert
        targetAlertFired = false
    }

    // MARK: - Controls

    func start() {
        state = .running
        startTime = Date()
        splitStartTime = Date()
        splitStartDistance = 0
        currentSplitKm = 0
        lastLocation = nil
        elevationAccumulator.reset()
        locations = []
        routeCoordinates = []
        paceWindow = []
        activeSegmentIndex = 0
        segmentStartDistance = 0
        segmentStartElapsed = 0
        segmentStartDate = Date()
        segmentRecords = []
        countdownFired = false
        targetAlertFired = false

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
        // A corda entre o último fix e o primeiro pós-resume é deriva do GPS parado — não deve
        // somar distância. Zerar `lastLocation` faz o primeiro fix pós-resume cair no ramo
        // `lastLocation == nil` (distância zero); a janela de pace e a velocidade recente também
        // são reiniciadas para não atravessar o buraco da pausa.
        lastLocation = nil
        paceWindow = []
        recentSpeedMps = 0
        timer?.invalidate()
        timer = nil
        // Congela o relógio do widget imediatamente (isPaused → tempo estático).
        pushLiveActivityIfDue(force: true)
    }

    func resume() {
        guard state == .paused else { return }
        state = .running
        if let pauseStart {
            let now = Date()
            pausedDuration += now.timeIntervalSince(pauseStart)
            pauseIntervals.append(.init(start: pauseStart, end: now))
        }
        pauseStart = nil
        lastResumeDate = Date()
        startTimer()
        pushLiveActivityIfDue(force: true)
    }

    func stop() -> RunResult {
        state = .finished
        timer?.invalidate()
        timer = nil
        locationManager.stopTracking()
        locationCancellable?.cancel()
        CueOrchestrator.shared.stopAll()

        let stopTime = Date()
        if let pauseStart {
            pausedDuration += stopTime.timeIntervalSince(pauseStart)
            pauseIntervals.append(.init(start: pauseStart, end: stopTime))
        }

        let finalDuration = stopTime.timeIntervalSince(startTime ?? stopTime) - pausedDuration
        let finalPace = distanceMeters > 0 ? finalDuration / (distanceMeters / 1000.0) : 0

        // Fecha o segmento em andamento (parcial) para a estrutura executada ficar completa.
        if activeSegmentIndex < playlist.count {
            let inFlight = playlist[activeSegmentIndex]
            let dist = max(0, distanceMeters - segmentStartDistance)
            let dur = max(0, elapsedTime - segmentStartElapsed)
            if dist > 10 || dur > 5 {
                recordCompletedSegment(inFlight, endDate: stopTime, skipped: false)
            }
        }

        let result = RunResult(
            startDate: startTime ?? stopTime,
            endDate: stopTime,
            distanceMeters: distanceMeters,
            durationSeconds: finalDuration,
            averagePaceSecondsPerKm: finalPace,
            elevationGainMeters: elevationGain,
            caloriesBurned: calories,
            locations: locations,
            splits: buildSplits(),
            segmentRecords: segmentRecords,
            pauseIntervals: pauseIntervals
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
        CueOrchestrator.shared.stopAll()
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
        pauseIntervals = []
        lastLocation = nil
        elevationAccumulator.reset()
        locations = []
        paceWindow = []
        activeSegmentIndex = 0
        segmentStartDistance = 0
        segmentStartElapsed = 0
        segmentStartDate = nil
        segmentRecords = []
        countdownFired = false
        targetAlert = nil
        targetAlertFired = false
        recentSpeedMps = 0
        lastResumeDate = nil
        lastLiveActivityPush = .distantPast
    }

    private func recordCompletedSegment(_ segment: ActiveSegment, endDate: Date, skipped: Bool) {
        let start = segmentStartDate ?? startTime ?? endDate
        guard endDate > start else { return }
        segmentRecords.append(SegmentRecord(
            kind: segment.kind,
            setIndex: segment.setIndex,
            setTotal: segment.setTotal,
            label: segment.label,
            startDate: start,
            endDate: endDate,
            distanceMeters: max(0, distanceMeters - segmentStartDistance),
            durationSeconds: max(0, elapsedTime - segmentStartElapsed),
            skipped: skipped
        ))
    }

    private func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.updateElapsedTime()
            }
        }
    }

    private func updateElapsedTime() {
        guard state == .running else { return }
        refreshElapsedTime()
        updateCalories()
        checkSegmentBoundary()
        checkTargetAlert()

        // Em buraco de GPS prolongado (8s+ sem fix novo), invalida o pace exibido em vez de
        // congelar o último valor — evita mostrar um ritmo defasado quando o sinal cai.
        if let lastFix = lastLocation?.timestamp,
           Date().timeIntervalSince(lastFix) > paceStaleSeconds {
            currentPaceSecondsPerKm = 0
        }

        pushLiveActivityIfDue()
    }

    private func refreshElapsedTime(at now: Date = Date()) {
        guard let startTime, state == .running else { return }
        elapsedTime = max(0, now.timeIntervalSince(startTime) - pausedDuration)
    }

    /// Empurra estado para a Live Activity no máximo a cada 3s — o relógio do widget
    /// anda sozinho (Text(timerInterval:)), então updates por segundo só gastavam
    /// bateria e arriscavam throttling do ActivityKit (tela de bloqueio defasada).
    private func pushLiveActivityIfDue(force: Bool = false) {
        let now = Date()
        guard force || now.timeIntervalSince(lastLiveActivityPush) >= 3 else { return }
        lastLiveActivityPush = now
        LiveActivityManager.shared.updateActivity(
            elapsedSeconds: Int(elapsedTime),
            distanceMeters: distanceMeters,
            paceSecondsPerKm: currentPaceSecondsPerKm,
            startedAt: now.addingTimeInterval(-elapsedTime),
            isPaused: state == .paused
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
        refreshElapsedTime()

        locations.append(location)
        routeCoordinates.append(location.coordinate)
        currentAltitude = location.altitude

        // Ganho de elevação filtrado (gate de vAcc + suavização + deadband). Roda para todo fix
        // aceito (inclusive logo após um resume) — o GPS cru inflava o número com o salto de
        // aquecimento (ex.: +92 m em 2 s) e perdia rampas lentas no limiar por amostra.
        elevationAccumulator.add(altitude: location.altitude, verticalAccuracy: location.verticalAccuracy)
        elevationGain = elevationAccumulator.gain

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

            // Gap de entrega com movimento (GPS degradado/cego): a corda entre o último
            // ponto bom e este perde as curvas do trajeto — credita a distância estimada
            // pela velocidade recente. Não se aplica se uma pausa caiu dentro do gap
            // (os pontos da pausa são descartados e o crédito seria falso).
            var distStep = delta
            if dt > paceGapResetSeconds,
               dt <= maxBridgeGapSeconds,
               impliedSpeed >= 0.5,
               recentSpeedMps > 0.5,
               lastResumeDate.map({ $0 <= last.timestamp }) ?? true {
                distStep = min(max(delta, recentSpeedMps * dt), maxPlausibleSpeed * dt)
            }

            distanceMeters += distStep

            // Current pace — janela deslizante de deltas de posição (NÃO o location.speed).
            // O medidor nativo do iOS é pré-suavizado pelo chip e atrasa em mudança de ritmo
            // (tiro), travando o pace exibido perto do ritmo de recuperação; deltas respondem
            // direto ao movimento. Se houve um buraco na entrega de GPS (tela bloqueada), zera
            // a janela para reconstruir a partir de fixes novos em vez de cruzar o gap.
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
                    // Velocidade recente para o bridge de distância em buracos — derivada
                    // da mesma janela de deltas (não do Doppler).
                    recentSpeedMps = windowDist / windowTime
                }
            }

            // Average pace
            if distanceMeters > 0, elapsedTime > 0 {
                averagePaceSecondsPerKm = elapsedTime / (distanceMeters / 1000.0)
            }

            checkSegmentBoundary()
            checkTargetAlert()

            // Split detection
            let currentKm = Int(distanceMeters / 1000.0)
            if currentKm > currentSplitKm {
                currentSplitKm = currentKm
                splitStartTime = Date()
                splitStartDistance = distanceMeters
            }
        }

        lastLocation = location
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

    private func checkTargetAlert() {
        guard let targetAlert, !targetAlertFired else { return }

        let reached: Bool
        switch targetAlert.kind {
        case .distance:
            reached = targetAlert.thresholdMeters.map { distanceMeters >= $0 } ?? false
        case .time:
            reached = targetAlert.thresholdSeconds.map { elapsedTime >= $0 } ?? false
        }

        guard reached else { return }
        targetAlertFired = true
        CueOrchestrator.shared.fire(.targetAlertReached(targetAlert))
    }

    private func advanceSegment(skipped: Bool) {
        let completed = playlist[activeSegmentIndex]
        recordCompletedSegment(completed, endDate: Date(), skipped: skipped)
        activeSegmentIndex += 1
        countdownFired = false
        segmentStartDistance = distanceMeters
        segmentStartElapsed = elapsedTime
        segmentStartDate = Date()

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
                guard let self,
                      self.state == .running,
                      self.activeSegmentIndex < self.playlist.count else { return }
                CueOrchestrator.shared.fire(.boundary(to: self.playlist[self.activeSegmentIndex]))
            }
        } else {
            CueOrchestrator.shared.fire(.boundary(to: next))
        }
    }

    private func updateCalories() {
        // Estimativa: ~1 kcal por kg por km de corrida. Usa o peso real do usuário quando conhecido.
        calories = (distanceMeters / 1000.0) * userWeightKg * 1.036
    }

    private func buildSplits() -> [SplitData] {
        // Mesma base de cálculo do pace ao vivo (filtro de salto, exclusão de pausa/buraco,
        // primeiro movimento, fronteiras exatas) via algoritmo compartilhado — ver SplitCalculator.
        SplitCalculator.kmSplits(from: locations, pauses: pauseIntervals).map {
            SplitData(
                kilometer: $0.kilometer,
                distanceMeters: $0.distanceMeters,
                durationSeconds: $0.durationSeconds,
                elevationDelta: $0.elevationDelta
            )
        }
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
    /// Fronteiras reais dos segmentos executados (vazio em corrida livre).
    var segmentRecords: [SegmentRecord] = []
    /// Janelas de pausa explícita — descontadas no cálculo offline de splits e gravadas no Health.
    var pauseIntervals: [SplitCalculator.PauseInterval] = []
}

/// Um segmento do treino estruturado como foi de fato executado. Persiste no
/// HealthKit como HKWorkoutEvent(.segment) com metadata — é a fonte que permite
/// à análise da IA avaliar tiros/recuperações com distância e duração reais.
struct SegmentRecord: Codable, Equatable, Sendable {
    let kind: SegmentKind
    let setIndex: Int?
    let setTotal: Int?
    let label: String
    let startDate: Date
    let endDate: Date
    let distanceMeters: Double
    /// Duração ativa (pausas descontadas).
    let durationSeconds: Double
    let skipped: Bool

    /// Pace do segmento isolado (s/km). É este — não o split de km, que mistura tiro
    /// com recuperação — que reflete o ritmo real do tiro.
    var paceSecondsPerKm: Double {
        distanceMeters > 0 ? durationSeconds / (distanceMeters / 1000.0) : 0
    }
}

struct SplitData {
    let kilometer: Int
    let distanceMeters: Double
    let durationSeconds: Double
    let elevationDelta: Double

    var paceSecondsPerKm: Double {
        distanceMeters > 0 ? durationSeconds / (distanceMeters / 1000.0) : 0
    }

    var formattedPace: String {
        let pace = paceSecondsPerKm
        guard pace > 0, pace.isFinite else { return "--:--" }
        let minutes = Int(pace) / 60
        let seconds = Int(pace) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}
