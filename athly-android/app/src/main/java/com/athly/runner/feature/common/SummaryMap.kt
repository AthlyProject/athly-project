package com.athly.runner.feature.common

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.Polyline
import com.google.maps.android.compose.rememberCameraPositionState
import com.google.maps.android.compose.rememberMarkerState

/**
 * Mapa estático de rota — espelha `SummaryMapView` do iOS: polyline neon, marker verde no início e
 * vermelho no fim, câmera enquadrando a rota com padding. Compartilhado pelo resumo (09), histórico e
 * componentes (18). Chamar SÓ com >= 2 pontos (bounds com menos crasha) — o caller esconde o mapa.
 */
@Composable
fun SummaryMap(points: List<LatLng>, modifier: Modifier = Modifier) {
    val cameraPositionState = rememberCameraPositionState()
    val boundsPaddingPx = with(LocalDensity.current) { 28.dp.roundToPx() }

    GoogleMap(
        modifier = modifier,
        cameraPositionState = cameraPositionState,
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
        onMapLoaded = {
            val bounds = LatLngBounds.builder().apply { points.forEach(::include) }.build()
            cameraPositionState.move(CameraUpdateFactory.newLatLngBounds(bounds, boundsPaddingPx))
        },
    ) {
        Polyline(points = points, color = AthlyColor.secondaryNeon, width = 9f)
        Marker(
            state = rememberMarkerState(position = points.first()),
            icon = BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_GREEN),
        )
        Marker(
            state = rememberMarkerState(position = points.last()),
            icon = BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_RED),
        )
    }
}
