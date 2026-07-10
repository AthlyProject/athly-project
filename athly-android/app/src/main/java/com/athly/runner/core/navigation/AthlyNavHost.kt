package com.athly.runner.core.navigation

import androidx.compose.runtime.Composable
import com.athly.runner.feature.auth.ui.AuthGate

/**
 * Raiz de navegação do app — espelha `RootView`/`MainTabView` do iOS.
 * O [AuthGate] cuida do splash e do gate de sessão (deslogado → login/registro); autenticado →
 * [MainScaffold] com a bottom nav de 5 abas. Trocar de estado de auth troca o conteúdo raiz
 * (back stack limpo por construção — não é um push de tela).
 */
@Composable
fun AthlyNavHost() {
    AuthGate { authViewModel ->
        MainScaffold(authViewModel = authViewModel)
    }
}
