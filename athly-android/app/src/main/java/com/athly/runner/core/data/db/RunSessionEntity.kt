package com.athly.runner.core.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

/**
 * Corrida persistida localmente (Room) — espelha o `RunStore` do iOS (que usava JSON atômico).
 * Rota e splits ficam como JSON em coluna (o corpo pode ter milhares de pontos). Datas como epoch millis.
 */
@Entity(tableName = "run_sessions")
data class RunSessionEntity(
    @PrimaryKey val id: String,
    val startDateMillis: Long,
    val endDateMillis: Long?,
    val distanceMeters: Double,
    val durationSeconds: Double,
    val averagePaceSecondsPerKm: Double,
    val elevationGainMeters: Double,
    val caloriesBurned: Double,
    val status: String,
    val sportType: String,
    val routePointsJson: String,
    val splitsJson: String,
    val backendId: String?,
    val synced: Boolean,
)

/** Ponto de rota serializável (timestamp como epoch millis, sem depender de serializer de Instant). */
@Serializable
data class StoredRoutePoint(
    val latitude: Double,
    val longitude: Double,
    val altitude: Double,
    val timestampMillis: Long,
    val speed: Double,
    val horizontalAccuracy: Double,
)

/** Split serializável. */
@Serializable
data class StoredSplit(
    val kilometer: Int,
    val durationSeconds: Double,
    val distanceMeters: Double,
    val paceSecondsPerKm: Double,
    val elevationDelta: Double,
)
