package com.athly.runner.core.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * Abas do app — espelha `AppTab` do iOS (títulos pt-BR idênticos: Home/Plan/Run/History/Profile).
 * Ícones Material equivalentes aos SF Symbols; o Run é destacado (maior) na barra.
 */
enum class AppTab(
    val route: String,
    val title: String,
    val icon: ImageVector,
    val isRun: Boolean = false,
) {
    DASHBOARD("dashboard", "Home", Icons.Filled.Home),
    PLAN("plan", "Plan", Icons.Filled.CalendarMonth),
    RUN("run", "Run", Icons.AutoMirrored.Filled.DirectionsRun, isRun = true),
    HISTORY("history", "History", Icons.Filled.History),
    PROFILE("profile", "Profile", Icons.Filled.Person),
}
