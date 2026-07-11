package com.athly.runner.feature.common

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.data.remote.dto.PreviousWeekAnalysisDto
import com.athly.runner.data.remote.dto.RunAnalysisDto
import com.athly.runner.data.remote.dto.SportType
import com.athly.runner.data.remote.dto.WeeklyGoalDto
import com.athly.runner.data.remote.dto.WeeklyGoalMetricsDto
import com.athly.runner.data.remote.dto.WeeklyGoalStatus
import com.athly.runner.data.remote.dto.WorkoutDto
import com.athly.runner.data.remote.dto.WorkoutStatus

private val previewWorkout = WorkoutDto(
    id = "w1",
    date = "2026-07-10",
    sportType = SportType.RUNNING,
    title = "Tiros 6x400m",
    description = "Aquecimento de 10 min, 6 tiros de 400m com recuperação de 200m, desaceleração.",
    status = WorkoutStatus.SCHEDULED,
    trainingPlanId = "plan1",
    weeklyGoalId = "goal1",
    intensity = 7.0,
    isGoalAttempt = true,
)

private val previewGoal = WeeklyGoalDto(
    id = "goal1",
    trainingPlanId = "plan1",
    weekStartDate = "2026-07-06",
    weekEndDate = "2026-07-12",
    status = WeeklyGoalStatus.GENERATED,
    metrics = WeeklyGoalMetricsDto(
        title = "Base aeróbica",
        trend = "improving (volume)",
        fitnessInsights = "Seu volume vem crescendo de forma consistente. Esta semana o foco é consolidar a base.",
        avgPace = "5:45",
        totalDistanceKm = 28.5,
        runsAnalyzed = 6,
    ),
    previousWeekAnalysis = PreviousWeekAnalysisDto(
        completedWorkouts = 3,
        totalWorkouts = 4,
        completionRate = 0.75,
        totalDistanceKm = 24.2,
        volumeChange = "increase",
    ),
)

private val previewAnalysis = RunAnalysisDto(
    title = "Análise",
    runsAnalyzed = 8,
    period = "4 semanas",
    avgDistanceKm = 6.4,
    avgPace = "5:52",
    avgHeartRate = 156.0,
    totalDistanceKm = 51.2,
    trend = "improving (volume)",
    fitnessInsights = "Boa consistência nas últimas semanas, com pace estável e volume em leve alta.",
)

@Preview(showBackground = true, backgroundColor = 0xFF07090D)
@Composable
private fun WorkoutCardPreview() {
    Column(
        Modifier.background(AthlyColor.backgroundDark).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        WorkoutCard(previewWorkout, isNext = true)
        WorkoutCard(previewWorkout.copy(isGoalAttempt = false, status = WorkoutStatus.DONE), compact = true)
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF07090D)
@Composable
private fun BadgesPreview() {
    Column(
        Modifier.background(AthlyColor.backgroundDark).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SportBadge(SportType.RUNNING)
            SportBadge(SportType.CYCLING)
            SportBadge(SportType.YOGA)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StatusBadge(WorkoutStatus.DONE)
            StatusBadge(WorkoutStatus.SCHEDULED)
            StatusBadge(WorkoutStatus.PARTIAL)
            StatusBadge(WorkoutStatus.SKIPPED)
        }
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF07090D)
@Composable
private fun InsightCardsPreview() {
    Column(
        Modifier.background(AthlyColor.backgroundDark).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        WeeklyGoalInsightCard(previewGoal)
        AnalysisSummaryCard(
            analysis = previewAnalysis,
            previousWeekAnalysis = previewGoal.previousWeekAnalysis,
            isInteractive = true,
        )
    }
}
