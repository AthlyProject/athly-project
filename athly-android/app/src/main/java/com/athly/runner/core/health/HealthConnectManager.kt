package com.athly.runner.core.health

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseRoute
import androidx.health.connect.client.records.ExerciseRouteResult
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.metadata.Device
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.units.Energy
import androidx.health.connect.client.units.Length
import com.athly.runner.core.data.HealthRunMeta
import com.athly.runner.core.data.HealthRunMetaStore
import com.athly.runner.data.remote.dto.DetailedSessionPayload
import com.athly.runner.data.remote.dto.SegmentLabel
import com.athly.runner.data.remote.dto.SegmentPayload
import com.athly.runner.domain.model.HealthRunItem
import com.athly.runner.domain.model.RoutePoint
import com.athly.runner.domain.model.RunSession
import com.athly.runner.domain.run.SplitCalculator
import dagger.hilt.android.qualifiers.ApplicationContext
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Camada de saúde — HealthKit → Health Connect. Espelha `HealthKitService` + `WorkoutDetailFetcher`
 * do iOS: lê corridas, grava a corrida finalizada (sessão + rota + distância + calorias) e monta o
 * `DetailedSessionPayload` com a cadeia de fallback de splits (`events` > `route` > `synthetic`).
 * Extras sem equivalente (metadata livre do HKWorkout) vivem no [HealthRunMetaStore].
 */
@Singleton
class HealthConnectManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val metaStore: HealthRunMetaStore,
) {
    private val client: HealthConnectClient by lazy { HealthConnectClient.getOrCreate(context) }

    /** `HKHealthStore.isHealthDataAvailable` → status do provider (instalar/atualizar via Play Store). */
    fun sdkStatus(): Int = HealthConnectClient.getSdkStatus(context)

    val isAvailable: Boolean get() = sdkStatus() == HealthConnectClient.SDK_AVAILABLE

    val readPermissions: Set<String> = setOf(
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
    )

    val writePermissions: Set<String> = setOf(
        HealthPermission.getWritePermission(ExerciseSessionRecord::class),
        HealthPermission.getWritePermission(DistanceRecord::class),
        HealthPermission.getWritePermission(TotalCaloriesBurnedRecord::class),
        HealthPermission.PERMISSION_WRITE_EXERCISE_ROUTE,
    )

    suspend fun grantedPermissions(): Set<String> =
        if (isAvailable) client.permissionController.getGrantedPermissions() else emptySet()

    suspend fun hasReadPermissions(): Boolean = grantedPermissions().containsAll(readPermissions)

    suspend fun hasWritePermissions(): Boolean = grantedPermissions().containsAll(writePermissions)

    // MARK: - Leitura (fetchLatestRunningWorkouts do iOS)

    /**
     * Últimas corridas do Health Connect, mais recentes primeiro. Sem permissão/provider → lista
     * vazia (negação não derruba a leitura). Duração/pace preferem o meta gravado por nós
     * (duração ativa, descontando pausas); sessões de terceiros usam `end - start` + pace derivado.
     */
    suspend fun readRunningSessions(limit: Int = 20): List<HealthRunItem> {
        val sessions = fetchLatestRawRunningSessions(limit)
        return sessions.map { session ->
            val window = TimeRangeFilter.between(session.startTime, session.endTime)
            val agg = runCatching {
                client.aggregate(
                    AggregateRequest(
                        metrics = setOf(DistanceRecord.DISTANCE_TOTAL, TotalCaloriesBurnedRecord.ENERGY_TOTAL),
                        timeRangeFilter = window,
                    ),
                )
            }.getOrNull()
            val distanceMeters = agg?.get(DistanceRecord.DISTANCE_TOTAL)?.inMeters ?: 0.0
            val calories = agg?.get(TotalCaloriesBurnedRecord.ENERGY_TOTAL)?.inKilocalories ?: 0.0

            val meta = metaStore.get(session.metadata.id)
            val wallDuration = seconds(session.startTime, session.endTime)
            val activeDuration = meta?.activeDurationSeconds ?: wallDuration
            val pace = meta?.averagePaceSecondsPerKm?.takeIf { it > 0 }
                ?: if (distanceMeters > 0) activeDuration / (distanceMeters / 1000.0) else 0.0

            HealthRunItem(
                id = session.metadata.id,
                startDate = session.startTime,
                endDate = session.endTime,
                durationSeconds = activeDuration,
                distanceMeters = distanceMeters,
                averagePaceSecondsPerKm = pace,
                activeEnergyBurned = calories,
                elevationGainMeters = null,
            )
        }
    }

    /** Sessões brutas p/ o detalhador — `fetchLatestRawRunningWorkouts` do iOS. */
    suspend fun fetchLatestRawRunningSessions(limit: Int): List<ExerciseSessionRecord> {
        if (!isAvailable) return emptyList()
        val granted = grantedPermissions()
        if (HealthPermission.getReadPermission(ExerciseSessionRecord::class) !in granted) return emptyList()

        val response = runCatching {
            client.readRecords(
                ReadRecordsRequest(
                    recordType = ExerciseSessionRecord::class,
                    timeRangeFilter = TimeRangeFilter.before(Instant.now()),
                    ascendingOrder = false,
                    pageSize = (limit * 3).coerceIn(limit, 100),
                ),
            )
        }.getOrNull() ?: return emptyList()

        return response.records
            .filter { it.exerciseType == ExerciseSessionRecord.EXERCISE_TYPE_RUNNING }
            .sortedByDescending { it.endTime }
            .take(limit)
    }

    suspend fun fetchSession(recordId: String): ExerciseSessionRecord? {
        if (!isAvailable) return null
        return runCatching { client.readRecord(ExerciseSessionRecord::class, recordId).record }.getOrNull()
    }

    // MARK: - Escrita (saveWorkout do iOS)

    /**
     * Grava a corrida: `ExerciseSessionRecord(RUNNING)` com rota + `DistanceRecord` +
     * `TotalCaloriesBurnedRecord` na mesma janela. Extras (duração ativa/pace) vão para o
     * [HealthRunMetaStore] indexados pelo id criado. Retorna o id do registro da sessão.
     */
    suspend fun saveRun(session: RunSession): String {
        check(isAvailable) { "Health Connect indisponível neste dispositivo." }
        check(hasWritePermissions()) { "Permissões de escrita do Health não concedidas." }

        val start = session.startDate
        val end = session.endDate ?: start.plusSeconds(session.durationSeconds.toLong())
        val zone: ZoneOffset = ZoneId.systemDefault().rules.getOffset(start)
        val device = Device(type = Device.TYPE_PHONE)
        val metadata = Metadata.activelyRecorded(device)

        val route = session.routePoints
            .sortedBy { it.timestamp }
            .map { point ->
                ExerciseRoute.Location(
                    time = point.timestamp,
                    latitude = point.latitude,
                    longitude = point.longitude,
                    horizontalAccuracy = point.horizontalAccuracy.takeIf { it > 0 }?.let(Length::meters),
                    altitude = Length.meters(point.altitude),
                )
            }
            .takeIf { it.size >= 2 }
            ?.let(::ExerciseRoute)

        val records = buildList {
            add(
                if (route != null) {
                    ExerciseSessionRecord(
                        startTime = start,
                        startZoneOffset = zone,
                        endTime = end,
                        endZoneOffset = zone,
                        metadata = metadata,
                        exerciseType = ExerciseSessionRecord.EXERCISE_TYPE_RUNNING,
                        title = "Corrida",
                        notes = null,
                        segments = emptyList(),
                        laps = emptyList(),
                        exerciseRoute = route,
                    )
                } else {
                    ExerciseSessionRecord(
                        startTime = start,
                        startZoneOffset = zone,
                        endTime = end,
                        endZoneOffset = zone,
                        metadata = metadata,
                        exerciseType = ExerciseSessionRecord.EXERCISE_TYPE_RUNNING,
                        title = "Corrida",
                    )
                },
            )
            if (session.distanceMeters > 0) {
                add(
                    DistanceRecord(
                        startTime = start,
                        startZoneOffset = zone,
                        endTime = end,
                        endZoneOffset = zone,
                        metadata = Metadata.activelyRecorded(device),
                        distance = Length.meters(session.distanceMeters),
                    ),
                )
            }
            if (session.caloriesBurned > 0) {
                add(
                    TotalCaloriesBurnedRecord(
                        startTime = start,
                        startZoneOffset = zone,
                        endTime = end,
                        endZoneOffset = zone,
                        metadata = Metadata.activelyRecorded(device),
                        energy = Energy.kilocalories(session.caloriesBurned),
                    ),
                )
            }
        }

        val recordId = client.insertRecords(records).recordIdsList.first()
        metaStore.put(
            recordId,
            HealthRunMeta(
                activeDurationSeconds = session.durationSeconds,
                averagePaceSecondsPerKm = session.averagePaceSecondsPerKm,
            ),
        )
        return recordId
    }

    // MARK: - Detalhe por segmento (WorkoutDetailFetcher do iOS)

    private data class RawSegment(
        val label: SegmentLabel,
        val index: Int?,
        val start: Instant,
        val end: Instant,
        val distanceMeters: Double,
        /** Duração corrigida (pausa/buraco descontados). Nulo → caller usa `end - start`. */
        val durationSeconds: Double? = null,
    )

    /**
     * Monta o `DetailedSessionPayload` — cadeia de fallback idêntica ao iOS:
     * `events` (segments/laps ≥2 + distância real da rota) > `route` (km splits do
     * [SplitCalculator]) > `synthetic` (1 segmento/km dos totais).
     */
    suspend fun buildDetailedSession(
        session: ExerciseSessionRecord,
        athlyWorkoutId: String?,
    ): DetailedSessionPayload? {
        if (!isAvailable) return null

        val window = TimeRangeFilter.between(session.startTime, session.endTime)
        val distanceMeters = runCatching {
            client.aggregate(AggregateRequest(setOf(DistanceRecord.DISTANCE_TOTAL), window))
        }.getOrNull()?.get(DistanceRecord.DISTANCE_TOTAL)?.inMeters ?: 0.0
        val calories = runCatching {
            client.aggregate(AggregateRequest(setOf(TotalCaloriesBurnedRecord.ENERGY_TOTAL), window))
        }.getOrNull()?.get(TotalCaloriesBurnedRecord.ENERGY_TOTAL)?.inKilocalories

        val meta = metaStore.get(session.metadata.id)
        val activeDuration = meta?.activeDurationSeconds ?: seconds(session.startTime, session.endTime)
        val avgPace = if (distanceMeters > 0) activeDuration / (distanceMeters / 1000.0) else null

        val hrSamples = fetchHeartRateSamples(session.startTime, session.endTime)
        val hrStats = summarizeHR(hrSamples, from = null, to = null)

        val routePoints = routePoints(session)

        var splitsSource = "events"
        var rawSegments = segmentsFromEvents(session, routePoints)
        if (rawSegments == null) {
            val real = realKmSplitsFromRoute(routePoints)
            if (real != null) {
                rawSegments = real
                splitsSource = "route"
            } else {
                rawSegments = syntheticKmSplits(
                    startDate = session.startTime,
                    endDate = session.endTime,
                    totalDistanceMeters = distanceMeters,
                    totalDurationSeconds = activeDuration,
                )
                splitsSource = "synthetic"
            }
        }

        val segments = rawSegments.map { seg ->
            val hr = summarizeHR(hrSamples, from = seg.start, to = seg.end)
            val durationSeconds = seg.durationSeconds ?: seconds(seg.start, seg.end)
            val pace = if (seg.distanceMeters > 0) durationSeconds / (seg.distanceMeters / 1000.0) else null
            SegmentPayload(
                label = seg.label,
                index = seg.index,
                distanceKm = seg.distanceMeters / 1000.0,
                durationSeconds = durationSeconds,
                avgPaceSecondsPerKm = pace,
                avgHR = hr.avg,
                peakHR = hr.peak,
                endHR = hr.end,
            )
        }

        return DetailedSessionPayload(
            startDate = isoFractional.format(session.startTime),
            appleHealthWorkoutUUID = session.metadata.id,
            athlyWorkoutId = athlyWorkoutId,
            distanceMeters = distanceMeters,
            durationSeconds = activeDuration,
            averagePaceSecondsPerKm = avgPace,
            avgHR = hrStats.avg,
            maxHR = hrStats.peak,
            activeEnergyBurned = calories,
            elevationGainMeters = null,
            segments = segments,
            splitsSource = splitsSource,
        )
    }

    /** Rota da sessão → domínio. Terceiros sem consentimento (`ConsentRequired`) → vazio. */
    fun routePoints(session: ExerciseSessionRecord): List<RoutePoint> {
        val data = session.exerciseRouteResult as? ExerciseRouteResult.Data ?: return emptyList()
        return data.exerciseRoute.route
            .sortedBy { it.time }
            .map { loc ->
                RoutePoint(
                    latitude = loc.latitude,
                    longitude = loc.longitude,
                    altitude = loc.altitude?.inMeters ?: 0.0,
                    timestamp = loc.time,
                    speed = 0.0,
                    horizontalAccuracy = loc.horizontalAccuracy?.inMeters ?: 0.0,
                )
            }
    }

    /**
     * Laps/segments da sessão como fronteiras (espelha `segmentsFromThirdPartyEvents`): exige ≥2
     * eventos E rota (a distância real de cada trecho vem da rota interpolada — ratear pelo tempo
     * fabricaria pace). Heurística: 1º trecho ≥4min = warmup; último ≥3min = cooldown; rep/rec pelo
     * desvio vs mediana quando o spread ≥ 30 s/km; senão tudo easy (corrida contínua com auto-laps).
     */
    private fun segmentsFromEvents(
        session: ExerciseSessionRecord,
        routePoints: List<RoutePoint>,
    ): List<RawSegment>? {
        val boundaries = (session.segments.map { it.startTime } + session.laps.map { it.startTime })
            .distinct()
            .sorted()
        if (boundaries.size < 2) return null
        if (routePoints.size < 2) return null

        val ranges = mutableListOf<Pair<Instant, Instant>>()
        if (boundaries.first() > session.startTime) {
            ranges.add(session.startTime to boundaries.first())
        }
        for (i in boundaries.indices) {
            val start = boundaries[i]
            val end = if (i + 1 < boundaries.size) boundaries[i + 1] else session.endTime
            if (end > start) ranges.add(start to end)
        }
        if (ranges.isEmpty()) return null
        val rangedDistances = SplitCalculator.distances(ranges, routePoints) ?: return null

        val warmupIdx = ranges.firstOrNull()
            ?.let { if (seconds(it.first, it.second) >= 240) 0 else -1 } ?: -1
        val cooldownIdx = ranges.lastOrNull()
            ?.let { if (seconds(it.first, it.second) >= 180) ranges.size - 1 else -1 } ?: -1

        val middlePaces = ranges.mapIndexedNotNull { i, range ->
            if (i == warmupIdx || i == cooldownIdx) return@mapIndexedNotNull null
            val duration = seconds(range.first, range.second)
            if (rangedDistances[i] > 50) duration / (rangedDistances[i] / 1000.0) else Double.POSITIVE_INFINITY
        }
        val finitePaces = middlePaces.filter { it.isFinite() }.sorted()
        val median = if (finitePaces.isEmpty()) Double.POSITIVE_INFINITY else finitePaces[finitePaces.size / 2]
        val spread = (finitePaces.lastOrNull() ?: 0.0) - (finitePaces.firstOrNull() ?: 0.0)
        val hasIntervalStructure = finitePaces.size >= 2 && spread >= 30

        var repCounter = 0
        var recCounter = 0
        return ranges.mapIndexed { i, range ->
            val duration = seconds(range.first, range.second)
            val pace = if (rangedDistances[i] > 50) duration / (rangedDistances[i] / 1000.0) else Double.POSITIVE_INFINITY
            var index: Int? = null
            val label = when {
                i == warmupIdx -> SegmentLabel.WARMUP
                i == cooldownIdx -> SegmentLabel.COOLDOWN
                hasIntervalStructure -> {
                    if (pace.isFinite() && pace < median - 5) {
                        repCounter += 1
                        index = repCounter
                        SegmentLabel.REP
                    } else {
                        recCounter += 1
                        index = recCounter
                        SegmentLabel.REC
                    }
                }
                else -> SegmentLabel.EASY
            }
            RawSegment(
                label = label,
                index = index,
                start = range.first,
                end = range.second,
                distanceMeters = rangedDistances[i],
            )
        }
    }

    /** Splits reais de 1 km da rota — MESMO algoritmo da tela ([SplitCalculator], prompt 07). */
    private fun realKmSplitsFromRoute(routePoints: List<RoutePoint>): List<RawSegment>? {
        if (routePoints.size < 2) return null
        val splits = SplitCalculator.kmSplits(routePoints)
        if (splits.isEmpty()) return null
        return splits.map { split ->
            RawSegment(
                label = SegmentLabel.EASY,
                index = null,
                start = split.startDate,
                end = split.endDate,
                distanceMeters = split.distanceMeters,
                durationSeconds = split.durationSeconds,
            )
        }
    }

    /** 1 segmento por km dos totais (km cheios + sobra > 50 m) — espelha `syntheticKmSplits`. */
    private fun syntheticKmSplits(
        startDate: Instant,
        endDate: Instant,
        totalDistanceMeters: Double,
        totalDurationSeconds: Double,
    ): List<RawSegment> {
        if (totalDistanceMeters < 1000 || totalDurationSeconds <= 0) {
            return listOf(
                RawSegment(
                    label = SegmentLabel.EASY,
                    index = null,
                    start = startDate,
                    end = endDate,
                    distanceMeters = totalDistanceMeters,
                ),
            )
        }

        val avgPaceSeconds = totalDurationSeconds / (totalDistanceMeters / 1000.0)
        val fullKms = (totalDistanceMeters / 1000.0).toInt()
        val segments = mutableListOf<RawSegment>()
        var cursor = startDate

        repeat(fullKms) {
            val segEnd = cursor.plusMillis((avgPaceSeconds * 1000).toLong())
            segments.add(
                RawSegment(
                    label = SegmentLabel.EASY,
                    index = null,
                    start = cursor,
                    end = segEnd,
                    distanceMeters = 1000.0,
                ),
            )
            cursor = segEnd
        }

        if (cursor < endDate) {
            val leftover = totalDistanceMeters - fullKms * 1000.0
            if (leftover > 50) {
                segments.add(
                    RawSegment(
                        label = SegmentLabel.EASY,
                        index = null,
                        start = cursor,
                        end = endDate,
                        distanceMeters = leftover,
                    ),
                )
            }
        }

        return segments
    }

    // MARK: - Heart rate

    private data class HrSample(val time: Instant, val bpm: Double)

    private data class HrStats(val avg: Double?, val peak: Double?, val end: Double?)

    private suspend fun fetchHeartRateSamples(start: Instant, end: Instant): List<HrSample> {
        val granted = grantedPermissions()
        if (HealthPermission.getReadPermission(HeartRateRecord::class) !in granted) return emptyList()
        val response = runCatching {
            client.readRecords(
                ReadRecordsRequest(
                    recordType = HeartRateRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(start, end),
                ),
            )
        }.getOrNull() ?: return emptyList()
        return response.records
            .flatMap { record -> record.samples.map { HrSample(it.time, it.beatsPerMinute.toDouble()) } }
            .sortedBy { it.time }
    }

    private fun summarizeHR(samples: List<HrSample>, from: Instant?, to: Instant?): HrStats {
        val filtered = if (from != null && to != null) {
            samples.filter { it.time >= from && it.time <= to }
        } else {
            samples
        }
        if (filtered.isEmpty()) return HrStats(null, null, null)
        val values = filtered.map { it.bpm }
        return HrStats(
            avg = values.average(),
            peak = values.max(),
            end = filtered.last().bpm,
        )
    }

    private fun seconds(from: Instant, to: Instant): Double =
        (to.toEpochMilli() - from.toEpochMilli()) / 1000.0

    private companion object {
        /** ISO8601 com fração — o backend espera `yyyy-MM-dd'T'HH:mm:ss.SSSXXX` (iOS withFractionalSeconds). */
        val isoFractional: DateTimeFormatter =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSXXX").withZone(ZoneOffset.UTC)
    }
}
