package com.athly.runner.core.designsystem.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

// Dark forçado (o app não tem tema claro). Mapeia os tokens AthlyColor para o ColorScheme do Material3.
private val AthlyDarkColors = darkColorScheme(
    primary = AthlyColor.primary,
    onPrimary = AthlyColor.textPrimary,
    secondary = AthlyColor.secondary,
    onSecondary = AthlyColor.textPrimary,
    tertiary = AthlyColor.accent,
    onTertiary = AthlyColor.textPrimary,
    background = AthlyColor.backgroundDark,
    onBackground = AthlyColor.textPrimary,
    surface = AthlyColor.surfaceCard,
    onSurface = AthlyColor.textPrimary,
    surfaceVariant = AthlyColor.surfaceDark,
    onSurfaceVariant = AthlyColor.textSecondary,
    error = AthlyColor.error,
    onError = AthlyColor.textPrimary,
    outline = AthlyColor.glassBorder,
)

@Composable
fun AthlyTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = AthlyDarkColors,
        typography = AthlyTypography,
        content = content,
    )
}
