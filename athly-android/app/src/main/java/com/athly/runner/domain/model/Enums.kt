package com.athly.runner.domain.model

/*
 * Enums de DOMÍNIO — independentes de serialização (os enums de wire ficam em data/remote/dto).
 * Aqui moram as extensões de UI (label pt-BR, emoji) espelhando as computed vars do iOS
 * (APIModels.swift: SportType.label/emoji). Os mappers DTO→domínio estão em data/mapper/.
 */

/** Espelha `SportType` + `.label`/`.emoji` do iOS. Textos pt-BR idênticos ao app iOS. */
enum class SportType(val label: String, val emoji: String) {
    RUNNING("Corrida", "🏃"),
    CYCLING("Ciclismo", "🚴"),
    SWIMMING("Natação", "🏊"),
    STRENGTH("Força", "🏋️"),
    CROSSFIT("CrossFit", "💪"),
    TRIATHLON("Triathlon", "🏅"),
    DUATHLON("Duathlon", "🎽"),
    YOGA("Yoga", "🧘"),
    WALKING("Caminhada", "🚶"),
    OTHER("Outro", "🏆"),
}

/** Espelha `WorkoutStatus` do iOS. Labels/cores de UI ficam no StatusBadge (prompt 18). */
enum class WorkoutStatus {
    SCHEDULED,
    DONE,
    SKIPPED,
    PARTIAL,
}

/** Espelha `SegmentKind` do iOS, incluindo o fallback `UNKNOWN`. */
enum class SegmentKind {
    WARMUP,
    WORK,
    RECOVERY,
    COOLDOWN,
    REST,
    SET,
    UNKNOWN,
}

/** Como um segmento termina — espelha `SegmentEndBy` do iOS. */
enum class SegmentEndBy {
    DISTANCE_M,
    DURATION_SEC,
    REPS,
}

/**
 * Rótulo de segmento usado nos payloads de análise (prompt 07/12) — espelha `SegmentLabel` do iOS.
 * `wire` é o valor que o backend espera no `SegmentPayload`.
 */
enum class SegmentLabel(val wire: String) {
    WARMUP("warmup"),
    EASY("easy"),
    TEMPO("tempo"),
    REP("rep"),
    REC("rec"),
    COOLDOWN("cooldown"),
}
