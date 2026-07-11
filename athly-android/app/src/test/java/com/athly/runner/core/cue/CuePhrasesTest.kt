package com.athly.runner.core.cue

import com.athly.runner.domain.model.ActiveSegment
import com.athly.runner.domain.model.SegmentEndBy
import com.athly.runner.domain.model.SegmentEndCondition
import com.athly.runner.domain.model.SegmentKind
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Contrato de fidelidade pt-BR das frases de voz — os valores esperados batem 1:1 com o
 * `ttsPhrase`/`kindLabel` do `CueOrchestrator.swift` (decimal com PONTO, como o
 * `String(format:)` sem locale do iOS).
 */
class CuePhrasesTest {

    private fun segment(
        kind: SegmentKind = SegmentKind.WORK,
        setIndex: Int? = null,
        setTotal: Int? = null,
        by: SegmentEndBy = SegmentEndBy.DISTANCE_M,
        value: Double,
    ) = ActiveSegment(
        sourceSegmentId = "seg",
        kind = kind,
        setIndex = setIndex,
        setTotal = setTotal,
        end = SegmentEndCondition(by = by, value = value),
        label = "x",
    )

    @Test
    fun `set position - Tiro 3 de 6 com metros`() {
        val phrase = CuePhrases.ttsPhrase(
            segment(kind = SegmentKind.WORK, setIndex = 3, setTotal = 6, value = 400.0),
        )
        assertEquals("Tiro 3 de 6, 400 metros", phrase)
    }

    @Test
    fun `distancia em km usa uma casa decimal com ponto`() {
        val phrase = CuePhrases.ttsPhrase(segment(kind = SegmentKind.WARMUP, value = 1500.0))
        assertEquals("Aquecimento, 1.5 quilômetros", phrase)
    }

    @Test
    fun `distancia abaixo de 1000 fala metros`() {
        val phrase = CuePhrases.ttsPhrase(segment(kind = SegmentKind.RECOVERY, value = 250.0))
        assertEquals("Recuperação, 250 metros", phrase)
    }

    @Test
    fun `duracao em minutos cheios pluraliza`() {
        val phrase = CuePhrases.ttsPhrase(
            segment(kind = SegmentKind.COOLDOWN, by = SegmentEndBy.DURATION_SEC, value = 300.0),
        )
        assertEquals("Desaceleramento, 5 minutos", phrase)
    }

    @Test
    fun `um minuto cheio fica no singular`() {
        val phrase = CuePhrases.ttsPhrase(
            segment(kind = SegmentKind.REST, by = SegmentEndBy.DURATION_SEC, value = 60.0),
        )
        assertEquals("Descanso, 1 minuto", phrase)
    }

    @Test
    fun `duracao com segundos vira M colon SS`() {
        val phrase = CuePhrases.ttsPhrase(
            segment(by = SegmentEndBy.DURATION_SEC, value = 225.0),
        )
        assertEquals("Tiro, 3:45", phrase)
    }

    @Test
    fun `duracao abaixo de 60 fala segundos`() {
        val phrase = CuePhrases.ttsPhrase(
            segment(by = SegmentEndBy.DURATION_SEC, value = 45.0),
        )
        assertEquals("Tiro, 45 segundos", phrase)
    }

    @Test
    fun `reps fala repeticoes`() {
        val phrase = CuePhrases.ttsPhrase(segment(by = SegmentEndBy.REPS, value = 8.0))
        assertEquals("Tiro, 8 repetições", phrase)
    }

    @Test
    fun `set e unknown viram Proximo bloco`() {
        assertEquals("Próximo bloco", CuePhrases.kindLabel(SegmentKind.SET))
        assertEquals("Próximo bloco", CuePhrases.kindLabel(SegmentKind.UNKNOWN))
    }

    @Test
    fun `setComplete com set multiplo usa o label`() {
        assertEquals("Tiro concluído", CuePhrases.setCompletePhrase("Tiro", 6))
    }

    @Test
    fun `setComplete de set unico vira Serie concluida`() {
        assertEquals("Série concluída", CuePhrases.setCompletePhrase("Tiro", 1))
    }
}
