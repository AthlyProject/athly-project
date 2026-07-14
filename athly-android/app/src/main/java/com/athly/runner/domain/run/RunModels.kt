package com.athly.runner.domain.run

import com.athly.runner.domain.model.ActiveSegment
import com.athly.runner.domain.model.RoutePoint
import com.athly.runner.domain.model.SegmentKind
import com.athly.runner.domain.model.Split
import java.time.Instant

/** Estados da corrida — espelha `RunTracker.RunState` do iOS. */
enum class RunState { IDLE, RUNNING, PAUSED, FINISHED }

/**
 * Snapshot das métricas ao vivo (exposto como `StateFlow` pelo [RunTracker]) — espelha os `@Published`
 * do RunTracker iOS. Imutável; o tracker publica um novo a cada ponto/tick.
 */
data class RunMetrics(
    val state: RunState = RunState.IDLE,
    val elapsedSeconds: Double = 0.0,
    val distanceMeters: Double = 0.0,
    val currentPaceSecPerKm: Double = 0.0,
    val averagePaceSecPerKm: Double = 0.0,
    val currentAltitude: Double = 0.0,
    val elevationGain: Double = 0.0,
    val calories: Double = 0.0,
    val currentSplitKm: Int = 0,
    val activeSegmentIndex: Int = 0,
    val routePoints: List<RoutePoint> = emptyList(),
    val currentSegment: ActiveSegment? = null,
    val nextSegment: ActiveSegment? = null,
    val segmentProgress: Double = 0.0,
)

/**
 * Cues emitidos pelo tracker para o `CueOrchestrator` (prompt 10) — espelham os
 * `CueOrchestrator.fire(...)` do iOS relevantes ao tracker.
 */
sealed interface RunCue {
    /** Contagem regressiva de 3s para a fronteira do segmento. */
    data object Countdown3 : RunCue

    /** Entrada em um novo segmento (início da corrida ou transição). */
    data class Boundary(val segment: ActiveSegment) : RunCue

    /** Conclusão de um set (última repetição). */
    data class SetComplete(val setLabel: String, val setsTotal: Int) : RunCue
}

/** Janela de pausa explícita — descontada nos splits offline. Espelha `SplitCalculator.PauseInterval`. */
data class PauseInterval(val start: Instant, val end: Instant)

/**
 * Um segmento estruturado como foi executado — espelha `SegmentRecord` do iOS. Fonte para a análise
 * da IA (prompt 12/16) avaliar tiros/recuperações com distância e duração reais.
 */
data class SegmentRecord(
    val kind: SegmentKind,
    val setIndex: Int?,
    val setTotal: Int?,
    val label: String,
    val startDate: Instant,
    val endDate: Instant,
    val distanceMeters: Double,
    val durationSeconds: Double,
    val skipped: Boolean,
) {
    val paceSecondsPerKm: Double
        get() = if (distanceMeters > 0) durationSeconds / (distanceMeters / 1000.0) else 0.0
}

/** Resultado final da corrida — espelha `RunResult` do iOS. Consumido pelo resumo/salvar (prompt 09). */
data class RunResult(
    val startDate: Instant,
    val endDate: Instant,
    val distanceMeters: Double,
    val durationSeconds: Double,
    val averagePaceSecondsPerKm: Double,
    val elevationGainMeters: Double,
    val caloriesBurned: Double,
    val routePoints: List<RoutePoint>,
    val splits: List<Split>,
    val segmentRecords: List<SegmentRecord> = emptyList(),
    val pauseIntervals: List<PauseInterval> = emptyList(),
)
