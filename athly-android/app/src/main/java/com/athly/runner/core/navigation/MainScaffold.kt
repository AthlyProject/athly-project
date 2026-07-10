package com.athly.runner.core.navigation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.athly.runner.core.designsystem.component.FloatingTabBar
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.feature.auth.AuthViewModel
import com.athly.runner.feature.dashboard.ui.DashboardScreen
import com.athly.runner.feature.history.ui.HistoryScreen
import com.athly.runner.feature.plan.ui.PlanScreen
import com.athly.runner.feature.profile.ui.ProfileScreen
import com.athly.runner.feature.run.ui.RunRoute

/**
 * Host do grafo principal — espelha `MainTabView` do iOS. `Scaffold` com um `NavHost` interno (5 abas,
 * telas placeholder por ora) e a [FloatingTabBar] como bottomBar que **anima sumindo** quando há uma
 * corrida em andamento ([RunUiState]). O logout (via [AuthViewModel]) volta ao grafo de auth no [AuthGate].
 */
@Composable
fun MainScaffold(
    authViewModel: AuthViewModel,
    modifier: Modifier = Modifier,
    shellViewModel: ShellViewModel = hiltViewModel(),
) {
    val navController = rememberNavController()
    val isRunInProgress by shellViewModel.isRunInProgress.collectAsStateWithLifecycle()

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val selectedTab = AppTab.entries.firstOrNull { it.route == currentRoute } ?: AppTab.DASHBOARD

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = AthlyColor.backgroundDark,
        bottomBar = {
            AnimatedVisibility(
                visible = !isRunInProgress,
                enter = slideInVertically { it } + fadeIn(),
                exit = slideOutVertically { it } + fadeOut(),
            ) {
                FloatingTabBar(
                    selected = selectedTab,
                    onSelect = navController::navigateToTab,
                    modifier = Modifier.navigationBarsPadding().padding(bottom = 8.dp),
                )
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = AppTab.DASHBOARD.route,
            modifier = Modifier.fillMaxSize().padding(innerPadding),
        ) {
            composable(AppTab.DASHBOARD.route) {
                DashboardScreen(onNavigateToRun = { navController.navigateToTab(AppTab.RUN) })
            }
            composable(AppTab.PLAN.route) { PlanScreen() }
            composable(AppTab.RUN.route) { RunRoute() }
            composable(AppTab.HISTORY.route) { HistoryScreen() }
            composable(AppTab.PROFILE.route) {
                ProfileScreen(
                    onLogout = authViewModel::logout,
                    onDeleteAccount = authViewModel::deleteAccount,
                    onOpenHistory = { navController.navigateToTab(AppTab.HISTORY) },
                )
            }
        }
    }
}

/** Navegação padrão de bottom nav: single-top, preserva/reidrata estado das abas, sem empilhar. */
private fun NavController.navigateToTab(tab: AppTab) {
    navigate(tab.route) {
        popUpTo(graph.findStartDestination().id) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}
