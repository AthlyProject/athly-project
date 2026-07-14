package com.athly.runner.data.repository

import com.athly.runner.core.common.AthlyResult
import com.athly.runner.core.network.apiCall
import com.athly.runner.core.network.apiCallOptional
import com.athly.runner.core.network.apiCallUnit
import com.athly.runner.core.network.emptyJsonBody
import com.athly.runner.data.remote.ApiService
import com.athly.runner.data.remote.dto.CompleteWorkoutRequest
import com.athly.runner.data.remote.dto.WorkoutDto
import com.athly.runner.data.remote.dto.WorkoutFeedbackRequest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class WorkoutRepository @Inject constructor(
    private val api: ApiService,
) {

    /** Null quando não há treino hoje (backend responde 200 com corpo `null`/vazio). */
    suspend fun getTodayWorkout(): AthlyResult<WorkoutDto?> =
        apiCallOptional { api.getTodayWorkout() }

    suspend fun getWorkoutsByTrainingPlan(trainingPlanId: String): AthlyResult<List<WorkoutDto>> =
        apiCall { api.getWorkoutsByTrainingPlan(trainingPlanId) }

    /**
     * Espelha `completeWorkout` do iOS: com id de workout do Health Connect envia o corpo
     * com métricas reais; sem ele, PATCH de corpo vazio.
     */
    suspend fun completeWorkout(
        workoutId: String,
        healthWorkoutId: String? = null,
        actualDistanceMeters: Double? = null,
        actualDurationSeconds: Double? = null,
    ): AthlyResult<WorkoutDto> =
        if (healthWorkoutId != null) {
            apiCall {
                api.completeWorkout(
                    workoutId,
                    CompleteWorkoutRequest(
                        appleHealthWorkoutUUID = healthWorkoutId,
                        actualDistanceMeters = actualDistanceMeters,
                        actualDurationSeconds = actualDurationSeconds,
                    ),
                )
            }
        } else {
            apiCall { api.completeWorkoutEmpty(workoutId, emptyJsonBody()) }
        }

    suspend fun skipWorkout(workoutId: String): AthlyResult<WorkoutDto> =
        apiCall { api.skipWorkout(workoutId, emptyJsonBody()) }

    suspend fun submitFeedback(workoutId: String, feedback: WorkoutFeedbackRequest): AthlyResult<Unit> =
        apiCallUnit { api.submitWorkoutFeedback(workoutId, feedback) }
}
