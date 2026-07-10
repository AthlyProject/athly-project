package com.athly.runner.data.repository

import com.athly.runner.core.common.AthlyResult
import com.athly.runner.core.network.apiCall
import com.athly.runner.core.network.apiCallOptional
import com.athly.runner.core.network.apiCallUnit
import com.athly.runner.data.remote.ApiService
import com.athly.runner.data.remote.dto.AdminWeeklyReportDto
import com.athly.runner.data.remote.dto.TrainingPlanDto
import com.athly.runner.data.remote.dto.WeeklyGoalDto
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlanRepository @Inject constructor(
    private val api: ApiService,
) {

    /** Null quando o usuário não tem plano (backend responde 200 com corpo `null`). */
    suspend fun getMyTrainingPlan(): AthlyResult<TrainingPlanDto?> =
        apiCallOptional { api.getMyTrainingPlan() }

    /** Deleta o plano (cascade no backend). */
    suspend fun deleteTrainingPlan(id: String): AthlyResult<Unit> =
        apiCallUnit { api.deleteTrainingPlan(id) }

    suspend fun getWeeklyGoals(trainingPlanId: String): AthlyResult<List<WeeklyGoalDto>> =
        apiCall { api.getWeeklyGoals(trainingPlanId) }

    suspend fun getAdminWeeklyReport(weeklyGoalId: String): AthlyResult<AdminWeeklyReportDto> =
        apiCall { api.getAdminWeeklyReport(weeklyGoalId) }
}
