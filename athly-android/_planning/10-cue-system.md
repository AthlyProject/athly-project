# 10 — Sistema de cues: TTS (voz) + sons + haptics

## 1. Objetivo
Recriar o orquestrador de cues de transição de treino: um único `fire(event)` que coordena haptic + som +
voz (TTS pt-BR), com as **frases pt-BR idênticas** ao iOS. Usado pelo `RunTracker` (07) nas fronteiras de segmento.

## 2. Stack & convenções
Ver `README.md`. Tudo em `core/cue/`. `TextToSpeech` · `SoundPool` · `VibrationEffect`. Singletons via Hilt
(`@Singleton`), `@ApplicationContext`.

## 3. Referência iOS (espelhar 1:1)
- `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/AthlyRunner/Services/CueOrchestrator.swift`
  — **entrada única** `fire(_ event)`. `Event`: `.countdown3` (≈3s antes do fim do segmento), `.boundary(to:
  ActiveSegment)` (ao cruzar para um novo segmento), `.setComplete(setLabel:setsTotal:)` (fim da última rep de
  um set). Mapeamento:
  - `.countdown3` → `haptic(.countdown)` + `audio.playCountdown()`.
  - `.boundary(next)` → `haptic(.boundary)` + `audio.playBoundary()` + `speech.announce(ttsPhrase(next),
    priority: .normal)`.
  - `.setComplete(label,total)` → `haptic(.setComplete)` + `audio.playSetComplete()` +
    `speech.announce(total > 1 ? "\(label) concluído" : "Série concluída", priority: .high)`.
  - **`ttsPhrase(segment)`** (replicar EXATO, junta com ", "):
    - posição do set: se `setIndex`/`setTotal` → `"\(kindLabel) \(idx) de \(total)"` (ex.: "Tiro 3 de 6");
      senão só `kindLabel`.
    - cue de fim por `.distanceM`: `≥1000` → `"%.1f quilômetros"` (ex.: "1.5 quilômetros"); senão `"\(m) metros"`
      (ex.: "250 metros").
    - por `.durationSec`: `≥60` → se `s==0` `"\(m) minuto(s)"` (plural se `m>1`, ex.: "5 minutos"); senão
      `"\(m):\(%02d s)"` (ex.: "3:45"); `<60` → `"\(secs) segundos"`.
    - por `.reps`: `"\(n) repetições"` (ex.: "8 repetições").
  - **`kindLabel`** (pt-BR EXATO): warmup="Aquecimento", work="Tiro", recovery="Recuperação",
    cooldown="Desaceleramento", rest="Descanso", set/unknown="Próximo bloco".
- `/Users/.../Services/SpeechService.swift` — `AVSpeechSynthesizer`, voz `pt-BR`, **rate 0.52**, **pitch 1.0**,
  **volume 0.9**. Fila com prioridade `low(0)/normal(1)/high(2)`: ignora a nova fala se `isSpeaking && priority <
  currentPriority`; senão **interrompe** a atual (`stopSpeaking(.immediate)`) e fala a nova. Volta a `low` ao terminar.
- `/Users/.../Services/AudioCueService.swift` — `AVAudioPlayer` pré-carregando 3 wavs:
  `cue_countdown.wav` (3 tons descendentes), `cue_boundary.wav` (beep único), `cue_set_complete.wav`
  (2 tons de sucesso). `AVAudioSession` `.playback`/`.voicePrompt` com `.duckOthers`/`.allowBluetooth`/
  `.allowBluetoothA2DP` → **duck** da música durante o cue. Toca do início (`currentTime=0`), para se já tocando.
- `/Users/.../Services/HapticService.swift` — `CHHapticEngine` (custom) com fallback `UIImpactFeedbackGenerator`:
  `.countdown` = 3 taps leves a 120ms (intensity 0.6, sharpness 0.8); `.boundary` = 1 tap forte (1.0/1.0);
  `.setComplete` = rumble contínuo 0.4s (intensity 0.9, sharpness 0.4). Fallback: countdown=3× medium a 120ms,
  boundary=heavy 1.0, setComplete=`notification(.success)`.
- Os wavs vivem em `/Users/.../AthlyRunner/Resources/cue_countdown.wav`, `cue_boundary.wav`, `cue_set_complete.wav`.

## 4. Alvo Android (`core/cue/`)
- **`CueOrchestrator.kt`** (`@Singleton`) — `fun fire(event: CueEvent)`. `sealed interface CueEvent`:
  `Countdown3`, `Boundary(next: ActiveSegment)`, `SetComplete(setLabel: String, setsTotal: Int)`. Mesma
  coordenação haptic+audio+speech do iOS. `ttsPhrase(ActiveSegment)` e `kindLabel(SegmentKind)` replicando
  **as frases pt-BR exatas** acima (atenção a acentos e plurais; `%.1f` com `Locale("pt","BR")` → vírgula
  decimal: o iOS usa `String(format:)` com locale corrente — confirme se o device pt-BR gera "1,5" e mantenha
  consistência; preferir a mesma saída que o iOS produz em pt-BR).
- **`SpeechService.kt`** — `android.speech.tts.TextToSpeech`, `Locale("pt","BR")` (fallback
  `Locale.forLanguageTag("pt-BR")`). **Init assíncrono** (`OnInitListener`): só configurar idioma/voz **após
  `onInit == SUCCESS`**; enfileirar falas pedidas antes do init. `setSpeechRate(0.52f)`, `setPitch(1.0f)`,
  volume via `Bundle KEY_PARAM_VOLUME=0.9f`. Fila de prioridade `LOW/NORMAL/HIGH` espelhando a lógica:
  `speak(..., QUEUE_FLUSH, ...)` quando interrompe, ignorar se prioridade menor que a fala em curso. Pedir
  **audio focus transiente** antes de falar e abandonar depois.
- **`AudioCueService.kt`** — `SoundPool` (`AudioAttributes` `USAGE_ASSISTANCE_SONIFICATION`/`CONTENT_TYPE_SONIFICATION`),
  pré-carregar os 3 wavs de `res/raw` (`cue_countdown`, `cue_boundary`, `cue_set_complete`). `playCountdown/
  playBoundary/playSetComplete`. **Duck** da música: `AudioManager.requestAudioFocus` com
  `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK` (API 26+: `AudioFocusRequest`) antes do cue, **abandonar** logo após.
- **`HapticService.kt`** — `Vibrator`/`VibratorManager`. **API 31+:** `VibrationEffect.Composition`
  (`PRIMITIVE_TICK`/`PRIMITIVE_CLICK` com delays) para countdown (3× tick @120ms), boundary (1 click forte),
  setComplete (composição de baixa quedinha/rumble ~0.4s). **Fallback** (API 26-30): `VibrationEffect.createWaveform`
  (countdown padrão 3 pulsos), `createOneShot` (boundary), waveform de sucesso (setComplete). Respeitar amplitudes
  relativas (countdown leve, boundary forte).
- **Wavs:** copiar `cue_countdown.wav` / `cue_boundary.wav` / `cue_set_complete.wav` de
  `AthlyRunner/Resources/` para `app/src/main/res/raw/` (nomes lowercase, sem extensão no `R.raw`).

### Mapeamento de plataforma
| iOS | Android |
|---|---|
| `AVSpeechSynthesizer` (pt-BR, rate/pitch/volume) | `TextToSpeech` (`Locale pt-BR`, `setSpeechRate/setPitch`, `KEY_PARAM_VOLUME`) |
| `AVAudioPlayer` pré-carregado | `SoundPool.load` de `res/raw` |
| `AVAudioSession .duckOthers` | `AudioFocusRequest(AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)` |
| `CHHapticEngine` patterns | `VibrationEffect.Composition` (API 31+) |
| `UIImpactFeedbackGenerator` fallback | `VibrationEffect.createOneShot/createWaveform` |
| `Priority` enum + interrupção | fila de prioridade + `TextToSpeech.QUEUE_FLUSH` |

## 5. Contrato de dados
Sem endpoint. Consome `ActiveSegment`/`SegmentEndCondition`/`SegmentKind`/`SegmentEndBy` (03). Os strings de
voz são parte do **contrato de fidelidade pt-BR** — bater caractere a caractere com o iOS.

## 6. Escopo
**In:** `CueOrchestrator` + `SpeechService` + `AudioCueService` + `HapticService` + copiar os 3 wavs + builders
de frase pt-BR. Um teste unitário do `ttsPhrase`/`kindLabel` cobrindo set/distância/duração/reps.
**Fora:** quando disparar (isso é o `RunTracker`, 07); a notificação contínua (11).

## 7. Dependências
`03-domain-models` (`ActiveSegment` e enums). **Consumido pelo `07-run-tracker`** (dispara os eventos nas fronteiras).

## 8. Critérios de aceite
- Compila. `fire(.boundary(seg))` fala a frase pt-BR correta, toca `cue_boundary` e vibra; `fire(.countdown3)`
  e `fire(.setComplete(...))` idem com seus assets/patterns.
- **Teste do builder de frase** bate 1:1 com o iOS: "Tiro 3 de 6", "Aquecimento", "1.5 quilômetros",
  "250 metros", "5 minutos", "3:45", "8 repetições", "Série concluída"/"<label> concluído".
- A música de fundo (Spotify) **abaixa (duck)** durante o cue e volta depois.
- TTS funciona após o `onInit` (sem perder a primeira fala) e prioridade alta interrompe a baixa.

## 9. Pitfalls
- **TTS init é assíncrono:** configure o idioma **dentro do `onInit`**, não no construtor; enfileire falas
  pedidas antes de `SUCCESS` ou descarte com cuidado (não silencie a primeira boundary). Trate
  `LANG_MISSING_DATA`/`LANG_NOT_SUPPORTED` (fallback de voz).
- **Audio focus:** peça transiente-duck antes, **abandone depois** de falar/tocar; não segure o focus (mata a
  música do usuário). Em fones BT, garanta o roteamento.
- **Frases pt-BR exatas:** acentos ("Recuperação", "repetições"), plurais ("minuto"/"minutos") e o separador
  ", " entre partes — qualquer divergência quebra a fidelidade.
- Decimal de "%.1f": garanta a mesma renderização que o iOS pt-BR (vírgula vs ponto) — fixe um `Locale` e
  cubra no teste.
- `SoundPool` carrega async: aguarde `setOnLoadCompleteListener` antes do primeiro `play` (ou pré-carregue no init).
- `VibrationEffect.Composition` só existe em API 31+ e nem todo device suporta os primitivos — cheque
  `areAllPrimitivesSupported` e caia para waveform.
- Libere recursos: `tts.shutdown()`, `soundPool.release()`, abandono de focus ao fim da corrida.
