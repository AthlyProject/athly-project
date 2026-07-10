package com.athly.runner.data.repository

import com.athly.runner.core.common.AthlyResult
import com.athly.runner.core.network.apiCall
import com.athly.runner.core.network.apiCallOptional
import com.athly.runner.data.remote.ApiService
import com.athly.runner.data.remote.dto.CreateGoalRequest
import com.athly.runner.data.remote.dto.CreateGoalResponse
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GoalRepository @Inject constructor(
    private val api: ApiService,
) {

    suspend fun createGoal(goalText: String): AthlyResult<CreateGoalResponse> =
        apiCall { api.createGoal(CreateGoalRequest(goalText)) }

    /** Null quando não há meta ativa. */
    suspend fun getActiveGoal(): AthlyResult<CreateGoalResponse?> =
        apiCallOptional { api.getActiveGoal() }
}
