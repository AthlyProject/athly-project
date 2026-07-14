package com.athly.runner.core.navigation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.athly.runner.core.designsystem.component.AthlyGradientButton
import com.athly.runner.core.designsystem.component.AthlySecondaryButton
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlySpacing
import com.athly.runner.core.designsystem.theme.AthlyType

/**
 * Placeholders das 5 abas — substituídos pelas telas reais (prompts 08+, 13, 15, 19, 20).
 * As ROTAS ([AppTab.route]) são estáveis; os prompts futuros só trocam o conteúdo, sem renomear.
 */
@Composable
fun TabPlaceholderScreen(
    title: String,
    subtitle: String = "Em breve.",
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxSize().padding(AthlySpacing.md),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(text = title, style = AthlyType.heading(24), color = AthlyColor.textPrimary)
        Spacer(Modifier.height(8.dp))
        Text(
            text = subtitle,
            style = AthlyType.body(14),
            color = AthlyColor.textTertiary,
            textAlign = TextAlign.Center,
        )
    }
}

/** Placeholder do Run — alterna o flag global para validar o esconde/mostra da FloatingTabBar. */
@Composable
fun RunPlaceholderScreen(
    modifier: Modifier = Modifier,
    shellViewModel: ShellViewModel = hiltViewModel(),
) {
    val isRunInProgress by shellViewModel.isRunInProgress.collectAsStateWithLifecycle()
    Column(
        modifier = modifier.fillMaxSize().padding(AthlySpacing.md),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(text = "Run", style = AthlyType.heading(24), color = AthlyColor.textPrimary)
        Spacer(Modifier.height(8.dp))
        Text(
            text = if (isRunInProgress) "Corrida em andamento — barra escondida." else "A tela de corrida chega na fatia 08.",
            style = AthlyType.body(14),
            color = AthlyColor.textTertiary,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(AthlySpacing.lg))
        AthlyGradientButton(
            text = if (isRunInProgress) "Encerrar corrida (simulação)" else "Simular corrida",
            onClick = { shellViewModel.setRunInProgress(!isRunInProgress) },
        )
    }
}

/** Placeholder do Profile — inclui logout (volta ao grafo de auth). */
@Composable
fun ProfilePlaceholderScreen(
    onLogout: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxSize().padding(AthlySpacing.md),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(text = "Profile", style = AthlyType.heading(24), color = AthlyColor.textPrimary)
        Spacer(Modifier.height(8.dp))
        Text(
            text = "Perfil e settings chegam na fatia 20.",
            style = AthlyType.body(14),
            color = AthlyColor.textTertiary,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(AthlySpacing.lg))
        AthlySecondaryButton(text = "Sair", onClick = onLogout)
    }
}
