package com.athly.runner.core.health

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

private val Context.healthPermissionDataStore by preferencesDataStore(name = "health_permission_gate")

/**
 * Pede cada conjunto de permissões do Health **uma vez por instalação** — espelha o `PermissionGate`
 * do iOS (chaves versionadas em UserDefaults → aqui DataStore). Subir o sufixo `.v1` re-pede após
 * mudança no conjunto de permissões.
 */
@Singleton
class HealthPermissionGate @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val readRequested = booleanPreferencesKey("permission.health.read.requested.v1")
    private val writeRequested = booleanPreferencesKey("permission.health.write.requested.v1")

    suspend fun shouldRequestRead(): Boolean =
        context.healthPermissionDataStore.data.first()[readRequested] != true

    suspend fun markReadRequested() {
        context.healthPermissionDataStore.edit { it[readRequested] = true }
    }

    suspend fun shouldRequestWrite(): Boolean =
        context.healthPermissionDataStore.data.first()[writeRequested] != true

    suspend fun markWriteRequested() {
        context.healthPermissionDataStore.edit { it[writeRequested] = true }
    }
}
