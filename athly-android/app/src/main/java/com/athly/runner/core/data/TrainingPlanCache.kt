package com.athly.runner.core.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.athly.runner.core.network.AthlyJson
import com.athly.runner.data.remote.dto.RunAnalysisDto
import com.athly.runner.data.remote.dto.TrainingPlanDto
import com.athly.runner.data.remote.dto.WeeklyGoalDto
import com.athly.runner.data.remote.dto.WorkoutDto
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import kotlinx.serialization.Serializable
import javax.inject.Inject
import javax.inject.Singleton

private val Context.trainingPlanDataStore by preferencesDataStore(name = "training_plan_cache")

/** Snapshot offline do plano — espelha `TrainingPlanCacheSnapshot` do iOS. */
@Serializable
data class TrainingPlanCacheSnapshot(
    val trainingPlan: TrainingPlanDto? = null,
    val weeklyGoals: List<WeeklyGoalDto> = emptyList(),
    val allWorkouts: List<WorkoutDto> = emptyList(),
    val todayWorkout: WorkoutDto? = null,
    val lastAnalysis: RunAnalysisDto? = null,
    val updatedAtMillis: Long = 0,
)

/**
 * Cache do plano (cache-first → refresh) — espelha `TrainingPlanCache` do iOS (JSON atômico em
 * Documents → aqui DataStore). Abre o app com dados na hora e refaz o fetch em background.
 */
@Singleton
class TrainingPlanCache @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val json = AthlyJson.create()
    private val snapshotKey = stringPreferencesKey("snapshot_json_v1")

    suspend fun load(): TrainingPlanCacheSnapshot? {
        val raw = context.trainingPlanDataStore.data.first()[snapshotKey] ?: return null
        return runCatching {
            json.decodeFromString(TrainingPlanCacheSnapshot.serializer(), raw)
        }.getOrNull()
    }

    suspend fun save(snapshot: TrainingPlanCacheSnapshot) {
        val raw = runCatching {
            json.encodeToString(TrainingPlanCacheSnapshot.serializer(), snapshot)
        }.getOrNull() ?: return
        context.trainingPlanDataStore.edit { it[snapshotKey] = raw }
    }

    /** Atualiza um workout dentro do snapshot sem refazer o resto — espelha `upsertWorkout`. */
    suspend fun upsertWorkout(workout: WorkoutDto) {
        val snapshot = load() ?: return
        save(
            snapshot.copy(
                allWorkouts = snapshot.allWorkouts.map { if (it.id == workout.id) workout else it },
                todayWorkout = if (snapshot.todayWorkout?.id == workout.id) workout else snapshot.todayWorkout,
            ),
        )
    }

    suspend fun clear() {
        context.trainingPlanDataStore.edit { it.remove(snapshotKey) }
    }
}
