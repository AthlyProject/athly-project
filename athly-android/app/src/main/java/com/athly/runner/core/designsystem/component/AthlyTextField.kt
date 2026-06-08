package com.athly.runner.core.designsystem.component

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlyRadius
import com.athly.runner.core.designsystem.theme.AthlyType

/**
 * Campo de texto espelhando `AthlyTextFieldStyle` do iOS: fundo surfaceCard, radius 12, borda
 * primary 1.5.dp quando focado / glassBorder 1.dp normal, cursor primary.
 */
@Composable
fun AthlyTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    singleLine: Boolean = true,
    isPassword: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()

    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier.fillMaxWidth(),
        textStyle = AthlyType.body().copy(color = AthlyColor.textPrimary),
        singleLine = singleLine,
        cursorBrush = SolidColor(AthlyColor.primary),
        interactionSource = interaction,
        visualTransformation = if (isPassword) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = if (isPassword) KeyboardType.Password else keyboardType),
        decorationBox = { innerTextField ->
            Box(
                modifier = Modifier
                    .clip(AthlyRadius.smallShape)
                    .background(AthlyColor.surfaceCard)
                    .border(
                        width = if (focused) 1.5.dp else 1.dp,
                        color = if (focused) AthlyColor.primary else AthlyColor.glassBorder,
                        shape = AthlyRadius.smallShape,
                    )
                    .padding(horizontal = 16.dp, vertical = 14.dp),
            ) {
                if (value.isEmpty() && placeholder != null) {
                    Text(text = placeholder, style = AthlyType.body(), color = AthlyColor.textTertiary)
                }
                innerTextField()
            }
        },
    )
}
