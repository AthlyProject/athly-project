package com.athly.runner.feature.auth.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.athly.runner.core.designsystem.component.AthlyLogo
import com.athly.runner.core.designsystem.component.AthlyTextField
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlyGradient
import com.athly.runner.core.designsystem.theme.AthlySpacing
import com.athly.runner.core.designsystem.theme.AthlyType

/**
 * Tela de login (stateless) — espelha `LoginView` do iOS. Campos locais; estado de auth e callbacks
 * vêm do [AuthViewModel] via [AuthGate]. Botão "Entrar" desabilitado se email/senha vazios ou loading.
 */
@Composable
fun LoginScreen(
    isLoading: Boolean,
    errorMessage: String?,
    onLogin: (email: String, password: String) -> Unit,
    onShowRegister: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }

    Column(
        modifier = modifier
            .fillMaxSize()
            .athlyAuthBackground()
            .systemBarsPadding()
            .imePadding()
            .padding(horizontal = AthlySpacing.md),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.weight(1f))

        AthlyLogo(size = 100.dp, cornerRadius = 22.dp)
        Spacer(Modifier.height(16.dp))
        Text(
            text = "Athly",
            style = AthlyType.heading(34).copy(brush = AthlyGradient.brand),
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(6.dp))
        Text(
            text = "Seu tracker de corrida inteligente",
            style = AthlyType.body(15),
            color = AthlyColor.textSecondary,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.height(AthlySpacing.lg))

        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            AthlyTextField(
                value = email,
                onValueChange = { email = it },
                placeholder = "Email",
                keyboardType = KeyboardType.Email,
            )
            AthlyTextField(
                value = password,
                onValueChange = { password = it },
                placeholder = "Senha",
                isPassword = true,
            )
            if (errorMessage != null) {
                Text(
                    text = errorMessage,
                    style = AthlyType.body(12),
                    color = AthlyColor.error,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            AuthSubmitButton(
                text = "Entrar",
                isLoading = isLoading,
                enabled = email.isNotBlank() && password.isNotBlank(),
                onClick = { onLogin(email, password) },
            )
        }

        Spacer(Modifier.weight(1f))

        TextButton(onClick = onShowRegister) {
            Text(text = "Criar conta", style = AthlyType.medium(16), color = AthlyColor.primary)
        }
        Spacer(Modifier.height(AthlySpacing.md))
    }
}
