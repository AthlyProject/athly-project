package com.athly.runner.core.location

import android.location.Location
import com.athly.runner.domain.model.RoutePoint
import java.time.Instant

/**
 * `android.location.Location` → `RoutePoint` (domínio) — espelha `RoutePoint(location:)` do iOS
 * (speed nunca negativo; altitude/precisão só quando disponíveis). Deferido do prompt 03.
 */
fun Location.toRoutePoint(): RoutePoint = RoutePoint(
    latitude = latitude,
    longitude = longitude,
    altitude = if (hasAltitude()) altitude else 0.0,
    timestamp = Instant.ofEpochMilli(time),
    speed = if (hasSpeed()) maxOf(0.0, speed.toDouble()) else 0.0,
    horizontalAccuracy = if (hasAccuracy()) accuracy.toDouble() else 0.0,
)
