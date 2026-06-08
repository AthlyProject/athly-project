package com.athly.runner.core.designsystem.component

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlyGradient
import com.athly.runner.core.designsystem.theme.AthlyRadius
import com.athly.runner.core.designsystem.theme.AthlyType

/**
 * Botões espelhando `ButtonStyles.swift`. O Compose não tem `ButtonStyle`, então usamos Composables
 * com `interactionSource` próprio (sem ripple Material) e animação de `scale` no press (0.97, easeOut 150ms).
 */
private const val PRESS_SCALE = 0.97f
private val ButtonPadding = 16.dp

@Composable
private fun rememberPressState(): Pair<MutableInteractionSource, Boolean> {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    return interaction to pressed
}

@Composable
private fun AthlyButtonBox(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier,
    enabled: Boolean,
    textColor: Color,
    decorate: Modifier.(pressed: Boolean) -> Modifier,
) {
    val (interaction, pressed) = rememberPressState()
    val scale by animateFloatAsState(if (pressed) PRESS_SCALE else 1f, tween(150), label = "btnScale")
    Box(
        modifier = modifier
            .fillMaxWidth()
            .graphicsLayer { scaleX = scale; scaleY = scale }
            .decorate(pressed)
            .clickable(interactionSource = interaction, indication = null, enabled = enabled, onClick = onClick)
            .padding(ButtonPadding),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = text, style = AthlyType.semibold(16), color = textColor, textAlign = TextAlign.Center)
    }
}

@Composable
fun AthlyPrimaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    AthlyButtonBox(text, onClick, modifier, enabled, Color.White) { pressed ->
        clip(AthlyRadius.buttonShape)
            .background(AthlyColor.primary.copy(alpha = if (pressed) 0.8f else 1f))
    }
}

@Composable
fun AthlyGradientButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    AthlyButtonBox(text, onClick, modifier, enabled, Color.White) { pressed ->
        shadow(
            elevation = 12.dp,
            shape = AthlyRadius.buttonShape,
            clip = false,
            spotColor = AthlyColor.primary.copy(alpha = if (pressed) 0.2f else 0.5f),
            ambientColor = AthlyColor.primary.copy(alpha = if (pressed) 0.2f else 0.5f),
        )
            .clip(AthlyRadius.buttonShape)
            .background(AthlyGradient.brand)
    }
}

@Composable
fun AthlySecondaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    AthlyButtonBox(text, onClick, modifier, enabled, AthlyColor.textPrimary) { pressed ->
        alpha(if (pressed) 0.8f else 1f)
            .clip(AthlyRadius.buttonShape)
            .background(AthlyColor.surfaceCard)
            .border(1.dp, AthlyGradient.gradientBorder, AthlyRadius.buttonShape)
    }
}

@Composable
fun AthlyDangerButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    AthlyButtonBox(text, onClick, modifier, enabled, Color.White) { pressed ->
        clip(AthlyRadius.buttonShape)
            .background(AthlyColor.error.copy(alpha = if (pressed) 0.8f else 1f))
    }
}
