package com.athly.runner.feature.auth.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import com.athly.runner.core.designsystem.component.AthlyLogo

/**
 * Splash de abertura — espelha `LaunchSplashView` do iOS: radial gradient + logo 112 com fade/scale-in
 * (opacity 0→1, scale 0.88→1, easeOut ~0.45s). O tempo mínimo e a dispensa ficam no [AuthGate].
 */
@Composable
fun LaunchSplashScreen(modifier: Modifier = Modifier) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { visible = true }

    val alpha by animateFloatAsState(if (visible) 1f else 0f, tween(450), label = "splashAlpha")
    val scale by animateFloatAsState(if (visible) 1f else 0.88f, tween(450), label = "splashScale")

    Box(
        modifier = modifier
            .fillMaxSize()
            .athlyAuthBackground(),
        contentAlignment = Alignment.Center,
    ) {
        AthlyLogo(
            size = 112.dp,
            cornerRadius = 24.dp,
            modifier = Modifier.graphicsLayer {
                this.alpha = alpha
                scaleX = scale
                scaleY = scale
            },
        )
    }
}
