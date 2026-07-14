package com.athly.runner.feature.auth.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.athly.runner.core.designsystem.component.AthlyGradientButton
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlyRadius
import com.athly.runner.core.designsystem.theme.AthlyType
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/**
 * Botão de submit (Login/Registro) — espelha o botão gradiente com `ProgressView` do iOS:
 * mostra spinner quando `isLoading`, opacity 0.6 quando desabilitado/carregando.
 */
@Composable
fun AuthSubmitButton(
    text: String,
    isLoading: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val active = enabled && !isLoading
    Box(contentAlignment = Alignment.Center, modifier = modifier.fillMaxWidth()) {
        AthlyGradientButton(
            text = if (isLoading) "" else text,
            onClick = onClick,
            enabled = active,
            modifier = Modifier.alpha(if (active) 1f else 0.6f),
        )
        if (isLoading) {
            CircularProgressIndicator(
                color = Color.White,
                strokeWidth = 2.dp,
                modifier = Modifier.size(22.dp),
            )
        }
    }
}

/**
 * Campo de data (somente leitura) que abre um DatePicker Material3 — espelha o `DatePicker` do iOS.
 * Devolve `LocalDate`; a serialização `yyyy-MM-dd` fica na tela (LocalDate.toString()).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuthDateField(
    label: String,
    date: LocalDate,
    onDateSelected: (LocalDate) -> Unit,
    modifier: Modifier = Modifier,
) {
    var showDialog by remember { mutableStateOf(false) }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(AthlyRadius.smallShape)
            .background(AthlyColor.surfaceCard)
            .border(1.dp, AthlyColor.glassBorder, AthlyRadius.smallShape)
            .clickable { showDialog = true }
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = label, style = AthlyType.body(), color = AthlyColor.textTertiary)
        Box(Modifier.weight(1f))
        Text(text = date.toString(), style = AthlyType.body(), color = AthlyColor.textPrimary)
    }

    if (showDialog) {
        val pickerState = rememberDatePickerState(
            initialSelectedDateMillis = date.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
        )
        DatePickerDialog(
            onDismissRequest = { showDialog = false },
            confirmButton = {
                TextButton(onClick = {
                    pickerState.selectedDateMillis?.let {
                        onDateSelected(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate())
                    }
                    showDialog = false
                }) { Text("OK", color = AthlyColor.primary) }
            },
            dismissButton = {
                TextButton(onClick = { showDialog = false }) {
                    Text("Cancelar", color = AthlyColor.textSecondary)
                }
            },
        ) {
            DatePicker(state = pickerState)
        }
    }
}
