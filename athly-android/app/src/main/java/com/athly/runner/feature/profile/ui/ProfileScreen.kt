package com.athly.runner.feature.profile.ui

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.automirrored.filled.ShowChart
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.MonitorWeight
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Straighten
import androidx.compose.material.icons.filled.Terrain
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.athly.runner.BuildConfig
import com.athly.runner.core.common.Formatters
import com.athly.runner.core.designsystem.component.AthlyGradientButton
import com.athly.runner.core.designsystem.component.athlyCard
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlyGradient
import com.athly.runner.core.designsystem.theme.AthlyType
import com.athly.runner.feature.profile.ProfileUiState
import com.athly.runner.feature.profile.ProfileViewModel
import java.util.Locale

private val dayOptions = listOf(
    "sunday" to "Dom", "monday" to "Seg", "tuesday" to "Ter", "wednesday" to "Qua",
    "thursday" to "Qui", "friday" to "Sex", "saturday" to "Sáb",
)

/**
 * Perfil — espelha `ProfileView` do iOS: estatísticas, dias de treino, lembretes, peso, conta,
 * integração (Health Connect + Garmin "Em breve") e sobre. Admin (email-gated) não portado.
 */
@Composable
fun ProfileScreen(
    onLogout: () -> Unit,
    onDeleteAccount: () -> Unit,
    onOpenHistory: () -> Unit,
    viewModel: ProfileViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var showDeleteDialog by remember { mutableStateOf(false) }

    val notifPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { viewModel.setRemindersEnabled(true) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(AthlyColor.backgroundDark)
            .systemBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 12.dp)
            .padding(bottom = 96.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            "Perfil",
            style = AthlyType.heading(24),
            color = AthlyColor.textPrimary,
            modifier = Modifier.padding(vertical = 8.dp),
        )

        StatsSection(state)
        DaysSection(state, viewModel)
        RemindersSection(state, onToggle = { enabled ->
            if (enabled && android.os.Build.VERSION.SDK_INT >= 33) {
                // Android 13+: pede POST_NOTIFICATIONS ao ligar (espelha requestAuthorization do iOS);
                // o resultado religa via setRemindersEnabled(true) no launcher.
                notifPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
            } else {
                viewModel.setRemindersEnabled(enabled)
            }
        })
        WeightSection(state, viewModel)
        AccountSection(onLogout = onLogout, onDelete = { showDeleteDialog = true })
        IntegrationSection(onOpenHistory)
        AboutSection(
            onOpenUrl = { url ->
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            },
        )
    }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            containerColor = AthlyColor.surfaceCard,
            title = { Text("Excluir conta?", color = AthlyColor.textPrimary) },
            text = {
                Text(
                    "Isso apaga permanentemente sua conta e todos os seus dados. Essa ação não pode ser desfeita.",
                    color = AthlyColor.textSecondary,
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showDeleteDialog = false
                        onDeleteAccount()
                    },
                ) { Text("Excluir", color = AthlyColor.error) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) {
                    Text("Cancelar", color = AthlyColor.textSecondary)
                }
            },
        )
    }
}

@Composable
private fun SectionCard(title: String, content: @Composable () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().athlyCard().padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(title.uppercase(), style = AthlyType.label, color = AthlyColor.textTertiary)
        content()
    }
}

// MARK: - Estatísticas gerais

@Composable
private fun StatsSection(state: ProfileUiState) {
    val stats = state.stats
    SectionCard("Estatisticas gerais") {
        StatRow(Icons.AutoMirrored.Filled.DirectionsRun, "Total de corridas", "${stats.totalRuns}")
        StatRow(Icons.Filled.Straighten, "Distância total", String.format(Locale.US, "%.1f km", stats.totalDistanceKm))
        StatRow(Icons.Filled.Schedule, "Tempo total", formatTotalDuration(stats.totalDurationSec))
        StatRow(Icons.Filled.Speed, "Pace médio", Formatters.pace(stats.avgPaceSecPerKm))
        StatRow(Icons.Filled.Terrain, "Elevação total", String.format(Locale.US, "%.0f m", stats.totalElevationM))
    }
}

/** `%dh %dmin` ou `%dmin` — espelha o `formatDuration` do ProfileView iOS. */
private fun formatTotalDuration(seconds: Double): String {
    val totalMin = (seconds / 60).toInt()
    val h = totalMin / 60
    val min = totalMin % 60
    return if (h > 0) "${h}h ${min}min" else "${min}min"
}

@Composable
private fun StatRow(icon: ImageVector, label: String, value: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = AthlyColor.primary, modifier = Modifier.size(16.dp))
        Spacer(Modifier.size(10.dp))
        Text(label, style = AthlyType.body(15), color = AthlyColor.textSecondary)
        Spacer(Modifier.weight(1f))
        Text(value, style = AthlyType.semibold(15), color = AthlyColor.textPrimary)
    }
}

// MARK: - Dias de treino

@Composable
private fun DaysSection(state: ProfileUiState, viewModel: ProfileViewModel) {
    SectionCard("Preferências de treino") {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            dayOptions.forEach { (key, label) ->
                val selected = key in state.selectedDays
                val base = Modifier
                    .weight(1f)
                    .clip(CircleShape)
                    .then(
                        if (selected) Modifier.background(AthlyGradient.brand)
                        else Modifier
                            .background(AthlyColor.glassBackground)
                            .border(1.dp, AthlyColor.glassBorder, CircleShape),
                    )
                Box(
                    modifier = base
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                        ) { viewModel.toggleDay(key) }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        label,
                        style = AthlyType.semibold(12),
                        color = if (selected) Color.White else AthlyColor.textSecondary,
                    )
                }
            }
        }

        Text(
            "${state.selectedDays.size} dia(s) selecionado(s)",
            style = AthlyType.body(13),
            color = AthlyColor.textTertiary,
        )

        state.saveError?.let { Text(it, style = AthlyType.body(13), color = AthlyColor.error) }

        if (state.showSaveConfirmation) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Icons.Filled.CheckCircle, null, tint = AthlyColor.success, modifier = Modifier.size(14.dp))
                Text("Dias de treino salvos!", style = AthlyType.body(13), color = AthlyColor.success)
            }
        } else {
            AthlyGradientButton(
                text = if (state.isSavingDays) "Salvando..." else "Salvar",
                onClick = viewModel::saveDays,
                enabled = !state.isSavingDays,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

// MARK: - Lembretes

@Composable
private fun RemindersSection(state: ProfileUiState, onToggle: (Boolean) -> Unit) {
    SectionCard("Lembretes") {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Lembretes de treino", style = AthlyType.body(15), color = AthlyColor.textPrimary)
            Spacer(Modifier.weight(1f))
            Switch(
                checked = state.remindersEnabled,
                onCheckedChange = onToggle,
                colors = SwitchDefaults.colors(
                    checkedTrackColor = AthlyColor.primary,
                    checkedThumbColor = Color.White,
                ),
            )
        }
    }
}

// MARK: - Peso

@Composable
private fun WeightSection(state: ProfileUiState, viewModel: ProfileViewModel) {
    SectionCard("Perfil") {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(Icons.Filled.MonitorWeight, null, tint = AthlyColor.primary, modifier = Modifier.size(16.dp))
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(10.dp))
                    .background(AthlyColor.surfaceDark)
                    .border(1.dp, AthlyColor.glassBorder, RoundedCornerShape(10.dp))
                    .padding(horizontal = 12.dp, vertical = 10.dp),
            ) {
                if (state.weightText.isEmpty()) {
                    Text("70", style = AthlyType.body(15), color = AthlyColor.textTertiary)
                }
                BasicTextField(
                    value = state.weightText,
                    onValueChange = viewModel::onWeightTextChange,
                    textStyle = AthlyType.body(15).copy(color = AthlyColor.textPrimary),
                    cursorBrush = SolidColor(AthlyColor.primary),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                )
            }
            Text("kg", style = AthlyType.body(14), color = AthlyColor.textSecondary)
        }

        state.weightError?.let { Text(it, style = AthlyType.body(13), color = AthlyColor.error) }
        if (state.weightSaved) {
            Text("Peso salvo!", style = AthlyType.body(13), color = AthlyColor.success)
        }

        AthlyGradientButton(
            text = if (state.isSavingWeight) "Salvando..." else "Salvar",
            onClick = viewModel::saveWeight,
            enabled = !state.isSavingWeight,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

// MARK: - Conta / Integração / Sobre

@Composable
private fun AccountSection(onLogout: () -> Unit, onDelete: () -> Unit) {
    SectionCard("Conta") {
        ActionRow(Icons.AutoMirrored.Filled.Logout, "Sair", AthlyColor.error, onLogout)
        ActionRow(Icons.Filled.Delete, "Excluir conta", AthlyColor.error, onDelete)
    }
}

@Composable
private fun IntegrationSection(onOpenHistory: () -> Unit) {
    SectionCard("Integracao") {
        ActionRow(Icons.Filled.Favorite, "Corridas do Health Connect", AthlyColor.textPrimary, onOpenHistory)
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.AutoMirrored.Filled.ShowChart, null, tint = AthlyColor.textTertiary, modifier = Modifier.size(16.dp))
            Spacer(Modifier.size(10.dp))
            Text("Conectar Garmin", style = AthlyType.body(15), color = AthlyColor.textTertiary)
            Spacer(Modifier.weight(1f))
            Text("Em breve", style = AthlyType.body(12), color = AthlyColor.textTertiary)
        }
    }
}

@Composable
private fun AboutSection(onOpenUrl: (String) -> Unit) {
    SectionCard("Sobre") {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Versão", style = AthlyType.body(15), color = AthlyColor.textSecondary)
            Spacer(Modifier.weight(1f))
            Text(BuildConfig.VERSION_NAME, style = AthlyType.semibold(15), color = AthlyColor.textPrimary)
        }
        ActionRow(null, "Política de Privacidade", AthlyColor.primary) {
            onOpenUrl("https://athlyproject.app/privacy")
        }
        ActionRow(null, "Termos de Uso", AthlyColor.primary) {
            onOpenUrl("https://athlyproject.app/terms")
        }
    }
}

@Composable
private fun ActionRow(icon: ImageVector?, label: String, color: Color, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick,
            )
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        icon?.let {
            Icon(it, null, tint = color, modifier = Modifier.size(16.dp))
            Spacer(Modifier.size(10.dp))
        }
        Text(label, style = AthlyType.body(15), color = color)
    }
}
