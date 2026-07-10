package com.athly.runner.feature.paywall.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.athly.runner.core.designsystem.component.AthlyGradientButton
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlyGradient
import com.athly.runner.core.designsystem.theme.AthlyType
import com.athly.runner.feature.paywall.PaywallViewModel

private val features = listOf(
    "Planos de corrida personalizados por IA",
    "Replanejamento semanal adaptativo",
    "Análise de evolução e zonas de esforço",
    "Blocos de treino com contagem em tempo real",
)

/**
 * Paywall "Athly Premium" — espelha `PaywallView.swift`. Cosmético enquanto
 * `FeatureFlags.PAYWALL_ENABLED == false` (o gating real é server-side).
 */
@Composable
fun PaywallScreen(
    onDismiss: () -> Unit,
    viewModel: PaywallViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(AthlyColor.backgroundDark)
            .systemBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp)
            .padding(bottom = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.size(40.dp))

        Box(
            modifier = Modifier
                .size(72.dp)
                .clip(CircleShape)
                .background(AthlyGradient.brand),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.WorkspacePremium, null, tint = Color.White, modifier = Modifier.size(36.dp))
        }

        Spacer(Modifier.size(20.dp))
        Text("Athly Premium", style = AthlyType.heading(26), color = AthlyColor.textPrimary)
        Spacer(Modifier.size(8.dp))
        Text(
            "7 dias grátis, depois assinatura. Cancele quando quiser.",
            style = AthlyType.body(15),
            color = AthlyColor.textSecondary,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.size(28.dp))
        Column(verticalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.fillMaxWidth()) {
            features.forEach { feature ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(Icons.Filled.CheckCircle, null, tint = AthlyColor.primary, modifier = Modifier.size(18.dp))
                    Text(feature, style = AthlyType.body(15), color = AthlyColor.textPrimary)
                }
            }
        }

        Spacer(Modifier.size(32.dp))

        state.errorMessage?.let { error ->
            Text(
                error,
                style = AthlyType.body(13),
                color = AthlyColor.error,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(bottom = 12.dp),
            )
        }

        AthlyGradientButton(
            text = if (state.isWorking) "Processando..." else "Começar teste grátis",
            onClick = viewModel::subscribe,
            enabled = !state.isWorking,
            modifier = Modifier.fillMaxWidth(),
        )
        TextButton(onClick = viewModel::restore, enabled = !state.isWorking) {
            Text("Restaurar compras", style = AthlyType.body(15), color = AthlyColor.primary)
        }
        TextButton(onClick = onDismiss) {
            Text("Agora não", style = AthlyType.body(15), color = AthlyColor.textSecondary)
        }

        Spacer(Modifier.size(16.dp))
        Text(
            "A assinatura renova automaticamente. O período de teste e a validação de acesso são gerenciados pela sua conta.",
            style = AthlyType.body(11),
            color = AthlyColor.textTertiary,
            textAlign = TextAlign.Center,
        )
    }
}
