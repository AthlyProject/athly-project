package com.athly.runner.core.designsystem.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.dp

/** Espelha `AthlyTheme.Spacing` do iOS. */
object AthlySpacing {
    val sm = 16.dp
    val md = 24.dp
    val lg = 32.dp
}

/** Espelha `AthlyTheme.Radius` do iOS (+ shapes prontos). */
object AthlyRadius {
    val card = 24.dp
    val button = 16.dp
    val small = 12.dp

    val cardShape = RoundedCornerShape(card)
    val buttonShape = RoundedCornerShape(button)
    val smallShape = RoundedCornerShape(small)
}
