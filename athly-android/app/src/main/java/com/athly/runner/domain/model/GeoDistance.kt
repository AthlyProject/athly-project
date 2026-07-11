package com.athly.runner.domain.model

import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Distância geodésica (Haversine) entre pontos — UMA função usada tanto pelo tracker ao vivo quanto
 * pelo SplitCalculator, para que distância ao vivo e splits nunca divirjam (foi essa divergência que
 * produziu o bug do km 1 inflado no iOS). Substitui `CLLocation.distance(from:)`.
 */
const val EARTH_RADIUS_M: Double = 6_371_000.0

fun haversineMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
    val dLat = Math.toRadians(lat2 - lat1)
    val dLon = Math.toRadians(lon2 - lon1)
    val a = sin(dLat / 2) * sin(dLat / 2) +
        cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLon / 2) * sin(dLon / 2)
    return EARTH_RADIUS_M * 2 * asin(min(1.0, sqrt(a)))
}

fun RoutePoint.distanceTo(other: RoutePoint): Double =
    haversineMeters(latitude, longitude, other.latitude, other.longitude)
