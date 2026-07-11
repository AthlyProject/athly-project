package com.athly.runner.core.cue

import com.athly.runner.domain.run.RunCue
import com.athly.runner.domain.run.RunTracker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Entrada única dos cues de transição — espelha `CueOrchestrator.swift`: decide o padrão háptico, o tom e
 * a frase TTS de cada evento; nada mais coordena os três serviços. No iOS o tracker chama
 * `CueOrchestrator.shared.fire(...)`; aqui o tracker (07) emite `RunCue`s num SharedFlow e este singleton
 * os consome — basta ser instanciado (o RunViewModel o injeta) para a assinatura viver o processo inteiro.
 */
@Singleton
class CueOrchestrator @Inject constructor(
    tracker: RunTracker,
    private val speech: SpeechService,
    private val audio: AudioCueService,
    private val haptic: HapticService,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    init {
        scope.launch { tracker.cues.collect(::fire) }
    }

    fun fire(cue: RunCue) {
        when (cue) {
            RunCue.Countdown3 -> {
                haptic.fire(HapticService.HapticPattern.COUNTDOWN)
                audio.playCountdown()
            }

            is RunCue.Boundary -> {
                haptic.fire(HapticService.HapticPattern.BOUNDARY)
                audio.playBoundary()
                speech.announce(CuePhrases.ttsPhrase(cue.segment), SpeechService.Priority.NORMAL)
            }

            is RunCue.SetComplete -> {
                haptic.fire(HapticService.HapticPattern.SET_COMPLETE)
                audio.playSetComplete()
                speech.announce(
                    CuePhrases.setCompletePhrase(cue.setLabel, cue.setsTotal),
                    SpeechService.Priority.HIGH,
                )
            }
        }
    }

    /** Silencia tudo (fim/descarte da corrida) — espelha `stopAll` do iOS. */
    fun stopAll() {
        audio.stopAll()
        speech.stop()
    }
}
