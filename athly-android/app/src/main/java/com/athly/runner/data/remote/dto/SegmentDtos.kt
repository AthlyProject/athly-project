package com.athly.runner.data.remote.dto

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

/*
 * Árvore de segmentos estruturados — espelha a seção "Workout Segments" do APIModels.swift.
 * Fonte da verdade do tracker quando presente (prompt 07+).
 */

/** Espelha `SegmentKind` do iOS, incluindo o fallback decodável para valores desconhecidos. */
@Serializable(with = SegmentKindSerializer::class)
enum class SegmentKind(val wire: String) {
    WARMUP("warmup"),
    WORK("work"),
    RECOVERY("recovery"),
    COOLDOWN("cooldown"),
    REST("rest"),
    SET("set"),

    /** Fallback para qualquer kind desconhecido enviado pelo backend (espelha o init(from:) do iOS). */
    UNKNOWN("unknown"),
}

/** Kind desconhecido → UNKNOWN em vez de derrubar o decode do treino inteiro. */
internal object SegmentKindSerializer : KSerializer<SegmentKind> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("SegmentKind", PrimitiveKind.STRING)

    override fun deserialize(decoder: Decoder): SegmentKind {
        val raw = decoder.decodeString()
        return SegmentKind.entries.firstOrNull { it.wire == raw } ?: SegmentKind.UNKNOWN
    }

    override fun serialize(encoder: Encoder, value: SegmentKind) {
        encoder.encodeString(value.wire)
    }
}

/** Espelha `SegmentEndBy` do iOS. */
@Serializable
enum class SegmentEndBy {
    @SerialName("distanceM") DISTANCE_M,
    @SerialName("durationSec") DURATION_SEC,
    @SerialName("reps") REPS,
}

/** Espelha `SegmentEndCondition` do iOS. */
@Serializable
data class SegmentEndConditionDto(
    val by: SegmentEndBy,
    val value: Double,
)

/** Estrutura "fat" com todos os campos opcionais por esporte — espelha `SegmentTarget` do iOS. */
@Serializable
data class SegmentTargetDto(
    // running
    val paceSecPerKmMin: Int? = null,
    val paceSecPerKmMax: Int? = null,
    val hrZone: Int? = null,
    val rpe: Int? = null,
    // cycling
    val powerWattsMin: Int? = null,
    val powerWattsMax: Int? = null,
    val cadenceRpm: Int? = null,
    // swimming
    val strokeType: String? = null,
    val poolLengthM: Int? = null,
    val targetSecPer100m: Int? = null,
    // strength
    val exercise: String? = null,
    val reps: Int? = null,
    val loadKg: Double? = null,
    val loadPctOf1RM: Double? = null,
    val tempoSec: String? = null,
    val restAfterSec: Int? = null,
)

/** Nó da árvore de segmentos, recursivo via `children` — espelha `Segment` do iOS. */
@Serializable
data class SegmentDto(
    val id: String,
    val kind: SegmentKind = SegmentKind.UNKNOWN,
    val label: String? = null,
    val cue: String? = null,
    val end: SegmentEndConditionDto? = null,
    val repetitions: Int? = null,
    val target: SegmentTargetDto? = null,
    val children: List<SegmentDto>? = null,
    val notes: String? = null,
)

/** Espelha `WorkoutSegments` do iOS. */
@Serializable
data class WorkoutSegmentsDto(
    val schemaVersion: Int,
    val sport: SportType,
    val segments: List<SegmentDto>,
)
