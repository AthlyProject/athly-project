package com.athly.runner.feature.auth.ui

import androidx.compose.foundation.background
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import com.athly.runner.core.designsystem.theme.AthlyColor

/**
 * Fundo das telas de auth/splash — espelha o `RadialGradient(center: .top, primary 12% → backgroundDark)`
 * do iOS (LoginView/LaunchSplashView). Radial centrado no topo, sobre o backgroundDark.
 */
fun Modifier.athlyAuthBackground(): Modifier = this
    .background(AthlyColor.backgroundDark)
    .drawWithCache {
        val brush = Brush.radialGradient(
            colors = listOf(AthlyColor.primary.copy(alpha = 0.12f), AthlyColor.backgroundDark),
            center = Offset(size.width / 2f, 0f),
            radius = size.maxDimension * 0.9f,
        )
        onDrawBehind { drawRect(brush) }
    }
