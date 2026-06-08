package com.athly.runner.core.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.athly.runner.core.designsystem.preview.DesignSystemScreen

/**
 * Stub de navegação. A navegação real (gate de auth + bottom nav de 5 abas + FloatingTabBar)
 * é implementada no prompt 05. Por ora o destino inicial mostra a galeria do design system (fatia 01),
 * para validação visual.
 */
@Composable
fun AthlyNavHost() {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = "designSystem") {
        composable("designSystem") {
            DesignSystemScreen()
        }
    }
}
