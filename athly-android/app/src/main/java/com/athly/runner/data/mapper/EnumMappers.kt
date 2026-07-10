package com.athly.runner.data.mapper

import com.athly.runner.data.remote.dto.SegmentEndBy as SegmentEndByDto
import com.athly.runner.data.remote.dto.SegmentKind as SegmentKindDto
import com.athly.runner.data.remote.dto.SportType as SportTypeDto
import com.athly.runner.data.remote.dto.WorkoutStatus as WorkoutStatusDto
import com.athly.runner.domain.model.SegmentEndBy
import com.athly.runner.domain.model.SegmentKind
import com.athly.runner.domain.model.SportType
import com.athly.runner.domain.model.WorkoutStatus

/*
 * Mappers enum de wire (data/remote/dto) → enum de domínio (domain/model).
 * Mantém o domínio livre de anotações de serialização.
 */

fun SportTypeDto.toDomain(): SportType = when (this) {
    SportTypeDto.RUNNING -> SportType.RUNNING
    SportTypeDto.CYCLING -> SportType.CYCLING
    SportTypeDto.SWIMMING -> SportType.SWIMMING
    SportTypeDto.STRENGTH -> SportType.STRENGTH
    SportTypeDto.CROSSFIT -> SportType.CROSSFIT
    SportTypeDto.TRIATHLON -> SportType.TRIATHLON
    SportTypeDto.DUATHLON -> SportType.DUATHLON
    SportTypeDto.YOGA -> SportType.YOGA
    SportTypeDto.WALKING -> SportType.WALKING
    SportTypeDto.OTHER -> SportType.OTHER
}

fun WorkoutStatusDto.toDomain(): WorkoutStatus = when (this) {
    WorkoutStatusDto.SCHEDULED -> WorkoutStatus.SCHEDULED
    WorkoutStatusDto.DONE -> WorkoutStatus.DONE
    WorkoutStatusDto.SKIPPED -> WorkoutStatus.SKIPPED
    WorkoutStatusDto.PARTIAL -> WorkoutStatus.PARTIAL
}

fun SegmentKindDto.toDomain(): SegmentKind = when (this) {
    SegmentKindDto.WARMUP -> SegmentKind.WARMUP
    SegmentKindDto.WORK -> SegmentKind.WORK
    SegmentKindDto.RECOVERY -> SegmentKind.RECOVERY
    SegmentKindDto.COOLDOWN -> SegmentKind.COOLDOWN
    SegmentKindDto.REST -> SegmentKind.REST
    SegmentKindDto.SET -> SegmentKind.SET
    SegmentKindDto.UNKNOWN -> SegmentKind.UNKNOWN
}

fun SegmentEndByDto.toDomain(): SegmentEndBy = when (this) {
    SegmentEndByDto.DISTANCE_M -> SegmentEndBy.DISTANCE_M
    SegmentEndByDto.DURATION_SEC -> SegmentEndBy.DURATION_SEC
    SegmentEndByDto.REPS -> SegmentEndBy.REPS
}
