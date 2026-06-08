package com.athly.runner.core.designsystem.component

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.unit.dp
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlyGradient
import com.athly.runner.core.designsystem.theme.AthlyRadius

/**
 * Espelha o `AthlyCardModifier` do iOS: base surfaceCard + overlay gradiente, borda gradiente e
 * sombra ciano. `glow=true` usa borda neon mais grossa e sombra mais forte.
 * Obs.: a sombra colorida (`spotColor`/`ambientColor`) só é respeitada a partir do API 28; em 26/27
 * cai numa sombra neutra (degrade aceitável). O conteúdo provê o próprio padding (como no iOS).
 */
fun Modifier.athlyCard(glow: Boolean = false): Modifier = this
    .shadow(
        elevation = if (glow) 15.dp else 12.dp,
        shape = AthlyRadius.cardShape,
        clip = false,
        spotColor = AthlyColor.primary.copy(alpha = if (glow) 0.30f else 0.18f),
        ambientColor = AthlyColor.primary.copy(alpha = if (glow) 0.30f else 0.18f),
    )
    .clip(AthlyRadius.cardShape)
    .background(AthlyColor.surfaceCard)
    .background(AthlyGradient.cardOverlay)
    .border(
        width = if (glow) 1.5.dp else 1.dp,
        brush = if (glow) AthlyGradient.neon else AthlyGradient.gradientBorder,
        shape = AthlyRadius.cardShape,
    )

/** Espelha o `AthlyInsightCardModifier` do iOS (cards de IA/destaque). */
fun Modifier.athlyInsightCard(): Modifier = this
    .shadow(
        elevation = 18.dp,
        shape = AthlyRadius.cardShape,
        clip = false,
        spotColor = AthlyColor.primary.copy(alpha = 0.35f),
        ambientColor = AthlyColor.primary.copy(alpha = 0.35f),
    )
    .clip(AthlyRadius.cardShape)
    .background(AthlyColor.surfaceCard)
    .background(AthlyGradient.insightBackground)
    .border(
        width = 1.5.dp,
        brush = AthlyGradient.gradientBorder,
        shape = AthlyRadius.cardShape,
    )
