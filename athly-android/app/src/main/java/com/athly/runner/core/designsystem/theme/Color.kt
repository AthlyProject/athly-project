package com.athly.runner.core.designsystem.theme

import androidx.compose.ui.graphics.Color

/** Tokens de cor — espelham 1:1 o `AthlyTheme.Color` do iOS (Utils/Theme.swift). */
object AthlyColor {
    // Brand
    val primary = Color(0xFF06B6D4)
    val primaryNeon = Color(0xFF00D4FF)
    val secondary = Color(0xFF9D25F4)
    val secondaryNeon = Color(0xFFBF40FF)
    val accent = Color(0xFFF472B6)

    // Backgrounds / surfaces
    val backgroundDark = Color(0xFF0A0A10)
    val surfaceDark = Color(0xFF0D1117)
    val surfaceCard = Color(0xFF141820)

    // Borders / glass
    val borderDark = Color.White.copy(alpha = 0.10f)
    val glassBackground = primary.copy(alpha = 0.05f)
    val glassBorder = Color.White.copy(alpha = 0.10f)

    // Text
    val textPrimary = Color(0xFFF9FAFB)
    val textSecondary = Color(0xFFD1D5DB)
    val textTertiary = Color(0xFF9CA3AF)

    // Semantic
    val success = Color(0xFF10B981)
    val warning = Color(0xFFF59E0B)
    val error = Color(0xFFEF4444)
}
