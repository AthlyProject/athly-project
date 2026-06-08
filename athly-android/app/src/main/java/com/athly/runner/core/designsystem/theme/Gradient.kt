package com.athly.runner.core.designsystem.theme

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

/**
 * Gradientes — espelham `AthlyTheme.Gradient` do iOS. Todos diagonais (topLeading→bottomTrailing):
 * no Compose isso exige `start = Offset.Zero, end = Offset.Infinite` (o default é horizontal).
 */
object AthlyGradient {
    private fun diagonal(vararg colors: Color): Brush =
        Brush.linearGradient(colors.toList(), start = Offset.Zero, end = Offset.Infinite)

    val brand = diagonal(AthlyColor.primary, AthlyColor.secondary)
    val neon = diagonal(AthlyColor.primaryNeon, AthlyColor.secondaryNeon)
    val cardBackground = diagonal(AthlyColor.surfaceCard, AthlyColor.surfaceDark)
    val gradientBorder = diagonal(
        AthlyColor.primary.copy(alpha = 0.30f),
        AthlyColor.secondary.copy(alpha = 0.30f),
    )
    val insightBackground = diagonal(
        AthlyColor.primary.copy(alpha = 0.20f),
        AthlyColor.backgroundDark,
        AthlyColor.accent.copy(alpha = 0.20f),
    )

    /** Overlay do AthlyCard sobre o surfaceCard (cyan 12% → purple 4%). */
    val cardOverlay = diagonal(
        AthlyColor.primary.copy(alpha = 0.12f),
        AthlyColor.secondary.copy(alpha = 0.04f),
    )
}
