package com.athly.runner.core.cue

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Haptics de transição — espelha `HapticService.swift`:
 * countdown = 3 taps leves a 120 ms; boundary = 1 tap forte; setComplete = rumble ~0.4 s.
 * API 31+ usa `VibrationEffect.Composition` (primitivos, se suportados); senão waveform/one-shot.
 */
@Singleton
class HapticService @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val vibrator: Vibrator =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }

    enum class HapticPattern { COUNTDOWN, BOUNDARY, SET_COMPLETE }

    fun fire(pattern: HapticPattern) {
        if (!vibrator.hasVibrator()) return
        val effect = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && primitivesSupported()) {
            composed(pattern)
        } else {
            fallback(pattern)
        }
        vibrator.vibrate(effect)
    }

    private fun primitivesSupported(): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            vibrator.areAllPrimitivesSupported(
                VibrationEffect.Composition.PRIMITIVE_TICK,
                VibrationEffect.Composition.PRIMITIVE_CLICK,
                VibrationEffect.Composition.PRIMITIVE_LOW_TICK,
            )

    private fun composed(pattern: HapticPattern): VibrationEffect = when (pattern) {
        // 3 taps leves (intensity 0.6) a 120 ms — CHHaptic transient 0.6/0.8 do iOS.
        HapticPattern.COUNTDOWN -> VibrationEffect.startComposition()
            .addPrimitive(VibrationEffect.Composition.PRIMITIVE_TICK, 0.6f, 0)
            .addPrimitive(VibrationEffect.Composition.PRIMITIVE_TICK, 0.6f, 120)
            .addPrimitive(VibrationEffect.Composition.PRIMITIVE_TICK, 0.6f, 120)
            .compose()

        // 1 tap forte (1.0/1.0).
        HapticPattern.BOUNDARY -> VibrationEffect.startComposition()
            .addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, 1.0f, 0)
            .compose()

        // Rumble contínuo ~0.4 s (0.9/0.4) — série de low ticks encadeados.
        HapticPattern.SET_COMPLETE -> VibrationEffect.startComposition()
            .addPrimitive(VibrationEffect.Composition.PRIMITIVE_LOW_TICK, 0.9f, 0)
            .addPrimitive(VibrationEffect.Composition.PRIMITIVE_LOW_TICK, 0.9f, 100)
            .addPrimitive(VibrationEffect.Composition.PRIMITIVE_LOW_TICK, 0.9f, 100)
            .addPrimitive(VibrationEffect.Composition.PRIMITIVE_LOW_TICK, 0.9f, 100)
            .compose()
    }

    private fun fallback(pattern: HapticPattern): VibrationEffect = when (pattern) {
        HapticPattern.COUNTDOWN -> VibrationEffect.createWaveform(
            longArrayOf(0, 40, 80, 40, 80, 40),
            intArrayOf(0, 150, 0, 150, 0, 150),
            -1,
        )

        HapticPattern.BOUNDARY -> VibrationEffect.createOneShot(60, VibrationEffect.DEFAULT_AMPLITUDE)

        HapticPattern.SET_COMPLETE -> VibrationEffect.createWaveform(
            longArrayOf(0, 400),
            intArrayOf(0, 230),
            -1,
        )
    }
}
