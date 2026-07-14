package com.athly.runner.data.remote

import com.athly.runner.data.remote.dto.AdminWeeklyReportDto
import com.athly.runner.data.remote.dto.AiPlannerGenerationStartResponse
import com.athly.runner.data.remote.dto.AiPlannerGenerationStatusResponse
import com.athly.runner.data.remote.dto.AiPlannerResponse
import com.athly.runner.data.remote.dto.AuthResponse
import com.athly.runner.data.remote.dto.CompleteWorkoutRequest
import com.athly.runner.data.remote.dto.CreateGoalRequest
import com.athly.runner.data.remote.dto.CreateGoalResponse
import com.athly.runner.data.remote.dto.EntitlementDto
import com.athly.runner.data.remote.dto.LoginRequest
import com.athly.runner.data.remote.dto.PlanFromHealthRequest
import com.athly.runner.data.remote.dto.RefreshRequest
import com.athly.runner.data.remote.dto.RefreshResponse
import com.athly.runner.data.remote.dto.RegisterRequest
import com.athly.runner.data.remote.dto.TrainingPlanDto
import com.athly.runner.data.remote.dto.UpdateProfileRequest
import com.athly.runner.data.remote.dto.UserProfileDto
import com.athly.runner.data.remote.dto.WeeklyGoalDto
import com.athly.runner.data.remote.dto.WorkoutDto
import com.athly.runner.data.remote.dto.WorkoutFeedbackRequest
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

/**
 * Espelha 1:1 os endpoints do APIClient.swift (base `https://api.athlyproject.app`).
 * Todos retornam `Response<T>` — o mapeamento de status/erros fica nos helpers de ApiCall.kt.
 */
interface ApiService {

    // ── Auth (sem Bearer — AuthInterceptor isenta as rotas /auth/*) ─────────────

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): Response<AuthResponse>

    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): Response<AuthResponse>

    @POST("auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): Response<RefreshResponse>

    // ── Users ───────────────────────────────────────────────────────────────────

    @GET("users/me")
    suspend fun getUserProfile(): Response<UserProfileDto>

    @PUT("users/profile")
    suspend fun updateProfile(@Body body: UpdateProfileRequest): Response<UserProfileDto>

    @DELETE("users/me")
    suspend fun deleteAccount(): Response<Unit>

    // ── Training plans ──────────────────────────────────────────────────────────

    /** Backend retorna 200 com corpo `null` quando o usuário não tem plano. */
    @GET("training-plans/me")
    suspend fun getMyTrainingPlan(): Response<TrainingPlanDto>

    @DELETE("training-plans/{id}")
    suspend fun deleteTrainingPlan(@Path("id") id: String): Response<Unit>

    @GET("weekly-goals/training-plan/{id}")
    suspend fun getWeeklyGoals(@Path("id") trainingPlanId: String): Response<List<WeeklyGoalDto>>

    @GET("weekly-goals/{id}/admin-report")
    suspend fun getAdminWeeklyReport(@Path("id") weeklyGoalId: String): Response<AdminWeeklyReportDto>

    // ── Workouts ────────────────────────────────────────────────────────────────

    /** Backend pode retornar 200 com corpo `null`/vazio quando não há treino hoje. */
    @GET("workouts/today")
    suspend fun getTodayWorkout(): Response<WorkoutDto>

    @GET("workouts/training-plan/{id}")
    suspend fun getWorkoutsByTrainingPlan(@Path("id") trainingPlanId: String): Response<List<WorkoutDto>>

    @PATCH("workouts/{id}/complete")
    suspend fun completeWorkout(
        @Path("id") workoutId: String,
        @Body body: CompleteWorkoutRequest,
    ): Response<WorkoutDto>

    /** Variante sem dados de health — corpo vazio, como o `patch()` sem httpBody do iOS. */
    @PATCH("workouts/{id}/complete")
    suspend fun completeWorkoutEmpty(
        @Path("id") workoutId: String,
        @Body body: RequestBody,
    ): Response<WorkoutDto>

    @PATCH("workouts/{id}/skip")
    suspend fun skipWorkout(
        @Path("id") workoutId: String,
        @Body body: RequestBody,
    ): Response<WorkoutDto>

    @POST("workouts/{id}/feedback")
    suspend fun submitWorkoutFeedback(
        @Path("id") workoutId: String,
        @Body body: WorkoutFeedbackRequest,
    ): Response<Unit>

    // ── Goals ───────────────────────────────────────────────────────────────────

    @POST("goals")
    suspend fun createGoal(@Body body: CreateGoalRequest): Response<CreateGoalResponse>

    /** Backend pode retornar 200 com corpo `null`/vazio quando não há meta ativa. */
    @GET("goals/active")
    suspend fun getActiveGoal(): Response<CreateGoalResponse>

    // ── AI planner ──────────────────────────────────────────────────────────────

    /** Timeout de 120s aplicado pelo AiPlannerTimeoutInterceptor. */
    @POST("ai-planner/plan-from-health")
    suspend fun planFromHealth(@Body body: PlanFromHealthRequest): Response<AiPlannerResponse>

    @POST("ai-planner/plan-from-health/async")
    suspend fun startPlanFromHealthGeneration(
        @Body body: PlanFromHealthRequest,
    ): Response<AiPlannerGenerationStartResponse>

    @GET("ai-planner/plan-from-health/generations/{id}")
    suspend fun getPlanFromHealthGenerationStatus(
        @Path("id") generationId: String,
    ): Response<AiPlannerGenerationStatusResponse>

    // ── Billing ─────────────────────────────────────────────────────────────────

    /** Snapshot de entitlement (repository/uso vêm no prompt 22). */
    @GET("billing/entitlement")
    suspend fun getEntitlement(): Response<EntitlementDto>
}
