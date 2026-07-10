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
import java.util.Base64

/**
 * Backend MOCK 100% offline usado só quando `BuildConfig.MOCK_BACKEND` é true (debug + opt-in em
 * local.properties). Espelha, no idioma do Android, o `MockHealthKitService` do iOS (swap por
 * `#if targetEnvironment(simulator)`): a classe existe no app mas nunca é instanciada com o flag
 * desligado, então builds de device físico/release continuam falando com o backend real.
 *
 * Estratégia por endpoint:
 *  - auth (login/register/refresh) devolve um JWT sintético válido com claim `sub`, para o fluxo real
 *    de tokens (AuthRepository → TokenStore → AuthGate) liberar as abas sem servidor nem credenciais;
 *  - perfil e entitlement devolvem dados plausíveis (corpo obrigatório em `apiCall`);
 *  - plano/treino/meta ausentes devolvem corpo nulo (tolerado por `apiCallOptional`), levando o app
 *    aos estados "sem plano/treino" — suficiente para validar o mapa e a navegação no emulador.
 */
class FakeApiService : ApiService {

    private val userId = "mock-user-id"
    private val accessToken = fakeJwt(userId)
    private val refreshToken = fakeJwt("$userId-refresh")

    private val mockUser = UserProfileDto(
        id = userId,
        name = "Atleta Mock",
        username = "athly_mock",
        email = "mock@athly.app",
        weight = 72.0,
        height = 178.0,
        availableDays = listOf("monday", "wednesday", "friday", "sunday"),
        assessmentCompleted = true,
    )

    // ── Auth ─────────────────────────────────────────────────────────────────────

    override suspend fun login(body: LoginRequest): Response<AuthResponse> =
        Response.success(AuthResponse(accessToken, refreshToken))

    override suspend fun register(body: RegisterRequest): Response<AuthResponse> =
        Response.success(AuthResponse(accessToken, refreshToken))

    override suspend fun refresh(body: RefreshRequest): Response<RefreshResponse> =
        Response.success(RefreshResponse(accessToken, refreshToken))

    // ── Users ────────────────────────────────────────────────────────────────────

    override suspend fun getUserProfile(): Response<UserProfileDto> = Response.success(mockUser)

    override suspend fun updateProfile(body: UpdateProfileRequest): Response<UserProfileDto> =
        Response.success(
            mockUser.copy(
                name = body.name ?: mockUser.name,
                weight = body.weight ?: mockUser.weight,
                availableDays = body.availableDays ?: mockUser.availableDays,
            ),
        )

    override suspend fun deleteAccount(): Response<Unit> = Response.success(Unit)

    // ── Training plans ───────────────────────────────────────────────────────────

    override suspend fun getMyTrainingPlan(): Response<TrainingPlanDto> = nullOk()

    override suspend fun deleteTrainingPlan(id: String): Response<Unit> = Response.success(Unit)

    override suspend fun getWeeklyGoals(trainingPlanId: String): Response<List<WeeklyGoalDto>> =
        Response.success(emptyList())

    override suspend fun getAdminWeeklyReport(weeklyGoalId: String): Response<AdminWeeklyReportDto> =
        nullOk()

    // ── Workouts ─────────────────────────────────────────────────────────────────

    override suspend fun getTodayWorkout(): Response<WorkoutDto> = nullOk()

    override suspend fun getWorkoutsByTrainingPlan(trainingPlanId: String): Response<List<WorkoutDto>> =
        Response.success(emptyList())

    override suspend fun completeWorkout(
        workoutId: String,
        body: CompleteWorkoutRequest,
    ): Response<WorkoutDto> = nullOk()

    override suspend fun completeWorkoutEmpty(
        workoutId: String,
        body: RequestBody,
    ): Response<WorkoutDto> = nullOk()

    override suspend fun skipWorkout(
        workoutId: String,
        body: RequestBody,
    ): Response<WorkoutDto> = nullOk()

    override suspend fun submitWorkoutFeedback(
        workoutId: String,
        body: WorkoutFeedbackRequest,
    ): Response<Unit> = Response.success(Unit)

    // ── Goals ────────────────────────────────────────────────────────────────────

    override suspend fun createGoal(body: CreateGoalRequest): Response<CreateGoalResponse> = nullOk()

    override suspend fun getActiveGoal(): Response<CreateGoalResponse> = nullOk()

    // ── AI planner ───────────────────────────────────────────────────────────────

    override suspend fun planFromHealth(body: PlanFromHealthRequest): Response<AiPlannerResponse> =
        nullOk()

    override suspend fun startPlanFromHealthGeneration(
        body: PlanFromHealthRequest,
    ): Response<AiPlannerGenerationStartResponse> = nullOk()

    override suspend fun getPlanFromHealthGenerationStatus(
        generationId: String,
    ): Response<AiPlannerGenerationStatusResponse> = nullOk()

    // ── Billing ──────────────────────────────────────────────────────────────────

    override suspend fun getEntitlement(): Response<EntitlementDto> = Response.success(
        EntitlementDto(
            entitled = true,
            isAdmin = false,
            isFounderEligible = false,
            trialEndsAt = null,
            trialDaysRemaining = null,
        ),
    )

    // ── Helpers ──────────────────────────────────────────────────────────────────

    /** 200 com corpo nulo — espelha os 200-null do backend (tratados por `apiCallOptional`). */
    private fun <T> nullOk(): Response<T> = Response.success<T>(null)

    /** JWT sintético (header.payload.signature) com claim `sub`, para `currentUserId()` decodificar. */
    private fun fakeJwt(sub: String): String {
        val enc = Base64.getUrlEncoder().withoutPadding()
        val header = enc.encodeToString("""{"alg":"HS256","typ":"JWT"}""".toByteArray())
        val payload = enc.encodeToString("""{"sub":"$sub","email":"mock@athly.app"}""".toByteArray())
        val signature = enc.encodeToString("mock-signature".toByteArray())
        return "$header.$payload.$signature"
    }
}
