package com.athly.runner.feature.common

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsBike
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.automirrored.filled.DirectionsWalk
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Pool
import androidx.compose.material.icons.filled.SelfImprovement
import androidx.compose.material.icons.filled.SportsGymnastics
import androidx.compose.material.icons.filled.SportsScore
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlyType
import com.athly.runner.data.remote.dto.SportType
import com.athly.runner.data.remote.dto.WorkoutStatus

/** Label pt-BR do esporte — reusa o enum de domínio (03), que espelha `sport.label` do iOS. */
val SportType.label: String
    get() = com.athly.runner.domain.model.SportType.valueOf(name).label

/** Ícone Material equivalente ao `sfSymbol` do iOS por esporte. */
val SportType.icon: ImageVector
    get() = when (this) {
        SportType.RUNNING -> Icons.AutoMirrored.Filled.DirectionsRun
        SportType.CYCLING -> Icons.AutoMirrored.Filled.DirectionsBike
        SportType.SWIMMING -> Icons.Filled.Pool
        SportType.STRENGTH -> Icons.Filled.FitnessCenter
        SportType.CROSSFIT -> Icons.Filled.SportsGymnastics
        SportType.TRIATHLON -> Icons.Filled.EmojiEvents
        SportType.DUATHLON -> Icons.Filled.SportsScore
        SportType.YOGA -> Icons.Filled.SelfImprovement
        SportType.WALKING -> Icons.AutoMirrored.Filled.DirectionsWalk
        SportType.OTHER -> Icons.Filled.EmojiEvents
    }

/** Cápsula glass ícone+label do esporte — espelha `SportBadgeView`. */
@Composable
fun SportBadge(sport: SportType, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .clip(CircleShape)
            .background(AthlyColor.glassBackground)
            .border(1.dp, AthlyColor.primary.copy(alpha = 0.3f), CircleShape)
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(
            imageVector = sport.icon,
            contentDescription = null,
            tint = AthlyColor.primary,
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .background(AthlyColor.primary.copy(alpha = 0.1f))
                .padding(3.dp)
                .size(12.dp),
        )
        Text(sport.label, style = AthlyType.medium(12), color = AthlyColor.primary)
    }
}

/** Label/cor pt-BR do status — espelha `StatusBadgeView` (Concluído/Agendado/Parcial/Pulado). */
val WorkoutStatus.label: String
    get() = when (this) {
        WorkoutStatus.DONE -> "Concluído"
        WorkoutStatus.SCHEDULED -> "Agendado"
        WorkoutStatus.PARTIAL -> "Parcial"
        WorkoutStatus.SKIPPED -> "Pulado"
    }

val WorkoutStatus.color: Color
    get() = when (this) {
        WorkoutStatus.DONE -> AthlyColor.success
        WorkoutStatus.SCHEDULED -> AthlyColor.primary
        WorkoutStatus.PARTIAL -> AthlyColor.warning
        WorkoutStatus.SKIPPED -> AthlyColor.error
    }

@Composable
fun StatusBadge(status: WorkoutStatus, modifier: Modifier = Modifier) {
    Text(
        text = status.label.uppercase(),
        style = AthlyType.label,
        color = status.color,
        modifier = modifier
            .clip(CircleShape)
            .background(status.color.copy(alpha = 0.15f))
            .border(1.dp, status.color.copy(alpha = 0.4f), CircleShape)
            .padding(horizontal = 8.dp, vertical = 3.dp),
    )
}
