package com.athly.runner.data.remote

import com.athly.runner.core.network.AthlyJson
import com.athly.runner.data.remote.dto.AiPlannerResponse
import com.athly.runner.data.remote.dto.RefreshRequest
import com.athly.runner.data.remote.dto.SegmentKind
import com.athly.runner.data.remote.dto.SportType
import com.athly.runner.data.remote.dto.TrainingPlanDto
import com.athly.runner.data.remote.dto.UpdateProfileRequest
import com.athly.runner.data.remote.dto.WeeklyGoalStatus
import com.athly.runner.data.remote.dto.WorkoutDto
import com.athly.runner.data.remote.dto.WorkoutStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Valida o critério de aceite do prompt 02: os DTOs desserializam o JSON real do backend
 * (camelCase, campos opcionais ausentes não quebram) e o encode espelha o iOS
 * (camelCase, nulos omitidos como encodeIfPresent).
 */
class DtoDeserializationTest {

    private val json = AthlyJson.create()

    @Test
    fun `workout completo decodifica camelCase, arvore de segmentos e chaves desconhecidas`() {
        val raw = """
            {
              "id": "w1",
              "date": "2026-07-06T00:00:00.000Z",
              "sportType": "running",
              "title": "Tiros de 400m",
              "description": "6x400m com trote",
              "blocks": [
                {"type": "warmup", "durationMinutes": 10, "targetPace": "6:30", "instructions": "trote leve"},
                {"distanceKm": 0.4, "targetPace": "4:50"}
              ],
              "segments": {
                "schemaVersion": 1,
                "sport": "running",
                "segments": [
                  {"id": "s1", "kind": "warmup", "end": {"by": "durationSec", "value": 600}},
                  {"id": "s2", "kind": "set", "repetitions": 6, "children": [
                    {"id": "s3", "kind": "work", "label": "rep", "end": {"by": "distanceM", "value": 400},
                     "target": {"paceSecPerKmMin": 280, "paceSecPerKmMax": 300}},
                    {"id": "s4", "kind": "recovery", "end": {"by": "durationSec", "value": 90}}
                  ]},
                  {"id": "s5", "kind": "mobility_flow", "end": {"by": "durationSec", "value": 300}}
                ]
              },
              "status": "scheduled",
              "trainingPlanId": "tp1",
              "weeklyGoalId": "wg1",
              "intensity": 7,
              "isGoalAttempt": false,
              "stravaActivityId": null,
              "campoFuturoDesconhecido": {"x": 1}
            }
        """.trimIndent()

        val dto = json.decodeFromString<WorkoutDto>(raw)

        assertEquals(SportType.RUNNING, dto.sportType)
        assertEquals(WorkoutStatus.SCHEDULED, dto.status)
        assertEquals("tp1", dto.trainingPlanId)
        assertEquals(7.0, dto.intensity!!, 0.0)
        assertNull(dto.stravaActivityId)

        // WorkoutBlock: fallback de chaves alternativas + type default (espelha init(from:) do iOS)
        assertEquals(10.0, dto.blocks[0].resolvedDuration!!, 0.0)
        assertEquals("warmup", dto.blocks[0].type)
        assertEquals(0.4, dto.blocks[1].resolvedDistance!!, 0.0)
        assertEquals("rest", dto.blocks[1].type)
        assertEquals("4:50", dto.blocks[1].targetPace)

        // Árvore de segmentos: set com filhos + kind desconhecido → UNKNOWN
        val segments = dto.segments!!.segments
        assertEquals(SegmentKind.SET, segments[1].kind)
        assertEquals(6, segments[1].repetitions)
        assertEquals(2, segments[1].children!!.size)
        assertEquals(SegmentKind.WORK, segments[1].children!![0].kind)
        assertEquals(SegmentKind.UNKNOWN, segments[2].kind)
    }

    @Test
    fun `training plan minimo tolera opcionais ausentes`() {
        val raw = """
            {"id":"tp1","startDate":"2026-07-01","objective":"10k sub 50",
             "createdAt":"2026-07-01T10:00:00Z","updatedAt":"2026-07-01T10:00:00Z"}
        """.trimIndent()

        val dto = json.decodeFromString<TrainingPlanDto>(raw)

        assertNull(dto.targetDate)
        assertNull(dto.status)
        assertTrue(dto.sports.isEmpty())
        assertFalse(dto.autoGenerate)
    }

    @Test
    fun `resposta composta do ai planner decodifica`() {
        val raw = """
            {
              "weeklyGoal": {
                "id": "wg1", "trainingPlanId": "tp1",
                "weekStartDate": "2026-07-06", "weekEndDate": "2026-07-12",
                "status": "GENERATED",
                "metrics": {"fitnessInsights": "Boa progressão", "avgPace": "5:30", "runsAnalyzed": 4}
              },
              "workouts": [
                {"id": "w1", "date": "2026-07-07", "sportType": "running", "title": "Rodagem leve",
                 "blocks": [], "status": "scheduled"}
              ],
              "analysis": {
                "runsAnalyzed": 4, "period": "últimos 14 dias", "avgDistanceKm": 6.2,
                "avgPace": "5:30", "avgHeartRate": 152, "totalDistanceKm": 24.8,
                "trend": "improving", "fitnessInsights": "Boa progressão"
              }
            }
        """.trimIndent()

        val dto = json.decodeFromString<AiPlannerResponse>(raw)

        assertEquals(WeeklyGoalStatus.GENERATED, dto.weeklyGoal.status)
        assertEquals("Boa progressão", dto.weeklyGoal.metrics!!.fitnessInsights)
        assertEquals(1, dto.workouts.size)
        assertEquals(152.0, dto.analysis.avgHeartRate!!, 0.0)
    }

    @Test
    fun `encode e camelCase e omite nulos como o iOS`() {
        // Se houvesse naming strategy snake_case, seria "refresh_token" e o backend rejeitaria.
        assertEquals("""{"refreshToken":"r1"}""", json.encodeToString(RefreshRequest.serializer(), RefreshRequest("r1")))

        // Nulos omitidos (paridade com encodeIfPresent do UpdateProfileRequest iOS).
        assertEquals("""{"name":"Alex"}""", json.encodeToString(UpdateProfileRequest.serializer(), UpdateProfileRequest(name = "Alex")))
    }
}
