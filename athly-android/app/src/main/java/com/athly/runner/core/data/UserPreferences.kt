package com.athly.runner.core.data

import android.content.Context
import androidx.datastore.preferences.core.doublePreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.userMetricsDataStore by preferencesDataStore(name = "user_metrics")

/**
 * Métricas/prefs do usuário em DataStore — espelha `UserMetrics.weightKg` do iOS + o `userName`
 * guardado no registro (usado na saudação do Dashboard). Peso em kg é a fonte para o cálculo de calorias.
 */
@Singleton
class UserPreferences @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private object Keys {
        val WEIGHT_KG = doublePreferencesKey("weight_kg")
        val USER_NAME = stringPreferencesKey("user_name")
    }

    val weightKg: Flow<Double?> = context.userMetricsDataStore.data.map { it[Keys.WEIGHT_KG] }
    val userName: Flow<String?> = context.userMetricsDataStore.data.map { it[Keys.USER_NAME] }

    suspend fun setWeightKg(value: Double) {
        context.userMetricsDataStore.edit { it[Keys.WEIGHT_KG] = value }
    }

    suspend fun setUserName(value: String) {
        context.userMetricsDataStore.edit { it[Keys.USER_NAME] = value }
    }
}
