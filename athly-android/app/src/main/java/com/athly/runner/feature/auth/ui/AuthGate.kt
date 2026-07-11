package com.athly.runner.feature.auth.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.feature.auth.AuthViewModel
import kotlinx.coroutines.delay

private const val MINIMUM_SPLASH_MS = 850L

/**
 * Raiz de auth — espelha `RootView` do iOS. Mostra o splash por `max(850ms, até a restauração de sessão
 * concluir)` e, por baixo (opacity 0 enquanto o splash está visível), o [authenticatedContent] (quando logado)
 * ou o Login. O registro é um overlay full-screen (equivalente ao `.sheet`). O [AuthViewModel] (escopo da
 * Activity) é passado ao conteúdo autenticado para que logout/deleteAccount voltem ao Login.
 */
@Composable
fun AuthGate(
    modifier: Modifier = Modifier,
    viewModel: AuthViewModel = hiltViewModel(),
    authenticatedContent: @Composable (authViewModel: AuthViewModel) -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    var hasMetMinimumSplashTime by rememberSaveable { mutableStateOf(false) }
    var showRegister by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        delay(MINIMUM_SPLASH_MS)
        hasMetMinimumSplashTime = true
    }

    // Fecha o registro assim que autentica (espelha o dismiss do sheet no iOS).
    LaunchedEffect(state.isAuthenticated) {
        if (state.isAuthenticated) showRegister = false
    }

    // Só some quando AMBAS as condições são verdadeiras (dismissLaunchSplashIfReady do iOS).
    val showSplash = !(hasMetMinimumSplashTime && state.hasFinishedInitialSessionRestore)
    val contentAlpha by animateFloatAsState(
        targetValue = if (showSplash) 0f else 1f,
        animationSpec = tween(300),
        label = "contentAlpha",
    )

    Box(modifier = modifier.fillMaxSize().background(AthlyColor.backgroundDark)) {
        Box(Modifier.fillMaxSize().alpha(contentAlpha)) {
            if (state.isAuthenticated) {
                authenticatedContent(viewModel)
            } else {
                LoginScreen(
                    isLoading = state.isLoading,
                    errorMessage = state.errorMessage,
                    onLogin = viewModel::login,
                    onShowRegister = {
                        viewModel.clearError()
                        showRegister = true
                    },
                )
            }
        }

        AnimatedVisibility(
            visible = showRegister && !state.isAuthenticated,
            enter = fadeIn(),
            exit = fadeOut(),
        ) {
            RegisterScreen(
                isLoading = state.isLoading,
                errorMessage = state.errorMessage,
                onRegister = { name, userName, email, password, confirmPassword, dateOfBirth, weight, height ->
                    viewModel.register(
                        email = email,
                        userName = userName,
                        name = name,
                        password = password,
                        confirmPassword = confirmPassword,
                        dateOfBirth = dateOfBirth,
                        weight = weight,
                        height = height,
                    )
                },
                onCancel = {
                    viewModel.clearError()
                    showRegister = false
                },
            )
        }

        AnimatedVisibility(visible = showSplash, enter = fadeIn(), exit = fadeOut(tween(300))) {
            LaunchSplashScreen()
        }
    }
}
