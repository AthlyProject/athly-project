package com.athly.runner.core.cue

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.SoundPool
import android.os.Handler
import android.os.Looper
import com.athly.runner.R
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Tons curtos de transição de segmento — espelha `AudioCueService.swift`: 3 wavs pré-carregados
 * (countdown 3-2-1, boundary beep, setComplete 2 tons), com duck da música (audio focus transiente
 * MAY_DUCK pedido antes do play e abandonado ao fim do som).
 */
@Singleton
class AudioCueService @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val handler = Handler(Looper.getMainLooper())
    private var focusRequest: AudioFocusRequest? = null

    private val attributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()

    private val soundPool = SoundPool.Builder()
        .setMaxStreams(2)
        .setAudioAttributes(attributes)
        .build()

    private val loaded = mutableSetOf<Int>()
    private val countdownId: Int
    private val boundaryId: Int
    private val setCompleteId: Int

    init {
        soundPool.setOnLoadCompleteListener { _, sampleId, status ->
            if (status == 0) loaded.add(sampleId)
        }
        countdownId = soundPool.load(context, R.raw.cue_countdown, 1)
        boundaryId = soundPool.load(context, R.raw.cue_boundary, 1)
        setCompleteId = soundPool.load(context, R.raw.cue_set_complete, 1)
    }

    fun playCountdown() = play(countdownId, CUE_COUNTDOWN_MS)
    fun playBoundary() = play(boundaryId, CUE_BOUNDARY_MS)
    fun playSetComplete() = play(setCompleteId, CUE_SET_COMPLETE_MS)

    fun stopAll() {
        soundPool.autoPause()
        handler.removeCallbacksAndMessages(null)
        abandonFocus()
    }

    private fun play(soundId: Int, durationMs: Long) {
        if (soundId !in loaded) return // ainda carregando — descarta como o iOS sem player
        requestFocus()
        soundPool.play(soundId, VOLUME, VOLUME, 1, 0, 1f)
        // SoundPool não tem callback de fim: agenda o abandono do focus pela duração conhecida do wav.
        handler.removeCallbacksAndMessages(null)
        handler.postDelayed({ abandonFocus() }, durationMs)
    }

    private fun requestFocus() {
        if (focusRequest != null) return
        val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            .setAudioAttributes(attributes)
            .build()
        audioManager.requestAudioFocus(request)
        focusRequest = request
    }

    private fun abandonFocus() {
        focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
        focusRequest = null
    }

    fun release() {
        stopAll()
        soundPool.release()
    }

    private companion object {
        const val VOLUME = 1f

        // Duração real dos wavs (afinfo: 0.52s / 0.09s / 0.44s) + folga, para devolver o focus logo após o som.
        const val CUE_COUNTDOWN_MS = 620L
        const val CUE_BOUNDARY_MS = 190L
        const val CUE_SET_COMPLETE_MS = 540L
    }
}
