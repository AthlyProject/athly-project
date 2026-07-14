package com.athly.runner.core.designsystem.component

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athly.runner.core.designsystem.theme.AthlyGradient
import com.athly.runner.core.designsystem.theme.SpaceGrotesk
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign

/**
 * Logo do Athly — quadrado arredondado com o gradiente brand e o monograma "A".
 * Placeholder do asset `AthlyLogo` do iOS (substituir por um drawable real quando disponível).
 */
@Composable
fun AthlyLogo(
    size: Dp,
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 22.dp,
) {
    Box(
        modifier = modifier
            .size(size)
            .clip(RoundedCornerShape(cornerRadius))
            .background(AthlyGradient.brand),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "A",
            color = Color.White,
            textAlign = TextAlign.Center,
            fontFamily = SpaceGrotesk,
            fontWeight = FontWeight.Bold,
            fontSize = (size.value * 0.5f).sp,
        )
    }
}
