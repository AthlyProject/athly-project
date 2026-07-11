package com.athly.runner.domain.run

import android.location.Location
import com.athly.runner.core.location.LocationRepository
import com.athly.runner.core.location.toRoutePoint
import com.athly.runner.domain.model.ActiveSegment
import com.athly.runner.domain.model.RoutePoint
import com.athly.runner.domain.model.Split
import com.athly.runner.domain.model.WorkoutSegments
import com.athly.runner.domain.model.distanceTo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.merge
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Máquina de estados da corrida — porta 1:1 de `RunTracker.swift`. Calcula distância, tempo, pace ao vivo
 * (janela 20s) e médio, ganho de elevação (via [ElevationAccumulator]), calorias, splits por km e a
 * progressão da playlist de segmentos, emitindo [RunCue]s para o CueOrchestrator (prompt 10).
 *
 * Roda tudo em `Dispatchers.Main.immediate` (equivale ao `@MainActor` do iOS): controles e o loop de
 * eventos (pontos + ticker 1s) são serializados na main thread — sem locks. Consome o
 * [LocationRepository] (prompt 06); a UI/serviço são orquestrados no prompt 08.
 */
@Singleton
class RunTracker @Inject constructor(
    private val locationRepository: LocationRepository,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    private val _metrics = MutableStateFlow(RunMetrics())
    val metrics: StateFlow<RunMetrics> = _metrics.asStateFlow()

    private val _cues = MutableSharedFlow<RunCue>(replay = 0, extraBufferCapacity = 16)
    val cues: SharedFlow<RunCue> = _cues.asSharedFlow()

    var userWeightKg: Double = DEFAULT_WEIGHT_KG

    // Playlist de segmentos
    private var playlist: List<ActiveSegment> = emptyList()
    private var activeSegmentIndex = 0
    private var segmentStartDistance = 0.0
    private var segmentStartElapsed = 0.0
    private var segmentStartDate: Instant? = null
    private val segmentRecords = mutableListOf<SegmentRecord>()
    private var countdownFired = false

    // Estado da corrida
    private var state = RunState.IDLE
    private var elapsedSeconds = 0.0
    private var distanceMeters = 0.0
    private var currentPace = 0.0
    private var averagePace = 0.0
    private var currentAltitude = 0.0
    private var elevationGain = 0.0
    private var calories = 0.0
    private var currentSplitKm = 0

    // Tempo (wall clock, ms)
    private var startWallMillis = 0L
    private var pausedDurationMillis = 0L
    private var pauseStartMillis: Long? = null
    private var lastResumeMillis: Long? = null
    private val pauseIntervals = mutableListOf<PauseInterval>()

    // GPS
    private val routePoints = mutableListOf<RoutePoint>()
    private var routeSnapshot: List<RoutePoint> = emptyList()
    private var lastPoint: RoutePoint? = null
    private val elevationAccumulator = ElevationAccumulator()
    private val paceWindow = mutableListOf<RoutePoint>()
    private var recentSpeedMps = 0.0

    private var loopJob: Job? = null

    // MARK: - Segment API

    val currentSegment: ActiveSegment? get() = playlist.getOrNull(activeSegmentIndex)

    fun loadPlaylist(workoutSegments: WorkoutSegments?) {
        playlist = workoutSegments?.flatten() ?: emptyList()
        activeSegmentIndex = 0
        publishMetrics()
    }

    fun skipSegment() {
        if (activeSegmentIndex < playlist.size) {
            advanceSegment(skipped = true)
            publishMetrics()
        }
    }

    // MARK: - Controls

    fun start() {
        resetState()
        state = RunState.RUNNING
        startWallMillis = now()
        segmentStartDate = Instant.ofEpochMilli(startWallMillis)

        playlist.firstOrNull()?.let { emitCue(RunCue.Boundary(it)) }

        loopJob?.cancel()
        loopJob = scope.launch {
            val ticker = flow<Event> { while (true) { delay(1000); emit(Event.Tick) } }
            merge(
                locationRepository.locations.map { Event.Point(it) },
                ticker,
            ).collect { event ->
                when (event) {
                    is Event.Point -> processNewLocation(event.location)
                    Event.Tick -> onTick()
                }
                publishMetrics()
            }
        }
        publishMetrics()
    }

    fun pause() {
        if (state != RunState.RUNNING) return
        state = RunState.PAUSED
        pauseStartMillis = now()
        // A corda entre o último fix e o primeiro pós-resume é deriva do GPS parado — zerar lastPoint
        // faz o primeiro fix pós-resume não somar distância; janela de pace e velocidade recente resetam.
        lastPoint = null
        paceWindow.clear()
        recentSpeedMps = 0.0
        publishMetrics()
    }

    fun resume() {
        if (state != RunState.PAUSED) return
        state = RunState.RUNNING
        pauseStartMillis?.let { start ->
            val end = now()
            pausedDurationMillis += end - start
            pauseIntervals.add(PauseInterval(Instant.ofEpochMilli(start), Instant.ofEpochMilli(end)))
        }
        pauseStartMillis = null
        lastResumeMillis = now()
        publishMetrics()
    }

    fun stop(): RunResult {
        state = RunState.FINISHED
        loopJob?.cancel()
        loopJob = null

        val stopMillis = now()
        pauseStartMillis?.let { start ->
            pausedDurationMillis += stopMillis - start
            pauseIntervals.add(PauseInterval(Instant.ofEpochMilli(start), Instant.ofEpochMilli(stopMillis)))
        }

        val finalDuration = maxOf(0.0, (stopMillis - startWallMillis - pausedDurationMillis) / 1000.0)
        val finalPace = if (distanceMeters > 0) finalDuration / (distanceMeters / 1000.0) else 0.0

        // Fecha o segmento em andamento (parcial) para a estrutura ficar completa.
        if (activeSegmentIndex < playlist.size) {
            val dist = maxOf(0.0, distanceMeters - segmentStartDistance)
            val dur = maxOf(0.0, elapsedSeconds - segmentStartElapsed)
            if (dist > 10 || dur > 5) {
                recordCompletedSegment(playlist[activeSegmentIndex], Instant.ofEpochMilli(stopMillis), skipped = false)
            }
        }

        val result = RunResult(
            startDate = Instant.ofEpochMilli(startWallMillis),
            endDate = Instant.ofEpochMilli(stopMillis),
            distanceMeters = distanceMeters,
            durationSeconds = finalDuration,
            averagePaceSecondsPerKm = finalPace,
            elevationGainMeters = elevationGain,
            caloriesBurned = calories,
            routePoints = routePoints.toList(),
            splits = SplitCalculator.kmSplits(routePoints, pauseIntervals).map { it.toSplit() },
            segmentRecords = segmentRecords.toList(),
            pauseIntervals = pauseIntervals.toList(),
        )

        resetState()
        publishMetrics()
        return result
    }

    fun discard() {
        loopJob?.cancel()
        loopJob = null
        resetState()
        publishMetrics()
    }

    // MARK: - Private

    private sealed interface Event {
        data class Point(val location: Location) : Event
        data object Tick : Event
    }

    private fun processNewLocation(location: Location) {
        if (state != RunState.RUNNING) return
        refreshElapsedTime()

        val point = location.toRoutePoint()
        routePoints.add(point)
        routeSnapshot = routePoints.toList()
        currentAltitude = point.altitude

        val vAcc = if (location.hasVerticalAccuracy()) location.verticalAccuracyMeters.toDouble() else -1.0
        elevationAccumulator.add(point.altitude, vAcc)
        elevationGain = elevationAccumulator.gain

        val last = lastPoint
        if (last != null) {
            val delta = point.distanceTo(last)
            val dt = seconds(last.timestamp, point.timestamp)
            val impliedSpeed = if (dt > 0) delta / dt else Double.POSITIVE_INFINITY

            // Salto de GPS: velocidade implausível → ignora SEM avançar lastPoint.
            if (impliedSpeed > MAX_PLAUSIBLE_SPEED) return

            var distStep = delta
            if (dt > PACE_GAP_RESET_SECONDS &&
                dt <= MAX_BRIDGE_GAP_SECONDS &&
                impliedSpeed >= 0.5 &&
                recentSpeedMps > 0.5 &&
                (lastResumeMillis?.let { it <= last.timestamp.toEpochMilli() } ?: true)
            ) {
                distStep = minOf(maxOf(delta, recentSpeedMps * dt), MAX_PLAUSIBLE_SPEED * dt)
            }
            distanceMeters += distStep

            // Pace ao vivo — janela deslizante de deltas de posição; zera a janela em buraco de GPS.
            paceWindow.lastOrNull()?.let { lastInWindow ->
                if (seconds(lastInWindow.timestamp, point.timestamp) > PACE_GAP_RESET_SECONDS) paceWindow.clear()
            }
            paceWindow.add(point)
            while (paceWindow.isNotEmpty() &&
                seconds(paceWindow.first().timestamp, point.timestamp) > PACE_WINDOW_SECONDS
            ) {
                paceWindow.removeAt(0)
            }
            if (paceWindow.size >= 2) {
                var windowDist = 0.0
                for (i in 1 until paceWindow.size) windowDist += paceWindow[i].distanceTo(paceWindow[i - 1])
                val windowTime = seconds(paceWindow.first().timestamp, paceWindow.last().timestamp)
                if (windowDist > 5 && windowTime > 0) {
                    currentPace = (windowTime / windowDist) * 1000.0
                    recentSpeedMps = windowDist / windowTime
                }
            }

            if (distanceMeters > 0 && elapsedSeconds > 0) {
                averagePace = elapsedSeconds / (distanceMeters / 1000.0)
            }

            checkSegmentBoundary()

            val km = (distanceMeters / 1000.0).toInt()
            if (km > currentSplitKm) currentSplitKm = km
        }

        lastPoint = point
    }

    private fun onTick() {
        if (state != RunState.RUNNING) return
        refreshElapsedTime()
        updateCalories()
        checkSegmentBoundary()

        // Buraco de GPS prolongado (8s+ sem fix) → invalida o pace exibido em vez de congelar o último.
        lastPoint?.let {
            if ((now() - it.timestamp.toEpochMilli()) / 1000.0 > PACE_STALE_SECONDS) currentPace = 0.0
        }
    }

    private fun refreshElapsedTime() {
        if (state != RunState.RUNNING) return
        elapsedSeconds = maxOf(0.0, (now() - startWallMillis - pausedDurationMillis) / 1000.0)
    }

    private fun updateCalories() {
        calories = (distanceMeters / 1000.0) * userWeightKg * 1.036
    }

    private fun checkSegmentBoundary() {
        if (playlist.isEmpty() || activeSegmentIndex >= playlist.size) return
        val seg = playlist[activeSegmentIndex]

        when (seg.end.by) {
            com.athly.runner.domain.model.SegmentEndBy.DISTANCE_M -> {
                val done = distanceMeters - segmentStartDistance
                val remaining = seg.end.value - done
                if (!countdownFired && currentPace > 0 && remaining > 0) {
                    val etaSec = remaining * currentPace / 1000.0
                    if (etaSec <= 3.5) {
                        countdownFired = true
                        emitCue(RunCue.Countdown3)
                    }
                }
                if (done >= seg.end.value) advanceSegment(skipped = false)
            }

            com.athly.runner.domain.model.SegmentEndBy.DURATION_SEC -> {
                val done = elapsedSeconds - segmentStartElapsed
                val remaining = seg.end.value - done
                if (!countdownFired && remaining > 0 && remaining <= 3.0) {
                    countdownFired = true
                    emitCue(RunCue.Countdown3)
                }
                if (done >= seg.end.value) advanceSegment(skipped = false)
            }

            com.athly.runner.domain.model.SegmentEndBy.REPS -> Unit // só skip manual
        }
    }

    private fun advanceSegment(skipped: Boolean) {
        val completed = playlist[activeSegmentIndex]
        recordCompletedSegment(completed, Instant.ofEpochMilli(now()), skipped)
        activeSegmentIndex += 1
        countdownFired = false
        segmentStartDistance = distanceMeters
        segmentStartElapsed = elapsedSeconds
        segmentStartDate = Instant.ofEpochMilli(now())

        val isSetDone = !skipped &&
            completed.setIndex != null &&
            completed.setIndex == completed.setTotal

        if (activeSegmentIndex >= playlist.size) return
        val next = playlist[activeSegmentIndex]

        if (isSetDone) {
            emitCue(RunCue.SetComplete(setLabel = completed.label, setsTotal = completed.setTotal ?: 0))
            scope.launch {
                delay(1400)
                if (state == RunState.RUNNING && activeSegmentIndex < playlist.size) {
                    emitCue(RunCue.Boundary(playlist[activeSegmentIndex]))
                }
            }
        } else {
            emitCue(RunCue.Boundary(next))
        }
    }

    private fun recordCompletedSegment(segment: ActiveSegment, endDate: Instant, skipped: Boolean) {
        val start = segmentStartDate ?: Instant.ofEpochMilli(startWallMillis)
        if (endDate <= start) return
        segmentRecords.add(
            SegmentRecord(
                kind = segment.kind,
                setIndex = segment.setIndex,
                setTotal = segment.setTotal,
                label = segment.label,
                startDate = start,
                endDate = endDate,
                distanceMeters = maxOf(0.0, distanceMeters - segmentStartDistance),
                durationSeconds = maxOf(0.0, elapsedSeconds - segmentStartElapsed),
                skipped = skipped,
            ),
        )
    }

    private fun emitCue(cue: RunCue) {
        _cues.tryEmit(cue)
    }

    private fun publishMetrics() {
        val cur = playlist.getOrNull(activeSegmentIndex)
        val progress = when (cur?.end?.by) {
            com.athly.runner.domain.model.SegmentEndBy.DISTANCE_M ->
                minOf(1.0, (distanceMeters - segmentStartDistance) / maxOf(1.0, cur.end.value))
            com.athly.runner.domain.model.SegmentEndBy.DURATION_SEC ->
                minOf(1.0, (elapsedSeconds - segmentStartElapsed) / maxOf(1.0, cur.end.value))
            else -> 0.0
        }
        _metrics.value = RunMetrics(
            state = state,
            elapsedSeconds = elapsedSeconds,
            distanceMeters = distanceMeters,
            currentPaceSecPerKm = currentPace,
            averagePaceSecPerKm = averagePace,
            currentAltitude = currentAltitude,
            elevationGain = elevationGain,
            calories = calories,
            currentSplitKm = currentSplitKm,
            activeSegmentIndex = activeSegmentIndex,
            routePoints = routeSnapshot,
            currentSegment = cur,
            nextSegment = playlist.getOrNull(activeSegmentIndex + 1),
            segmentProgress = progress,
        )
    }

    private fun resetState() {
        state = RunState.IDLE
        elapsedSeconds = 0.0
        distanceMeters = 0.0
        currentPace = 0.0
        averagePace = 0.0
        currentAltitude = 0.0
        elevationGain = 0.0
        calories = 0.0
        currentSplitKm = 0
        startWallMillis = 0L
        pausedDurationMillis = 0L
        pauseStartMillis = null
        lastResumeMillis = null
        pauseIntervals.clear()
        routePoints.clear()
        routeSnapshot = emptyList()
        lastPoint = null
        elevationAccumulator.reset()
        paceWindow.clear()
        recentSpeedMps = 0.0
        activeSegmentIndex = 0
        segmentStartDistance = 0.0
        segmentStartElapsed = 0.0
        segmentStartDate = null
        segmentRecords.clear()
        countdownFired = false
    }

    private fun now(): Long = System.currentTimeMillis()

    private fun seconds(from: Instant, to: Instant): Double =
        (to.toEpochMilli() - from.toEpochMilli()) / 1000.0

    private fun com.athly.runner.domain.model.KmSplit.toSplit(): Split = Split(
        kilometer = kilometer,
        durationSeconds = durationSeconds,
        distanceMeters = distanceMeters,
        paceSecondsPerKm = paceSecondsPerKm,
        elevationDelta = elevationDelta,
    )

    private companion object {
        const val DEFAULT_WEIGHT_KG = 70.0
        const val PACE_WINDOW_SECONDS = 20.0
        const val PACE_GAP_RESET_SECONDS = 6.0
        const val MAX_PLAUSIBLE_SPEED = 7.0
        const val PACE_STALE_SECONDS = 8.0
        const val MAX_BRIDGE_GAP_SECONDS = 90.0
    }
}
