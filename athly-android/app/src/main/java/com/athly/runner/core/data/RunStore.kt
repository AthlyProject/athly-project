package com.athly.runner.core.data

import com.athly.runner.core.data.db.RunSessionDao
import com.athly.runner.core.data.db.RunSessionEntity
import com.athly.runner.core.data.db.StoredRoutePoint
import com.athly.runner.core.data.db.StoredSplit
import com.athly.runner.core.network.AthlyJson
import com.athly.runner.domain.model.RoutePoint
import com.athly.runner.domain.model.RunSession
import com.athly.runner.domain.model.Split
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.builtins.ListSerializer
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Persistência local das corridas (Room) — espelha o `RunStore` do iOS. Expõe um `Flow` ordenado por data
 * desc (= `sortedSessions`) e `add/update/delete` em `Dispatchers.IO`. Fonte do histórico offline (prompt 13).
 */
@Singleton
class RunStore @Inject constructor(
    private val dao: RunSessionDao,
) {
    private val json = AthlyJson.create()

    val sessions: Flow<List<RunSession>> = dao.observeAll().map { list -> list.map { it.toDomain() } }

    suspend fun add(session: RunSession) = withContext(Dispatchers.IO) { dao.insert(session.toEntity()) }

    suspend fun update(session: RunSession) = withContext(Dispatchers.IO) { dao.update(session.toEntity()) }

    suspend fun delete(session: RunSession) = withContext(Dispatchers.IO) {
        dao.findById(session.id)?.let { dao.delete(it) }
    }

    private fun RunSession.toEntity(): RunSessionEntity = RunSessionEntity(
        id = id,
        startDateMillis = startDate.toEpochMilli(),
        endDateMillis = endDate?.toEpochMilli(),
        distanceMeters = distanceMeters,
        durationSeconds = durationSeconds,
        averagePaceSecondsPerKm = averagePaceSecondsPerKm,
        elevationGainMeters = elevationGainMeters,
        caloriesBurned = caloriesBurned,
        status = status,
        sportType = sportType,
        routePointsJson = json.encodeToString(
            ListSerializer(StoredRoutePoint.serializer()),
            routePoints.map {
                StoredRoutePoint(
                    latitude = it.latitude,
                    longitude = it.longitude,
                    altitude = it.altitude,
                    timestampMillis = it.timestamp.toEpochMilli(),
                    speed = it.speed,
                    horizontalAccuracy = it.horizontalAccuracy,
                )
            },
        ),
        splitsJson = json.encodeToString(
            ListSerializer(StoredSplit.serializer()),
            splits.map {
                StoredSplit(
                    kilometer = it.kilometer,
                    durationSeconds = it.durationSeconds,
                    distanceMeters = it.distanceMeters,
                    paceSecondsPerKm = it.paceSecondsPerKm,
                    elevationDelta = it.elevationDelta,
                )
            },
        ),
        backendId = backendId,
        synced = synced,
    )

    private fun RunSessionEntity.toDomain(): RunSession = RunSession(
        id = id,
        startDate = Instant.ofEpochMilli(startDateMillis),
        endDate = endDateMillis?.let { Instant.ofEpochMilli(it) },
        distanceMeters = distanceMeters,
        durationSeconds = durationSeconds,
        averagePaceSecondsPerKm = averagePaceSecondsPerKm,
        elevationGainMeters = elevationGainMeters,
        caloriesBurned = caloriesBurned,
        status = status,
        sportType = sportType,
        routePoints = json.decodeFromString(ListSerializer(StoredRoutePoint.serializer()), routePointsJson).map {
            RoutePoint(
                latitude = it.latitude,
                longitude = it.longitude,
                altitude = it.altitude,
                timestamp = Instant.ofEpochMilli(it.timestampMillis),
                speed = it.speed,
                horizontalAccuracy = it.horizontalAccuracy,
            )
        },
        splits = json.decodeFromString(ListSerializer(StoredSplit.serializer()), splitsJson).map {
            Split(
                kilometer = it.kilometer,
                durationSeconds = it.durationSeconds,
                distanceMeters = it.distanceMeters,
                paceSecondsPerKm = it.paceSecondsPerKm,
                elevationDelta = it.elevationDelta,
            )
        },
        backendId = backendId,
        synced = synced,
    )
}
