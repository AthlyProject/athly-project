package com.athly.runner.feature.plan

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.athly.runner.core.common.AthlyResult
import com.athly.runner.core.data.RunWorkoutLinkStore
import com.athly.runner.core.data.TrainingPlanCache
import com.athly.runner.core.data.TrainingPlanCacheSnapshot
import com.athly.runner.core.health.HealthConnectManager
import com.athly.runner.core.notifications.WorkoutReminderScheduler
import com.athly.runner.feature.paywall.EntitlementManager
import com.athly.runner.data.mapper.isToday
import com.athly.runner.data.mapper.parsedDate
import com.athly.runner.data.mapper.parsedEndDate
import com.athly.runner.data.mapper.parsedLocalDate
import com.athly.runner.data.mapper.parsedStartDate
import com.athly.runner.data.remote.dto.CreateGoalResponse
import com.athly.runner.data.remote.dto.HealthRunPayload
import com.athly.runner.data.remote.dto.PlanFromHealthRequest
import com.athly.runner.data.remote.dto.RunAnalysisDto
import com.athly.runner.data.remote.dto.SportType
import com.athly.runner.data.remote.dto.TrainingPlanDto
import com.athly.runner.data.remote.dto.WeeklyGoalDto
import com.athly.runner.data.remote.dto.WeeklyGoalStatus
import com.athly.runner.data.remote.dto.WorkoutDto
import com.athly.runner.data.remote.dto.WorkoutStatus
import com.athly.runner.data.repository.AiPlannerRepository
import com.athly.runner.data.repository.GoalRepository
import com.athly.runner.data.repository.PlanRepository
import com.athly.runner.data.repository.WorkoutRepository
import com.athly.runner.domain.model.HealthRunItem
import com.athly.runner.domain.model.StreakCalculator
import com.athly.runner.domain.model.Week
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.TemporalAdjusters
import javax.inject.Inject

/** Estado do plano — espelha os `@Published` do `TrainingPlanViewModel` iOS. */
data class PlanUiState(
    val plan: TrainingPlanDto? = null,
    val weeks: List<Week> = emptyList(),
    val todayWorkout: WorkoutDto? = null,
    val allWorkouts: List<WorkoutDto> = emptyList(),
    val weeklyGoals: List<WeeklyGoalDto> = emptyList(),
    val selectedWeekIndex: Int = 0,
    val isLoading: Boolean = false,
    val isGenerating: Boolean = false,
    val isGeneratingInBackground: Boolean = false,
    val isDeleting: Boolean = false,
    val errorMessage: String? = null,
    val lastAnalysis: RunAnalysisDto? = null,
    val activeGoal: CreateGoalResponse? = null,
) {
    // Semana selecionada (tela Plano)
    val currentWeekWorkouts: List<WorkoutDto>
        get() = weeks.getOrNull(selectedWeekIndex)?.workouts ?: emptyList()

    val completedThisWeek: Int get() = currentWeekWorkouts.count { it.status == WorkoutStatus.DONE }

    val totalThisWeek: Int get() = currentWeekWorkouts.size

    val weeklyProgress: Double
        get() = if (totalThisWeek > 0) completedThisWeek.toDouble() / totalThisWeek else 0.0

    val nextWorkout: WorkoutDto? get() = currentWeekWorkouts.firstOrNull { it.status == WorkoutStatus.SCHEDULED }

    val currentWeekGoal: WeeklyGoalDto? get() = weeks.getOrNull(selectedWeekIndex)?.weeklyGoal

    /** Próximos 5 treinos (≥ hoje, sem `other`) — tela Plano. */
    val nextFiveWorkouts: List<WorkoutDto>
        get() {
            val today = LocalDate.now()
            return allWorkouts
                .filter { it.parsedLocalDate >= today && it.sportType != SportType.OTHER }
                .sortedBy { it.parsedDate }
                .take(5)
        }

    // Semana corrente de calendário segunda→domingo (Dashboard) — independe de weeklyGoals,
    // evita o falso "Nenhum treino planejado" quando o vínculo weeklyGoalId está quebrado.
    val thisWeekWorkouts: List<WorkoutDto>
        get() {
            val today = LocalDate.now()
            val monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
            val sunday = monday.plusDays(6)
            return allWorkouts
                .filter { it.sportType != SportType.OTHER && it.parsedLocalDate in monday..sunday }
                .sortedBy { it.parsedDate }
        }

    val thisWeekCompleted: Int get() = thisWeekWorkouts.count { it.status == WorkoutStatus.DONE }

    val thisWeekTotal: Int get() = thisWeekWorkouts.size

    val thisWeekProgress: Double
        get() = if (thisWeekTotal > 0) thisWeekCompleted.toDouble() / thisWeekTotal else 0.0

    val thisWeekNext: WorkoutDto?
        get() {
            val today = LocalDate.now()
            return thisWeekWorkouts.firstOrNull {
                it.status == WorkoutStatus.SCHEDULED && it.parsedLocalDate >= today
            }
        }

    /** Ofensiva — regra no [StreakCalculator]. */
    val currentStreak: Int
        get() = StreakCalculator.currentStreak(
            allWorkouts
                .filter { it.sportType != SportType.OTHER }
                .map { StreakCalculator.Entry(it.parsedLocalDate, it.status) },
        )
}

/**
 * Porta 1:1 do `TrainingPlanViewModel` iOS: cache-first → refresh, semanas por `weeklyGoalId`,
 * geração via Health Connect (`plan-from-health` assíncrono + polling), complete/skip com rebuild.
 */
@HiltViewModel
class TrainingPlanViewModel @Inject constructor(
    private val planRepository: PlanRepository,
    private val workoutRepository: WorkoutRepository,
    private val goalRepository: GoalRepository,
    private val aiPlannerRepository: AiPlannerRepository,
    private val healthConnectManager: HealthConnectManager,
    private val linkStore: RunWorkoutLinkStore,
    private val cache: TrainingPlanCache,
    private val reminderScheduler: WorkoutReminderScheduler,
    private val entitlementManager: EntitlementManager,
) : ViewModel() {

    /** Gate premium do "Gerar" — fail-open enquanto o paywall está desligado (22). */
    val canUsePremium: Boolean get() = entitlementManager.canUsePremium

    private val _state = MutableStateFlow(PlanUiState())
    val state: StateFlow<PlanUiState> = _state.asStateFlow()

    private var generationPollJob: Job? = null

    fun selectWeek(index: Int) {
        _state.update { it.copy(selectedWeekIndex = index.coerceIn(0, maxOf(0, it.weeks.size - 1))) }
    }

    // MARK: - Load (cache-first → refresh)

    fun loadData() {
        viewModelScope.launch { loadDataInternal() }
    }

    private suspend fun loadDataInternal() {
        val hasCached = hydrateFromCache()
        _state.update { it.copy(isLoading = !hasCached, errorMessage = null) }

        when (val planResult = planRepository.getMyTrainingPlan()) {
            is AthlyResult.Failure -> {
                if (!hasCached) _state.update { it.copy(errorMessage = planResult.message) }
                _state.update { it.copy(isLoading = false) }
                return
            }

            is AthlyResult.Success -> {
                val plan = planResult.data
                if (plan == null) {
                    // Sem plano no backend (404/null) — zera só se não havia cache.
                    if (!hasCached) {
                        _state.update {
                            it.copy(
                                plan = null, weeks = emptyList(), allWorkouts = emptyList(),
                                weeklyGoals = emptyList(), todayWorkout = null,
                            )
                        }
                    }
                    _state.update { it.copy(isLoading = false) }
                    return
                }

                val (goalsResult, workoutsResult) = coroutineScope {
                    val goals = async { planRepository.getWeeklyGoals(plan.id) }
                    val workouts = async { workoutRepository.getWorkoutsByTrainingPlan(plan.id) }
                    goals.await() to workouts.await()
                }

                val goals = (goalsResult as? AthlyResult.Success)?.data
                val workouts = (workoutsResult as? AthlyResult.Success)?.data
                if (goals == null || workouts == null) {
                    if (!hasCached) {
                        val message = (goalsResult as? AthlyResult.Failure)?.message
                            ?: (workoutsResult as? AthlyResult.Failure)?.message
                        _state.update { it.copy(errorMessage = message) }
                    }
                    _state.update { it.copy(isLoading = false) }
                    return
                }

                val sortedGoals = goals.sortedBy { it.parsedStartDate }
                val weeks = buildWeeks(sortedGoals, workouts)
                _state.update { current ->
                    current.copy(
                        plan = plan,
                        weeklyGoals = sortedGoals,
                        allWorkouts = workouts,
                        todayWorkout = todayWorkout(workouts),
                        weeks = weeks,
                        selectedWeekIndex = currentWeekIndex(weeks),
                        isLoading = false,
                        lastAnalysis = sortedGoals.lastOrNull()?.metrics?.let { m ->
                            // metrics → RunAnalysis quando completos (espelha `asRunAnalysis`)
                            if (m.runsAnalyzed != null && m.period != null && m.avgDistanceKm != null &&
                                m.avgPace != null && m.totalDistanceKm != null && m.trend != null &&
                                m.fitnessInsights != null
                            ) {
                                RunAnalysisDto(
                                    title = m.title,
                                    runsAnalyzed = m.runsAnalyzed,
                                    period = m.period,
                                    avgDistanceKm = m.avgDistanceKm,
                                    avgPace = m.avgPace,
                                    avgHeartRate = m.avgHeartRate,
                                    totalDistanceKm = m.totalDistanceKm,
                                    trend = m.trend,
                                    fitnessInsights = m.fitnessInsights,
                                )
                            } else {
                                current.lastAnalysis
                            }
                        } ?: current.lastAnalysis,
                    )
                }

                // Meta ativa (feasibility) — falha aqui não quebra o load.
                (goalRepository.getActiveGoal() as? AthlyResult.Success)?.data?.let { goal ->
                    _state.update { it.copy(activeGoal = goal) }
                }

                persistToCache()
                // Reagenda os lembretes com o plano fresco — espelha o `reschedule` do loadData iOS (21).
                runCatching { reminderScheduler.reschedule(_state.value.allWorkouts) }
            }
        }
    }

    private suspend fun hydrateFromCache(): Boolean {
        val snapshot = cache.load() ?: return false
        val weeks = buildWeeks(snapshot.weeklyGoals, snapshot.allWorkouts)
        _state.update { current ->
            current.copy(
                plan = snapshot.trainingPlan,
                weeklyGoals = snapshot.weeklyGoals,
                allWorkouts = snapshot.allWorkouts,
                todayWorkout = todayWorkout(snapshot.allWorkouts)
                    ?: snapshot.todayWorkout?.takeIf { it.sportType != SportType.OTHER && it.isToday },
                lastAnalysis = current.lastAnalysis ?: snapshot.lastAnalysis,
                weeks = weeks,
                selectedWeekIndex = currentWeekIndex(weeks),
            )
        }
        return true
    }

    private suspend fun persistToCache() {
        val s = _state.value
        cache.save(
            TrainingPlanCacheSnapshot(
                trainingPlan = s.plan,
                weeklyGoals = s.weeklyGoals,
                allWorkouts = s.allWorkouts,
                todayWorkout = s.todayWorkout,
                lastAnalysis = s.lastAnalysis,
                updatedAtMillis = Instant.now().toEpochMilli(),
            ),
        )
    }

    fun loadActiveGoalIfNeeded() {
        if (_state.value.activeGoal != null) return
        viewModelScope.launch {
            (goalRepository.getActiveGoal() as? AthlyResult.Success)?.data?.let { goal ->
                _state.update { it.copy(activeGoal = goal) }
            }
        }
    }

    // MARK: - Delete plan

    fun deleteTrainingPlan(onDone: (Boolean) -> Unit = {}) {
        val plan = _state.value.plan ?: return onDone(false)
        viewModelScope.launch {
            _state.update { it.copy(isDeleting = true) }
            val result = planRepository.deleteTrainingPlan(plan.id)
            when (result) {
                is AthlyResult.Success -> {
                    _state.update {
                        it.copy(
                            plan = null, weeks = emptyList(), allWorkouts = emptyList(),
                            weeklyGoals = emptyList(), todayWorkout = null, lastAnalysis = null,
                            activeGoal = null, selectedWeekIndex = 0, isDeleting = false,
                        )
                    }
                    cache.clear()
                    onDone(true)
                }

                is AthlyResult.Failure -> {
                    _state.update { it.copy(errorMessage = result.message, isDeleting = false) }
                    onDone(false)
                }
            }
        }
    }

    // MARK: - Gerar próxima semana (plan-from-health assíncrono + polling)

    /**
     * Espelha `generateNextWeekWithHealth`: lê corridas do Health Connect (sem permissão/corridas →
     * runs vazias = cold start/assessment no backend), monta `detailedSessions` (5 na 1ª geração, 7
     * depois) e dispara a geração assíncrona com polling até surgirem workouts/goals novos.
     */
    fun generateNextWeek() {
        viewModelScope.launch {
            _state.update { it.copy(isGenerating = true, errorMessage = null) }

            val healthRuns: List<HealthRunItem> = runCatching {
                healthConnectManager.readRunningSessions(limit = 20)
            }.getOrDefault(emptyList())

            val workoutIdsBefore = _state.value.allWorkouts.map { it.id }.toSet()
            val generatedGoalIdsBefore = _state.value.weeklyGoals
                .filter { it.status == WeeklyGoalStatus.GENERATED }
                .map { it.id }
                .toSet()

            val payloads = healthRuns.map { it.toPayload() }
            val detailedSessions = if (healthRuns.isEmpty()) {
                emptyList()
            } else {
                buildDetailedSessions(limit = if (_state.value.plan == null) 5 else 7)
            }
            val request = PlanFromHealthRequest(
                runs = payloads,
                detailedSessions = detailedSessions.ifEmpty { null },
                weekStartDate = null,
            )

            when (val response = aiPlannerRepository.startGeneration(request)) {
                is AthlyResult.Success -> startGenerationPolling(
                    workoutIdsBefore = workoutIdsBefore,
                    generatedGoalIdsBefore = generatedGoalIdsBefore,
                    generationId = response.data.generationId,
                    intervalSeconds = response.data.pollAfterSeconds,
                )

                is AthlyResult.Failure -> _state.update { it.copy(errorMessage = response.message) }
            }

            _state.update { it.copy(isGenerating = false) }
        }
    }

    private suspend fun buildDetailedSessions(limit: Int) =
        runCatching {
            healthConnectManager.fetchLatestRawRunningSessions(limit).mapNotNull { session ->
                val athlyWorkoutId = linkStore.athlyWorkoutId(session.metadata.id)
                runCatching {
                    healthConnectManager.buildDetailedSession(session, athlyWorkoutId)
                }.getOrNull()
            }
        }.getOrDefault(emptyList())

    private fun startGenerationPolling(
        workoutIdsBefore: Set<String>,
        generatedGoalIdsBefore: Set<String>,
        generationId: String,
        intervalSeconds: Int,
    ) {
        generationPollJob?.cancel()
        _state.update { it.copy(isGeneratingInBackground = true) }
        generationPollJob = viewModelScope.launch {
            pollUntilNewWorkouts(workoutIdsBefore, generatedGoalIdsBefore, generationId, intervalSeconds)
            _state.update { it.copy(isGeneratingInBackground = false) }
        }
    }

    private suspend fun pollUntilNewWorkouts(
        workoutIdsBefore: Set<String>,
        generatedGoalIdsBefore: Set<String>,
        generationId: String,
        intervalSeconds: Int,
    ) {
        val intervalMillis = maxOf(1, intervalSeconds) * 1000L
        while (viewModelScope.isActive) {
            delay(intervalMillis)
            when (val status = aiPlannerRepository.getGenerationStatus(generationId)) {
                is AthlyResult.Success -> if (status.data.status == "failed") {
                    _state.update { it.copy(errorMessage = status.data.error ?: status.data.message) }
                    return
                }
                // notFound (status em memória, pod diferente) / falha transitória → segue pela
                // fonte de verdade persistida: weeklyGoals/workouts recarregados abaixo.
                is AthlyResult.Failure -> Unit
            }

            loadDataInternal()
            val s = _state.value
            val currentIds = s.allWorkouts.map { it.id }.toSet()
            val generatedGoalIds = s.weeklyGoals
                .filter { it.status == WeeklyGoalStatus.GENERATED }
                .map { it.id }
                .toSet()
            if ((currentIds - workoutIdsBefore).isNotEmpty() ||
                (generatedGoalIds - generatedGoalIdsBefore).isNotEmpty()
            ) {
                _state.update { it.copy(selectedWeekIndex = maxOf(0, s.weeks.size - 1)) }
                return
            }
        }
    }

    // MARK: - Complete / Skip

    fun completeWorkout(workout: WorkoutDto) {
        viewModelScope.launch {
            when (val result = workoutRepository.completeWorkout(workout.id)) {
                is AthlyResult.Success -> replaceWorkout(result.data)
                is AthlyResult.Failure -> _state.update { it.copy(errorMessage = result.message) }
            }
        }
    }

    /** Conclui vinculando uma corrida real do Health Connect (link + métricas reais). */
    fun completeWorkoutWithHealthData(workout: WorkoutDto, healthRun: HealthRunItem) {
        viewModelScope.launch {
            linkStore.link(healthConnectId = healthRun.id, athlyWorkoutId = workout.id)
            val result = workoutRepository.completeWorkout(
                workoutId = workout.id,
                healthWorkoutId = healthRun.id,
                actualDistanceMeters = healthRun.distanceMeters,
                actualDurationSeconds = healthRun.durationSeconds,
            )
            when (result) {
                is AthlyResult.Success -> replaceWorkout(result.data)
                is AthlyResult.Failure -> _state.update { it.copy(errorMessage = result.message) }
            }
        }
    }

    fun skipWorkout(workout: WorkoutDto) {
        viewModelScope.launch {
            when (val result = workoutRepository.skipWorkout(workout.id)) {
                is AthlyResult.Success -> replaceWorkout(result.data)
                is AthlyResult.Failure -> _state.update { it.copy(errorMessage = result.message) }
            }
        }
    }

    private suspend fun replaceWorkout(updated: WorkoutDto) {
        _state.update { current ->
            val all = current.allWorkouts.map { if (it.id == updated.id) updated else it }
            current.copy(
                allWorkouts = all,
                todayWorkout = todayWorkout(all),
                weeks = buildWeeks(current.weeklyGoals, all),
            )
        }
        persistToCache()
    }

    // MARK: - Helpers (idênticos ao iOS)

    private fun buildWeeks(goals: List<WeeklyGoalDto>, workouts: List<WorkoutDto>): List<Week> =
        goals.mapIndexed { index, goal ->
            Week(
                id = goal.id,
                number = index + 1,
                weeklyGoal = goal,
                workouts = workouts
                    .filter { it.weeklyGoalId == goal.id }
                    .sortedBy { it.parsedDate },
            )
        }

    private fun currentWeekIndex(weeks: List<Week>): Int {
        val now = Instant.now()
        weeks.forEachIndexed { index, week ->
            val goal = week.weeklyGoal ?: return@forEachIndexed
            // O fim da semana é inclusivo até o fim do dia (weekEndDate costuma vir date-only).
            val end = goal.parsedEndDate.atZone(ZoneId.systemDefault()).toLocalDate()
                .plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant()
            if (now >= goal.parsedStartDate && now < end) return index
        }
        return maxOf(0, weeks.size - 1)
    }

    private fun todayWorkout(workouts: List<WorkoutDto>): WorkoutDto? =
        workouts
            .filter { it.sportType != SportType.OTHER && it.isToday }
            .minByOrNull { it.parsedDate }

    private fun HealthRunItem.toPayload(): HealthRunPayload = HealthRunPayload(
        startDate = isoFractional.format(startDate),
        distanceMeters = distanceMeters,
        durationSeconds = durationSeconds,
        averagePaceSecondsPerKm = averagePaceSecondsPerKm,
        activeEnergyBurned = activeEnergyBurned,
        elevationGainMeters = elevationGainMeters,
    )

    private companion object {
        val isoFractional: DateTimeFormatter =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSXXX").withZone(java.time.ZoneOffset.UTC)
    }
}
