package com.athly.runner.data.mapper

import com.athly.runner.data.remote.dto.SegmentDto
import com.athly.runner.data.remote.dto.SegmentEndConditionDto
import com.athly.runner.data.remote.dto.SegmentTargetDto
import com.athly.runner.data.remote.dto.WorkoutSegmentsDto
import com.athly.runner.domain.model.Segment
import com.athly.runner.domain.model.SegmentEndCondition
import com.athly.runner.domain.model.SegmentTarget
import com.athly.runner.domain.model.WorkoutSegments

/*
 * Mappers da árvore de segmentos: DTO (data/remote/dto) → domínio (domain/model).
 * O tracker (prompt 07+) consome só o modelo de domínio.
 */

fun WorkoutSegmentsDto.toDomain(): WorkoutSegments = WorkoutSegments(
    schemaVersion = schemaVersion,
    sport = sport.toDomain(),
    segments = segments.map { it.toDomain() },
)

fun SegmentDto.toDomain(): Segment = Segment(
    id = id,
    kind = kind.toDomain(),
    label = label,
    cue = cue,
    end = end?.toDomain(),
    repetitions = repetitions,
    target = target?.toDomain(),
    children = children?.map { it.toDomain() },
    notes = notes,
)

fun SegmentEndConditionDto.toDomain(): SegmentEndCondition = SegmentEndCondition(
    by = by.toDomain(),
    value = value,
)

fun SegmentTargetDto.toDomain(): SegmentTarget = SegmentTarget(
    paceSecPerKmMin = paceSecPerKmMin,
    paceSecPerKmMax = paceSecPerKmMax,
    hrZone = hrZone,
    rpe = rpe,
    powerWattsMin = powerWattsMin,
    powerWattsMax = powerWattsMax,
    cadenceRpm = cadenceRpm,
    strokeType = strokeType,
    poolLengthM = poolLengthM,
    targetSecPer100m = targetSecPer100m,
    exercise = exercise,
    reps = reps,
    loadKg = loadKg,
    loadPctOf1RM = loadPctOf1RM,
    tempoSec = tempoSec,
    restAfterSec = restAfterSec,
)
