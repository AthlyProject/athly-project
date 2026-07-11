package com.athly.runner.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/*
 * Enums de contrato (wire) espelhando APIModels.swift.
 *
 * IMPORTANTE — casing do JSON: o backend NestJS usa camelCase em requests E responses
 * (verificado em athly-backend/src/modules). O `convertFromSnakeCase` do iOS é no-op em
 * chaves camelCase, então o contrato efetivo é camelCase. Aqui usamos os nomes de
 * propriedade Kotlin como estão (sem naming strategy) + @SerialName nos valores de enum.
 * Extensões de UI (label pt-BR, emoji/ícone) ficam no domínio (prompt 03).
 */

/** Espelha `SportType` do iOS (APIModels.swift). */
@Serializable
enum class SportType {
    @SerialName("running") RUNNING,
    @SerialName("cycling") CYCLING,
    @SerialName("swimming") SWIMMING,
    @SerialName("strength") STRENGTH,
    @SerialName("crossfit") CROSSFIT,
    @SerialName("triathlon") TRIATHLON,
    @SerialName("duathlon") DUATHLON,
    @SerialName("yoga") YOGA,
    @SerialName("walking") WALKING,
    @SerialName("other") OTHER,
}

/** Espelha `WorkoutStatus` do iOS. */
@Serializable
enum class WorkoutStatus {
    @SerialName("scheduled") SCHEDULED,
    @SerialName("done") DONE,
    @SerialName("skipped") SKIPPED,
    @SerialName("partial") PARTIAL,
}

/** Espelha `WeeklyGoalStatus` do iOS (valores já em maiúsculas no wire). */
@Serializable
enum class WeeklyGoalStatus {
    PLANNED,
    GENERATED,
    CANCELLED,
    LOCKED,
}
