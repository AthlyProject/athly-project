package com.athly.runner.core.designsystem.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.athly.runner.R

/**
 * Família SpaceGrotesk a partir da **fonte variável** `res/font/spacegrotesk_variable.ttf`
 * (baixada de google/fonts, OFL). O SpaceGrotesk não distribui um SemiBold estático, então usamos
 * a variável: `Font(resId, weight)` aplica o eixo `wght` automaticamente (minSdk 26 suporta),
 * dando os pesos exatos 400/500/600/700.
 */
val SpaceGrotesk = FontFamily(
    Font(R.font.spacegrotesk_variable, FontWeight.Normal),
    Font(R.font.spacegrotesk_variable, FontWeight.Medium),
    Font(R.font.spacegrotesk_variable, FontWeight.SemiBold),
    Font(R.font.spacegrotesk_variable, FontWeight.Bold),
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
