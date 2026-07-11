package com.athly.runner.domain.model

import com.athly.runner.core.network.AthlyJson
import com.athly.runner.data.mapper.toDomain
import com.athly.runner.data.remote.dto.WorkoutSegmentsDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Critério de aceite do prompt 03: `WorkoutSegments.flatten()` produz a MESMA playlist que o iOS.
 * Parte-se de um JSON real do backend (camelCase) → DTO → domínio → flatten, comparando a
 * sequência exata de `ActiveSegment` (kind, label, setIndex/setTotal, end, sourceSegmentId).
 */
class WorkoutSegmentsFlattenTest {

    private val json = AthlyJson.create()

    private fun flatten(raw: String): List<ActiveSegment> =
        json.decodeFromString(WorkoutSegmentsDto.serializer(), raw.trimIndent())
            .toDomain()
            .flatten()

    @Test
    fun `treino com set de N repeticoes expande e propaga setIndex-setTotal`() {
        // aquecimento → 4x(tiro 400m + recuperação 120s) → desaceleramento
        val result = flatten(
            """
            {
              "schemaVersion": 1,
              "sport": "running",
              "segments": [
                { "id": "s1", "kind": "warmup", "end": { "by": "distanceM", "value": 1000 } },
                { "id": "s2", "kind": "set", "repetitions": 4, "children": [
                    { "id": "s2a", "kind": "work", "end": { "by": "distanceM", "value": 400 } },
                    { "id": "s2b", "kind": "recovery", "end": { "by": "durationSec", "value": 120 } }
                ] },
                { "id": "s3", "kind": "cooldown", "end": { "by": "durationSec", "value": 300 } }
              ]
            }
            """,
        )

        // 1 aquecimento + 4*(work+recovery) + 1 desaceleramento = 10 passos; nós `set` não entram.
        assertEquals(10, result.size)

        // Aquecimento: fora de set → índices nulos; label default pt-BR.
        assertEquals(SegmentKind.WARMUP, result[0].kind)
        assertEquals("Aquecimento", result[0].label)
        assertNull(result[0].setIndex)
        assertNull(result[0].setTotal)
        assertEquals(SegmentEndBy.DISTANCE_M, result[0].end.by)
        assertEquals(1000.0, result[0].end.value, 0.0)

        // Primeiro tiro: contexto do set + label "Tiro 1 de 4" + back-reference ao id de origem.
        assertEquals(SegmentKind.WORK, result[1].kind)
        assertEquals("Tiro 1 de 4", result[1].label)
        assertEquals(1, result[1].setIndex)
        assertEquals(4, result[1].setTotal)
        assertEquals("s2a", result[1].sourceSegmentId)

        // Recuperação do primeiro ciclo herda o mesmo contexto do set.
        assertEquals(SegmentKind.RECOVERY, result[2].kind)
        assertEquals("Recuperação", result[2].label)
        assertEquals(1, result[2].setIndex)
        assertEquals(4, result[2].setTotal)

        // Terceiro tiro é o índice 3 (result[5] = warmup + 2 ciclos completos).
        assertEquals("Tiro 3 de 4", result[5].label)
        assertEquals(3, result[5].setIndex)

        // Desaceleramento fecha a lista, de novo fora de set.
        assertEquals(SegmentKind.COOLDOWN, result[9].kind)
        assertEquals("Desaceleramento", result[9].label)
        assertNull(result[9].setIndex)
    }

    @Test
    fun `label explicito do segmento vence o label default`() {
        val result = flatten(
            """
            {
              "schemaVersion": 1,
              "sport": "running",
              "segments": [
                { "id": "s1", "kind": "work", "label": "Sprint final!", "end": { "by": "distanceM", "value": 200 } }
              ]
            }
            """,
        )
        assertEquals(1, result.size)
        assertEquals("Sprint final!", result[0].label)
    }

    @Test
    fun `folha sem condicao de termino e ignorada`() {
        val result = flatten(
            """
            {
              "schemaVersion": 1,
              "sport": "running",
              "segments": [
                { "id": "s1", "kind": "warmup" },
                { "id": "s2", "kind": "work", "end": { "by": "distanceM", "value": 400 } }
              ]
            }
            """,
        )
        // Só o segmento com `end` sobrevive.
        assertEquals(1, result.size)
        assertEquals("s2", result[0].sourceSegmentId)
    }

    @Test
    fun `set sem filhos nao contribui`() {
        val result = flatten(
            """
            {
              "schemaVersion": 1,
              "sport": "running",
              "segments": [
                { "id": "s1", "kind": "set", "repetitions": 5, "children": [] },
                { "id": "s2", "kind": "cooldown", "end": { "by": "durationSec", "value": 180 } }
              ]
            }
            """,
        )
        assertEquals(1, result.size)
        assertEquals(SegmentKind.COOLDOWN, result[0].kind)
    }

    @Test
    fun `set sem repetitions default para 1`() {
        val result = flatten(
            """
            {
              "schemaVersion": 1,
              "sport": "running",
              "segments": [
                { "id": "s1", "kind": "set", "children": [
                    { "id": "s1a", "kind": "work", "end": { "by": "distanceM", "value": 800 } }
                ] }
              ]
            }
            """,
        )
        assertEquals(1, result.size)
        assertEquals(1, result[0].setIndex)
        assertEquals(1, result[0].setTotal)
        assertEquals("Tiro 1 de 1", result[0].label)
    }
}
