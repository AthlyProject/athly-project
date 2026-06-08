package com.athly.runner.core.designsystem.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.athly.runner.R

/**
 * Família SpaceGrotesk. **Requer os 4 .ttf em `res/font/`** (passo manual):
 * baixe de https://fonts.google.com/specimen/Space+Grotesk e salve como
 * `spacegrotesk_regular.ttf`, `spacegrotesk_medium.ttf`, `spacegrotesk_semibold.ttf`, `spacegrotesk_bold.ttf`.
 * (Sem eles o build não resolve `R.font.spacegrotesk_*`.)
 */
val SpaceGrotesk = FontFamily(
    Font(R.font.spacegrotesk_regular, FontWeight.Normal),
    Font(R.font.spacegrotesk_medium, FontWeight.Medium),
    Font(R.font.spacegrotesk_semibold, FontWeight.SemiBold),
    Font(R.font.spacegrotesk_bold, FontWeight.Bold),
)

/** Helpers parametrizados por tamanho — espelham `AthlyTheme.Typography` do iOS. */
object AthlyType {
    fun heading(size: Int) = TextStyle(fontFamily = SpaceGrotesk, fontWeight = FontWeight.Bold, fontSize = size.sp)
    fun semibold(size: Int) = TextStyle(fontFamily = SpaceGrotesk, fontWeight = FontWeight.SemiBold, fontSize = size.sp)
    fun medium(size: Int) = TextStyle(fontFamily = SpaceGrotesk, fontWeight = FontWeight.Medium, fontSize = size.sp)
    fun body(size: Int = 16) = TextStyle(fontFamily = SpaceGrotesk, fontWeight = FontWeight.Normal, fontSize = size.sp)
    val label = TextStyle(fontFamily = SpaceGrotesk, fontWeight = FontWeight.SemiBold, fontSize = 11.sp)
}

/** Typography base do Material3 (Text padrão usa SpaceGrotesk). */
val AthlyTypography = Typography(
    bodyLarge = AthlyType.body(16),
    bodyMedium = AthlyType.body(14),
    titleLarge = AthlyType.heading(22),
    titleMedium = AthlyType.semibold(17),
    labelSmall = AthlyType.label,
)
