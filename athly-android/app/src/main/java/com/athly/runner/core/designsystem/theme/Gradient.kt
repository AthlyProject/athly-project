package com.athly.runner.core.designsystem.theme

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

/**
 * Gradientes — espelham `AthlyTheme.Gradient` do iOS. Todos diagonais (topLeading→bottomTrailing):
 * no Compose isso exige `start = Offset.Zero, end = Offset.Infinite` (o default é horizontal).
 */
object AthlyGradient {
    // `vararg Color` é proibido (Color é um inline value class); usamos List<Color>.
    private fun diagonal(colors: List<Color>): Brush =
        Brush.linearGradient(colors, start = Offset.Zero, end = Offset.Infinite)

    val brand = diagonal(listOf(AthlyColor.primary, AthlyColor.secondary))
    val neon = diagonal(listOf(AthlyColor.primaryNeon, AthlyColor.secondaryNeon))
    val cardBackground = diagonal(listOf(AthlyColor.surfaceCard, AthlyColor.surfaceDark))
    val gradientBorder = diagonal(
        listOf(
            AthlyColor.primary.copy(alpha = 0.30f),
            AthlyColor.secondary.copy(alpha = 0.30f),
        ),
    )
    val insightBackground = diagonal(
        listOf(
            AthlyColor.primary.copy(alpha = 0.20f),
            AthlyColor.backgroundDark,
            AthlyColor.accent.copy(alpha = 0.20f),
        ),
    )

    /** Overlay do AthlyCard sobre o surfaceCard (cyan 12% → purple 4%). */
    val cardOverlay = diagonal(
        listOf(
            AthlyColor.primary.copy(alpha = 0.12f),
            AthlyColor.secondary.copy(alpha = 0.04f),
        ),
    )
}
