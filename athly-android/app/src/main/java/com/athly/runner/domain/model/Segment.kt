package com.athly.runner.domain.model

import java.util.UUID

/*
 * Árvore de segmentos estruturados (domínio) + a lógica de achatamento (`flatten`) que produz a
 * playlist linear consumida pelo tracker. Espelha `ActiveSegment.swift` (struct + extensão
 * `WorkoutSegments.flatten()`). A parte mais delicada do app — coberta por testes.
 */

/** Como um segmento termina. Espelha `SegmentEndCondition` do iOS. */
data class SegmentEndCondition(
    val by: SegmentEndBy,
    val value: Double,
)

/**
 * Estrutura "fat" com todos os campos opcionais por esporte — espelha `SegmentTarget` do iOS.
 * O app só consome (não gera targets); campos ausentes ficam nulos.
 */
data class SegmentTarget(
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

/** Nó da árvore de segmentos, recursivo via `children`. Espelha `Segment` do iOS. */
data class Segment(
    val id: String,
    val kind: SegmentKind,
    val label: String? = null,
    val cue: String? = null,
    val end: SegmentEndCondition? = null,
    val repetitions: Int? = null,
    val target: SegmentTarget? = null,
    val children: List<Segment>? = null,
    val notes: String? = null,
)

/**
 * Representação achatada de UM passo de execução derivado da árvore `WorkoutSegments`.
 * Nós `set` nunca aparecem aqui — eles são expandidos nos filhos N vezes, cada um carregando
 * o contexto `setIndex`/`setTotal`. Espelha `ActiveSegment` do iOS.
 */
data class ActiveSegment(
    val id: String = UUID.randomUUID().toString(),
    /** Back-reference ao `Segment.id` (ULID) para skip/partial tracking. */
    val sourceSegmentId: String,
    val kind: SegmentKind,
    /** Posição 1-based dentro do set pai (nulo quando fora de um set). */
    val setIndex: Int? = null,
    /** Total de repetições do set pai (nulo quando fora de um set). */
    val setTotal: Int? = null,
    val end: SegmentEndCondition,
    val target: SegmentTarget? = null,
    /** Texto legível usado no banner da UI e nas frases de TTS. */
    val label: String,
)

/** Espelha `WorkoutSegments` do iOS + a extensão `flatten()`. */
data class WorkoutSegments(
    val schemaVersion: Int,
    val sport: SportType,
    val segments: List<Segment>,
) {

    /**
     * Expande a árvore numa lista linear ordenada, pronta para o tracker.
     * Nós `set` não entram; seus filhos são repetidos `repetitions` vezes.
     * Percurso depth-first, profundidade máx. 2 (contrato do backend). Espelha 1:1 o iOS.
     */
    fun flatten(): List<ActiveSegment> {
        val result = mutableListOf<ActiveSegment>()
        for (seg in segments) {
            expand(seg, result, setIndex = null, setTotal = null)
        }
        return result
    }

    private fun expand(
        seg: Segment,
        result: MutableList<ActiveSegment>,
        setIndex: Int?,
        setTotal: Int?,
    ) {
        if (seg.kind == SegmentKind.SET) {
            val reps = seg.repetitions ?: 1
            val children = seg.children ?: emptyList()
            if (children.isEmpty()) return
            for (rep in 1..reps) {
                for (child in children) {
                    expand(child, result, setIndex = rep, setTotal = reps)
                }
            }
            return
        }

        // Nó folha (não-set) — precisa de condição de término válida para ser rastreável.
        val end = seg.end ?: return

        result.add(
            ActiveSegment(
                sourceSegmentId = seg.id,
                kind = seg.kind,
                setIndex = setIndex,
                setTotal = setTotal,
                end = end,
                target = seg.target,
                label = seg.label ?: defaultLabel(seg.kind, setIndex, setTotal),
            )
        )
    }

    private fun defaultLabel(kind: SegmentKind, setIndex: Int?, setTotal: Int?): String =
        when (kind) {
            SegmentKind.WARMUP -> "Aquecimento"
            SegmentKind.WORK ->
                if (setIndex != null && setTotal != null) "Tiro $setIndex de $setTotal" else "Tiro"
            SegmentKind.RECOVERY -> "Recuperação"
            SegmentKind.COOLDOWN -> "Desaceleramento"
            SegmentKind.REST -> "Descanso"
            SegmentKind.SET, SegmentKind.UNKNOWN -> "Bloco"
        }
}
