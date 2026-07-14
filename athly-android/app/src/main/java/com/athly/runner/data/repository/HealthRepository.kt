package com.athly.runner.data.repository

import com.athly.runner.core.common.AthlyResult
import com.athly.runner.domain.model.RunSession

/**
 * Fronteira para a gravação no Health Connect (impl real: `core/health`, prompt 12). Espelha o
 * `HealthKitService.saveWorkout` do iOS. `saveRun` é **best-effort**: falha NÃO reverte o save local.
 * Em sucesso retorna o id do registro no Health (para o `RunWorkoutLink`/completeWorkout do prompt 17).
 */
interface HealthRepository {
    suspend fun saveRun(session: RunSession): AthlyResult<String?>
}
