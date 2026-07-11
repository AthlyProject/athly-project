package com.athly.runner.core.cue

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Anúncios TTS pt-BR — espelha `SpeechService.swift`: voz pt-BR, rate 0.52, pitch 1.0, volume 0.9,
 * prioridade LOW/NORMAL/HIGH (fala em curso só é interrompida por prioridade >= à dela; ao terminar volta
 * a LOW). Init do `TextToSpeech` é assíncrono: fala pedida antes do SUCCESS fica pendente (uma) e é dita
 * no `onInit` — não se perde a primeira boundary. Duck da música via audio focus transiente.
 */
@Singleton
class SpeechService @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    enum class Priority { LOW, NORMAL, HIGH }

    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private var focusRequest: AudioFocusRequest? = null

    private var ready = false
    private var languageAvailable = false
    private var currentPriority = Priority.LOW
    private var isSpeaking = false
    private var pending: Pair<String, Priority>? = null
    private var utteranceSeq = 0

    private val tts: TextToSpeech = TextToSpeech(context) { status ->
        if (status == TextToSpeech.SUCCESS) onTtsReady()
    }

    private fun onTtsReady() {
        val result = tts.setLanguage(Locale("pt", "BR"))
        languageAvailable = result != TextToSpeech.LANG_MISSING_DATA &&
            result != TextToSpeech.LANG_NOT_SUPPORTED
        tts.setSpeechRate(SPEECH_RATE)
        tts.setPitch(PITCH)
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) = Unit

            override fun onDone(utteranceId: String?) = finishUtterance()

            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) = finishUtterance()

            override fun onError(utteranceId: String?, errorCode: Int) = finishUtterance()
        })
        ready = true
        pending?.let { (phrase, priority) ->
            pending = null
            announce(phrase, priority)
        }
    }

    /** Espelha `announce` do iOS: ignora se algo de prioridade maior está falando; senão interrompe. */
    fun announce(phrase: String, priority: Priority = Priority.NORMAL) {
        if (phrase.isEmpty()) return
        if (!ready) {
            // Guarda a última fala pedida pré-init (a mais nova ganha — mesma semântica de interrupção).
            if (pending == null || priority >= pending!!.second) pending = phrase to priority
            return
        }
        if (!languageAvailable) return
        if (isSpeaking && priority < currentPriority) return

        currentPriority = priority
        isSpeaking = true
        requestFocus()

        val params = Bundle().apply { putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, VOLUME) }
        utteranceSeq += 1
        // QUEUE_FLUSH = stopSpeaking(.immediate) + fala a nova.
        tts.speak(phrase, TextToSpeech.QUEUE_FLUSH, params, "athly_cue_$utteranceSeq")
    }

    fun stop() {
        pending = null
        tts.stop()
        finishUtterance()
    }

    private fun finishUtterance() {
        isSpeaking = false
        currentPriority = Priority.LOW
        abandonFocus()
    }

    private fun requestFocus() {
        if (focusRequest != null) return
        val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build(),
            )
            .build()
        audioManager.requestAudioFocus(request)
        focusRequest = request
    }

    private fun abandonFocus() {
        focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
        focusRequest = null
    }

    fun shutdown() {
        stop()
        tts.shutdown()
    }

    private companion object {
        const val SPEECH_RATE = 0.52f * 2 // AVSpeech 0.52 ≈ normal; no Android 1.0 = normal → ~1.04
        const val PITCH = 1.0f
        const val VOLUME = 0.9f
    }
}
