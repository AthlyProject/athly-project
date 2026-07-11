package com.athly.runner.data.repository

import com.athly.runner.core.common.AthlyResult
import com.athly.runner.core.network.apiCall
import com.athly.runner.data.remote.ApiService
import com.athly.runner.data.remote.dto.AiPlannerGenerationStartResponse
import com.athly.runner.data.remote.dto.AiPlannerGenerationStatusResponse
import com.athly.runner.data.remote.dto.AiPlannerResponse
import com.athly.runner.data.remote.dto.PlanFromHealthRequest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AiPlannerRepository @Inject constructor(
    private val api: ApiService,
) {

    /** Geração síncrona do plano — 120s de timeout (AiPlannerTimeoutInterceptor). */
    suspend fun planFromHealth(request: PlanFromHealthRequest): AthlyResult<AiPlannerResponse> =
        apiCall { api.planFromHealth(request) }

    suspend fun startGeneration(request: PlanFromHealthRequest): AthlyResult<AiPlannerGenerationStartResponse> =
        apiCall { api.startPlanFromHealthGeneration(request) }

    suspend fun getGenerationStatus(generationId: String): AthlyResult<AiPlannerGenerationStatusResponse> =
        apiCall { api.getPlanFromHealthGenerationStatus(generationId) }
}
