package com.athly.runner.feature.auth.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.athly.runner.core.designsystem.component.AthlyTextField
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlySpacing
import com.athly.runner.core.designsystem.theme.AthlyType
import java.time.LocalDate

/**
 * Tela de registro (stateless, scroll) — espelha `RegisterView` do iOS. Validação local:
 * senhas coincidem, **senha mínimo 8**, e todos os campos obrigatórios preenchidos → habilita "Registrar".
 */
@Composable
fun RegisterScreen(
    isLoading: Boolean,
    errorMessage: String?,
    onRegister: (
        name: String,
        userName: String,
        email: String,
        password: String,
        confirmPassword: String,
        dateOfBirth: String,
        weight: Double,
        height: Double,
    ) -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var name by rememberSaveable { mutableStateOf("") }
    var userName by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var confirmPassword by rememberSaveable { mutableStateOf("") }
    var dateOfBirth by remember { mutableStateOf(LocalDate.now()) }
    var weightText by rememberSaveable { mutableStateOf("") }
    var heightText by rememberSaveable { mutableStateOf("") }

    val passwordsMatch = password.isNotEmpty() && password == confirmPassword
    val isFormValid = name.isNotBlank() && userName.isNotBlank() && email.isNotBlank() &&
        passwordsMatch && password.length >= 8 && weightText.isNotBlank() && heightText.isNotBlank()

    Box(modifier = modifier.fillMaxSize().background(AthlyColor.backgroundDark)) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .systemBarsPadding()
                .imePadding()
                .padding(horizontal = AthlySpacing.md),
        ) {
            Row(modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
                TextButton(onClick = onCancel) {
                    Text(text = "Cancelar", style = AthlyType.medium(16), color = AthlyColor.primary)
                }
                Box(Modifier.weight(1f))
            }

            Spacer(Modifier.height(AthlySpacing.sm))

            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = "Criar conta",
                    style = AthlyType.heading(28),
                    color = AthlyColor.textPrimary,
                    textAlign = TextAlign.Center,
                )
                Text(
                    text = "Comece a registrar suas corridas",
                    style = AthlyType.body(15),
                    color = AthlyColor.textSecondary,
                    textAlign = TextAlign.Center,
                )
            }

            Spacer(Modifier.height(AthlySpacing.lg))

            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                AthlyTextField(value = name, onValueChange = { name = it }, placeholder = "Nome completo")
                AthlyTextField(value = userName, onValueChange = { userName = it }, placeholder = "Username")
                AthlyTextField(
                    value = email,
                    onValueChange = { email = it },
                    placeholder = "Email",
                    keyboardType = KeyboardType.Email,
                )
                AthlyTextField(
                    value = password,
                    onValueChange = { password = it },
                    placeholder = "Senha (mínimo 8 caracteres)",
                    isPassword = true,
                )
                AthlyTextField(
                    value = confirmPassword,
                    onValueChange = { confirmPassword = it },
                    placeholder = "Confirmar senha",
                    isPassword = true,
                )
                if (confirmPassword.isNotEmpty() && !passwordsMatch) {
                    Text(
                        text = "As senhas não coincidem",
                        style = AthlyType.body(12),
                        color = AthlyColor.error,
                    )
                }

                AuthDateField(
                    label = "Data de nascimento",
                    date = dateOfBirth,
                    onDateSelected = { dateOfBirth = it },
                )

                AthlyTextField(
                    value = weightText,
                    onValueChange = { weightText = it },
                    placeholder = "Peso (kg)",
                    keyboardType = KeyboardType.Decimal,
                )
                AthlyTextField(
                    value = heightText,
                    onValueChange = { heightText = it },
                    placeholder = "Altura (cm)",
                    keyboardType = KeyboardType.Decimal,
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
                    text = "Registrar",
                    isLoading = isLoading,
                    enabled = isFormValid,
                    onClick = {
                        onRegister(
                            name,
                            userName,
                            email,
                            password,
                            confirmPassword,
                            dateOfBirth.toString(),
                            weightText.replace(',', '.').toDoubleOrNull() ?: 0.0,
                            heightText.replace(',', '.').toDoubleOrNull() ?: 0.0,
                        )
                    },
                )
            }

            Spacer(Modifier.height(AthlySpacing.lg))
        }
    }
}
