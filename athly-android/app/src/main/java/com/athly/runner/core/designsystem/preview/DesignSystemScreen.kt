package com.athly.runner.core.designsystem.preview

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.athly.runner.core.designsystem.component.AthlyDangerButton
import com.athly.runner.core.designsystem.component.AthlyGradientButton
import com.athly.runner.core.designsystem.component.AthlyPrimaryButton
import com.athly.runner.core.designsystem.component.AthlySecondaryButton
import com.athly.runner.core.designsystem.component.AthlyTextField
import com.athly.runner.core.designsystem.component.athlyCard
import com.athly.runner.core.designsystem.component.athlyInsightCard
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlyTheme
import com.athly.runner.core.designsystem.theme.AthlyType

/**
 * Galeria do design system (debug). Usada temporariamente como tela inicial até o prompt 05 ligar a
 * navegação real. Serve para comparar visualmente com o iOS (botões, cards e campo de texto).
 */
@Composable
fun DesignSystemScreen() {
    var text by remember { mutableStateOf("") }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(AthlyColor.backgroundDark)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("Athly Design System", style = AthlyType.heading(24), color = AthlyColor.textPrimary)

        Text("Botões", style = AthlyType.semibold(17), color = AthlyColor.textSecondary)
        AthlyPrimaryButton("Primary", onClick = {})
        AthlyGradientButton("Gradient", onClick = {})
        AthlySecondaryButton("Secondary", onClick = {})
        AthlyDangerButton("Danger", onClick = {})

        Text("Cards", style = AthlyType.semibold(17), color = AthlyColor.textSecondary)
        Box(Modifier.fillMaxWidth().athlyCard().padding(16.dp)) {
            Text("AthlyCard", style = AthlyType.body(), color = AthlyColor.textPrimary)
        }
        Box(Modifier.fillMaxWidth().athlyCard(glow = true).padding(16.dp)) {
            Text("AthlyCard (glow)", style = AthlyType.body(), color = AthlyColor.textPrimary)
        }
        Box(Modifier.fillMaxWidth().athlyInsightCard().padding(16.dp)) {
            Text("AthlyInsightCard", style = AthlyType.body(), color = AthlyColor.textPrimary)
        }

        Text("Campo de texto", style = AthlyType.semibold(17), color = AthlyColor.textSecondary)
        AthlyTextField(value = text, onValueChange = { text = it }, placeholder = "Digite algo")
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF0A0A10)
@Composable
private fun DesignSystemScreenPreview() {
    AthlyTheme { DesignSystemScreen() }
}
