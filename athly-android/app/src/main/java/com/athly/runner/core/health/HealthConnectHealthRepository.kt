package com.athly.runner.core.health

import com.athly.runner.core.common.AthlyResult
import com.athly.runner.data.repository.HealthRepository
import com.athly.runner.domain.model.RunSession
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Implementação real da fronteira de gravação (substitui o stub do prompt 09). Best-effort por
 * contrato: indisponibilidade/permissão negada viram `Failure` — o caller (save da corrida) ignora
 * sem reverter o save local.
 */
@Singleton
class HealthConnectHealthRepository @Inject constructor(
    private val manager: HealthConnectManager,
) : HealthRepository {

    override suspend fun saveRun(session: RunSession): AthlyResult<String?> =
        try {
            AthlyResult.Success(manager.saveRun(session))
        } catch (e: Exception) {
            AthlyResult.Failure(e, "Não foi possível gravar no Health Connect.")
        }
}
