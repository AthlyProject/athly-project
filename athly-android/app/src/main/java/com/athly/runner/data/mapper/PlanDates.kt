package com.athly.runner.data.mapper

import com.athly.runner.core.common.IsoDates
import com.athly.runner.data.remote.dto.WeeklyGoalDto
import com.athly.runner.data.remote.dto.WorkoutDto
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/*
 * Datas dos DTOs de plano — espelham `parsedDate`/`parsedStartDate`/`isToday` do iOS
 * (parse tolerante; ausência vira "distantPast" para ordenar no início, como o iOS).
 */

private val distantPast: Instant = Instant.EPOCH

val WorkoutDto.parsedDate: Instant
    get() = IsoDates.parseInstant(date) ?: distantPast

val WorkoutDto.parsedLocalDate: LocalDate
    get() = parsedDate.atZone(ZoneId.systemDefault()).toLocalDate()

val WorkoutDto.isToday: Boolean
    get() = parsedLocalDate == LocalDate.now()

val WeeklyGoalDto.parsedStartDate: Instant
    get() = IsoDates.parseInstant(weekStartDate) ?: distantPast

val WeeklyGoalDto.parsedEndDate: Instant
    get() = IsoDates.parseInstant(weekEndDate) ?: distantPast
