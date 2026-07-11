package com.athly.runner.core.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.athly.runner.core.network.AthlyJson
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import javax.inject.Inject
import javax.inject.Singleton

private val Context.healthRunMetaDataStore by preferencesDataStore(name = "health_run_meta")

/** Extras que o HKWorkout guardava como metadata livre. */
@Serializable
data class HealthRunMeta(
    val activeDurationSeconds: Double,
    val averagePaceSecondsPerKm: Double,
)

/**
 * Health Connect NÃO tem metadata livre como o HKWorkout — os extras `activeDurationSeconds`
 * (duração descontando pausas) e `averagePaceSecondsPerKm` gravados pelo iOS viram este store
 * local, indexado pelo `record.metadata.id`. Sem isso, a releitura das nossas corridas perderia
 * a duração ativa (voltaria o tempo de parede).
 */
@Singleton
class HealthRunMetaStore @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val json = AthlyJson.create()
    private val metaKey = stringPreferencesKey("meta_json_v1")
    private val serializer = MapSerializer(String.serializer(), HealthRunMeta.serializer())

    suspend fun put(recordId: String, meta: HealthRunMeta) {
        val all = loadAll() + (recordId to meta)
        context.healthRunMetaDataStore.edit { it[metaKey] = json.encodeToString(serializer, all) }
    }

    suspend fun get(recordId: String): HealthRunMeta? = loadAll()[recordId]

    private suspend fun loadAll(): Map<String, HealthRunMeta> {
        val raw = context.healthRunMetaDataStore.data.first()[metaKey] ?: return emptyMap()
        return runCatching { json.decodeFromString(serializer, raw) }.getOrDefault(emptyMap())
    }
}
