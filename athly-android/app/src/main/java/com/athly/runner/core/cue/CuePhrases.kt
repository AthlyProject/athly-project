package com.athly.runner.core.cue

import com.athly.runner.domain.model.ActiveSegment
import com.athly.runner.domain.model.SegmentEndBy
import com.athly.runner.domain.model.SegmentKind
import java.util.Locale

/**
 * Frases pt-BR dos cues de voz — porta caractere a caractere de `CueOrchestrator.swift`
 * (`ttsPhrase`/`kindLabel`). Objeto puro (sem Android) para os testes rodarem na JVM.
 * O iOS usa `String(format: "%.1f")` SEM locale (ponto decimal) → aqui `Locale.US` ("1.5").
 */
object CuePhrases {

    /** "Tiro 3 de 6, 400 metros" / "Aquecimento, 5 minutos" — partes unidas por ", ". */
    fun ttsPhrase(segment: ActiveSegment): String {
        val parts = mutableListOf<String>()

        val idx = segment.setIndex
        val total = segment.setTotal
        if (idx != null && total != null) {
            parts.add("${kindLabel(segment.kind)} $idx de $total")
        } else {
            parts.add(kindLabel(segment.kind))
        }

        when (segment.end.by) {
            SegmentEndBy.DISTANCE_M -> {
                val meters = segment.end.value.toInt()
                if (meters >= 1000) {
                    val km = String.format(Locale.US, "%.1f", meters / 1000.0)
                    parts.add("$km quilômetros")
                } else {
                    parts.add("$meters metros")
                }
            }

            SegmentEndBy.DURATION_SEC -> {
                val secs = segment.end.value.toInt()
                if (secs >= 60) {
                    val m = secs / 60
                    val s = secs % 60
                    parts.add(
                        if (s == 0) "$m minuto${if (m > 1) "s" else ""}"
                        else "$m:${String.format(Locale.US, "%02d", s)}",
                    )
                } else {
                    parts.add("$secs segundos")
                }
            }

            SegmentEndBy.REPS -> parts.add("${segment.end.value.toInt()} repetições")
        }

        return parts.joinToString(", ")
    }

    /** "<label> concluído" (set múltiplo) ou "Série concluída". */
    fun setCompletePhrase(setLabel: String, setsTotal: Int): String =
        if (setsTotal > 1) "$setLabel concluído" else "Série concluída"

    fun kindLabel(kind: SegmentKind): String = when (kind) {
        SegmentKind.WARMUP -> "Aquecimento"
        SegmentKind.WORK -> "Tiro"
        SegmentKind.RECOVERY -> "Recuperação"
        SegmentKind.COOLDOWN -> "Desaceleramento"
        SegmentKind.REST -> "Descanso"
        SegmentKind.SET, SegmentKind.UNKNOWN -> "Próximo bloco"
    }
}
