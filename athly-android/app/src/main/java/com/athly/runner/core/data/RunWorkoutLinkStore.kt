package com.athly.runner.core.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.athly.runner.core.network.AthlyJson
import com.athly.runner.domain.model.RunWorkoutLink
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

private val Context.runWorkoutLinkDataStore by preferencesDataStore(name = "run_workout_links")

/**
 * Mapa local `healthConnectId → athlyWorkoutId` — espelha o `RunWorkoutLinkStore` do iOS (JSON em
 * Documents → aqui DataStore). Liga a corrida gravada no Health ao treino prescrito para o
 * `completeWorkout` (prompt 17) e para detectar corridas órfãs.
 */
@Singleton
class RunWorkoutLinkStore @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val json = AthlyJson.create()
    private val linksKey = stringPreferencesKey("links_json_v1")

    @Serializable
    private data class StoredLink(
        val healthConnectId: String,
        val athlyWorkoutId: String,
        val linkedAtMillis: Long,
    )

    suspend fun link(healthConnectId: String, athlyWorkoutId: String) {
        val links = loadAll().filterNot { it.healthConnectId == healthConnectId } +
            RunWorkoutLink(healthConnectId, athlyWorkoutId, Instant.now())
        persist(links)
    }

    suspend fun athlyWorkoutId(healthConnectId: String): String? =
        loadAll().firstOrNull { it.healthConnectId == healthConnectId }?.athlyWorkoutId

    /** Ids do Health SEM vínculo com treino prescrito — candidatos a corrida livre (órfã). */
    suspend fun allOrphanCandidates(healthConnectIds: List<String>): List<String> {
        val linked = loadAll().map { it.healthConnectId }.toSet()
        return healthConnectIds.filterNot { it in linked }
    }

    suspend fun loadAll(): List<RunWorkoutLink> {
        val raw = context.runWorkoutLinkDataStore.data.first()[linksKey] ?: return emptyList()
        return runCatching {
            json.decodeFromString(ListSerializer(StoredLink.serializer()), raw).map {
                RunWorkoutLink(it.healthConnectId, it.athlyWorkoutId, Instant.ofEpochMilli(it.linkedAtMillis))
            }
        }.getOrDefault(emptyList())
    }

    private suspend fun persist(links: List<RunWorkoutLink>) {
        val raw = json.encodeToString(
            ListSerializer(StoredLink.serializer()),
            links.map { StoredLink(it.healthConnectId, it.athlyWorkoutId, it.linkedAt.toEpochMilli()) },
        )
        context.runWorkoutLinkDataStore.edit { it[linksKey] = raw }
    }
}
