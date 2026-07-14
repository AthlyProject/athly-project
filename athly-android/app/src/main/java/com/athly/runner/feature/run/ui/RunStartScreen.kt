package com.athly.runner.feature.run.ui

import android.location.Location
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.athly.runner.core.designsystem.component.AthlyPrimaryButton
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlyGradient
import com.athly.runner.core.designsystem.theme.AthlyType
import com.athly.runner.core.location.rememberRunPermissionState
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.rememberCameraPositionState

/**
 * Pré-corrida — espelha `RunStartView.preRunView` do iOS: preview de mapa (Maps Compose, estático) sob
 * um scrim escuro, com o gate de permissão de localização ou o "readyView" (indicador de GPS + INICIAR).
 * Pede só `ACCESS_FINE_LOCATION`; o background fica para o fluxo do prompt 06 (não bloqueia o INICIAR).
 */
@Composable
fun RunStartScreen(
    currentLocation: Location?,
    onStart: () -> Unit,
    onStartPreview: () -> Unit,
    onStopPreview: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val permission = rememberRunPermissionState()

    DisposableEffect(permission.hasForegroundLocation) {
        if (permission.hasForegroundLocation) onStartPreview()
        onDispose { onStopPreview() }
    }

    Box(modifier = modifier.fillMaxSize()) {
        if (permission.hasForegroundLocation && currentLocation != null) {
            val cameraPositionState = rememberCameraPositionState()
            LaunchedEffect(currentLocation) {
                cameraPositionState.position = CameraPosition.fromLatLngZoom(
                    LatLng(currentLocation.latitude, currentLocation.longitude),
                    15f,
                )
            }
            GoogleMap(
                modifier = Modifier.matchParentSize(),
                cameraPositionState = cameraPositionState,
                properties = MapProperties(isMyLocationEnabled = true),
                uiSettings = MapUiSettings(
                    compassEnabled = false,
                    mapToolbarEnabled = false,
                    myLocationButtonEnabled = false,
                    rotationGesturesEnabled = false,
                    scrollGesturesEnabled = false,
                    tiltGesturesEnabled = false,
                    zoomControlsEnabled = false,
                    zoomGesturesEnabled = false,
                ),
            )
        } else {
            Box(Modifier.matchParentSize().background(AthlyColor.backgroundDark))
        }

        // Scrim escuro para legibilidade (0.3 → 0.6 → 0.85).
        Box(
            Modifier.matchParentSize().background(
                Brush.verticalGradient(
                    listOf(Color.Black.copy(alpha = 0.3f), Color.Black.copy(alpha = 0.6f), Color.Black.copy(alpha = 0.85f)),
                ),
            ),
        )

        Column(
            modifier = Modifier.fillMaxSize().systemBarsPadding().padding(bottom = 96.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.weight(1f))
            if (!permission.hasForegroundLocation) {
                PermissionContent(
                    denied = permission.foregroundDenied,
                    onRequest = permission.requestForegroundLocation,
                    onOpenSettings = permission.openAppSettings,
                )
            } else {
                ReadyContent(hasFix = currentLocation != null, onStart = onStart)
            }
            Spacer(Modifier.weight(1f))
        }
    }
}

@Composable
private fun PermissionContent(denied: Boolean, onRequest: () -> Unit, onOpenSettings: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(20.dp),
        modifier = Modifier.padding(horizontal = 40.dp),
    ) {
        Icon(Icons.Filled.LocationOff, contentDescription = null, tint = AthlyColor.warning, modifier = Modifier.size(64.dp))
        Text(
            "Permissao de localizacao necessaria",
            style = AthlyType.semibold(20),
            color = AthlyColor.textPrimary,
            textAlign = TextAlign.Center,
        )
        Text(
            "Para rastrear sua corrida, precisamos acessar sua localizacao.",
            style = AthlyType.body(15),
            color = AthlyColor.textSecondary,
            textAlign = TextAlign.Center,
        )
        if (denied) {
            AthlyPrimaryButton(text = "Abrir Ajustes", onClick = onOpenSettings)
        } else {
            AthlyPrimaryButton(text = "Permitir localizacao", onClick = onRequest)
        }
    }
}

@Composable
private fun ReadyContent(hasFix: Boolean, onStart: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(40.dp)) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (hasFix) {
                    Box(Modifier.size(8.dp).clip(CircleShape).background(AthlyColor.success))
                    Text("GPS ativo", style = AthlyType.body(14), color = AthlyColor.success)
                } else {
                    CircularProgressIndicator(color = AthlyColor.warning, strokeWidth = 2.dp, modifier = Modifier.size(14.dp))
                    Text("Buscando GPS...", style = AthlyType.body(14), color = AthlyColor.warning)
                }
            }
            Text("Pronto para correr?", style = AthlyType.heading(26), color = Color.White)
        }

        StartButton(enabled = hasFix, onClick = onStart)
    }
}

@Composable
private fun StartButton(enabled: Boolean, onClick: () -> Unit) {
    Box(contentAlignment = Alignment.Center, modifier = Modifier.alpha(if (enabled) 1f else 0.5f)) {
        Box(Modifier.size(148.dp).border(2.dp, AthlyColor.primaryNeon.copy(alpha = 0.3f), CircleShape))
        Box(
            modifier = Modifier
                .size(130.dp)
                .clip(CircleShape)
                .background(AthlyGradient.neon)
                .clickable(
                    interactionSource = androidx.compose.runtime.remember { MutableInteractionSource() },
                    indication = null,
                    enabled = enabled,
                    onClick = onClick,
                ),
            contentAlignment = Alignment.Center,
        ) {
            Text("INICIAR", style = AthlyType.heading(18), color = Color.White)
        }
    }
}
