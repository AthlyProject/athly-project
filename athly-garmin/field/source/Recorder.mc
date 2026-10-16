import Toybox.Activity;
import Toybox.Lang;
import Toybox.Position;
import Toybox.System;

// Grava uma corrida enquanto o cronômetro roda: um ponto de GPS a cada 2 s (em blocos no Storage,
// ver Track), uma volta por passo do treino (ou por volta, numa corrida livre) e as pausas. Quando a
// atividade termina (onTimerReset), monta o cabeçalho e põe a corrida na fila de envio.
class Recorder {
    const POINT_INTERVAL_SEC = 2;
    // O backend aceita até 200 voltas.
    const MAX_LAPS = 200;
    // Atividade iniciada e encerrada sem querer: não vale enviar.
    const MIN_TIMER_SEC = 60;

    private var _active as Boolean = false;
    private var _id as String = "";
    private var _start as Number = 0;
    private var _utcOffset as Number = 0;
    private var _lastActive as Number = 0;
    private var _workout as Boolean = false;
    private var _track as Track?;
    private var _lastPointAt as Number = -1;

    // Últimos valores do Activity.Info (os eventos de volta não trazem o Info).
    private var _distance as Float = 0.0;
    private var _timerMs as Number = 0;
    private var _hrAvg as Number? = null;
    private var _hrMax as Number? = null;

    private var _laps as Array<Dictionary> = [] as Array<Dictionary>;
    private var _lap as LapStats = new LapStats();
    private var _pauses as Array<Number> = [] as Array<Number>;
    private var _pausedAt as Number? = null;

    function isActive() as Boolean {
        return _active;
    }

    function compute(info as Activity.Info, now as Number) as Void {
        var running = info.timerState == Activity.TIMER_STATE_ON;
        if (!_active) {
            // Campo adicionado com a corrida já em andamento: começa a gravar daqui.
            if (!running) {
                return;
            }
            begin(now);
        }
        if (info.elapsedDistance != null) {
            _distance = info.elapsedDistance as Float;
        }
        if (info.timerTime != null) {
            _timerMs = info.timerTime as Number;
        }
        if (info.averageHeartRate != null) {
            _hrAvg = info.averageHeartRate;
        }
        if (info.maxHeartRate != null) {
            _hrMax = info.maxHeartRate;
        }
        if (!running) {
            return;
        }
        _lastActive = now;
        var heartRate = info.currentHeartRate;
        _lap.addHeartRate(heartRate);
        if (_workout && _lap.intensity == null) {
            _lap.intensity = currentIntensity();
        }
        if (now - _lastPointAt >= POINT_INTERVAL_SEC) {
            samplePosition(info, now, heartRate);
        }
    }

    function onTimerStart(now as Number) as Void {
        if (!_active) {
            begin(now);
            return;
        }
        resume(now);
    }

    function onTimerResume(now as Number) as Void {
        resume(now);
    }

    function onTimerPause(now as Number) as Void {
        if (_active && _pausedAt == null) {
            _pausedAt = now - _start;
        }
    }

    function onWorkoutStarted(now as Number) as Void {
        _workout = true;
        _lap.intensity = currentIntensity();
    }

    // Fim de um passo do treino: a volta é o passo.
    function onWorkoutStepComplete(now as Number) as Void {
        _workout = true;
        closeLap(now);
        _lap.intensity = currentIntensity();
    }

    // Botão de volta / volta automática. Num treino o passo já marca a volta (o botão só avança passo
    // "aberto", e isso chega como onWorkoutStepComplete).
    function onTimerLap(now as Number) as Void {
        if (!_workout) {
            closeLap(now);
        }
    }

    // Atividade salva ou descartada: finaliza e põe na fila. Quem decide se envia é o Uploader
    // (só manda corridas confirmadas pelo evento "atividade concluída").
    function finish(now as Number) as Void {
        if (!_active) {
            return;
        }
        _active = false;
        var track = _track as Track;
        var parts = track.finish();
        if (_timerMs / 1000 < MIN_TIMER_SEC || _lastActive <= _start) {
            FieldStore.discardBlocks(_id, parts);
            FieldStore.setLastEvent(FieldStore.EVENT_TOO_SHORT, _timerMs / 1000);
            reset();
            return;
        }
        closeLap(_lastActive);

        var header = {
            "id" => _id,
            "start" => _start,
            "end" => _lastActive,
            "utcOffset" => _utcOffset,
            "distance" => _distance,
            "timer" => _timerMs / 1000.0,
            "parts" => parts,
            "laps" => _laps,
            "pauses" => _pauses,
            "appVersion" => Config.APP_VERSION,
        } as Dictionary;
        if (_hrAvg != null && _hrAvg >= 20) {
            header["hrAvg"] = _hrAvg;
        }
        if (_hrMax != null && _hrMax >= 20) {
            header["hrMax"] = _hrMax;
        }
        if (FieldStore.enqueue(_id, header, now)) {
            FieldStore.setLastEvent(FieldStore.EVENT_QUEUED, parts);
            UploadRules.scheduleRetries();
        } else {
            FieldStore.discardBlocks(_id, parts);
            FieldStore.setLastEvent(FieldStore.EVENT_NO_ROOM, 0);
        }
        reset();
    }

    private function begin(now as Number) as Void {
        reset();
        _active = true;
        _start = now;
        _lastActive = now;
        _id = now.toString();
        _utcOffset = System.getClockTime().timeZoneOffset;
        _track = new Track(_id);
        _lap.begin(0, 0.0, 0);
    }

    private function resume(now as Number) as Void {
        if (_active && _pausedAt != null) {
            var resumedAt = now - _start;
            if (resumedAt > (_pausedAt as Number)) {
                _pauses.add(_pausedAt as Number);
                _pauses.add(resumedAt);
            }
            _pausedAt = null;
        }
    }

    private function closeLap(now as Number) as Void {
        if (!_active && _track == null) {
            return;
        }
        var lap = _lap.close(_laps.size(), now - _start, _distance, _timerMs);
        if (lap != null && _laps.size() < MAX_LAPS) {
            _laps.add(lap);
        }
        _lap.begin(now - _start, _distance, _timerMs);
    }

    private function samplePosition(info as Activity.Info, now as Number, heartRate as Number?) as Void {
        var location = info.currentLocation;
        var quality = info.currentLocationAccuracy;
        if (location == null || quality == null || quality < Position.QUALITY_USABLE) {
            return;
        }
        var degrees = location.toDegrees();
        (_track as Track).add(now - _start, degrees[0], degrees[1], heartRate);
        _lastPointAt = now;
    }

    private function currentIntensity() as Number? {
        var step = Activity.getCurrentWorkoutStep();
        return step != null ? step.intensity as Number : null;
    }

    private function reset() as Void {
        _id = "";
        _start = 0;
        _lastActive = 0;
        _workout = false;
        _track = null;
        _lastPointAt = -1;
        _distance = 0.0;
        _timerMs = 0;
        _hrAvg = null;
        _hrMax = null;
        _laps = [] as Array<Dictionary>;
        _lap = new LapStats();
        _pauses = [] as Array<Number>;
        _pausedAt = null;
    }
}

// Acumulado da volta aberta. Separado para os testes não dependerem do Activity.Info.
class LapStats {
    var intensity as Number? = null;
    private var _start as Number = 0;
    private var _distance0 as Float = 0.0;
    private var _timer0 as Number = 0;
    private var _hrSum as Number = 0;
    private var _hrCount as Number = 0;
    private var _hrMax as Number = 0;

    function begin(startOffset as Number, distance as Float, timerMs as Number) as Void {
        _start = startOffset;
        _distance0 = distance;
        _timer0 = timerMs;
        _hrSum = 0;
        _hrCount = 0;
        _hrMax = 0;
        intensity = null;
    }

    function addHeartRate(heartRate as Number?) as Void {
        if (heartRate == null || heartRate < 20 || heartRate > 250) {
            return;
        }
        _hrSum += heartRate;
        _hrCount++;
        if (heartRate > _hrMax) {
            _hrMax = heartRate;
        }
    }

    // Volta no formato do backend (ConnectIqLapDto), ou null se durou menos de 1 s de cronômetro.
    function close(index as Number, endOffset as Number, distance as Float, timerMs as Number) as Dictionary? {
        var timer = (timerMs - _timer0) / 1000.0;
        if (timer < 1.0 || endOffset < _start) {
            return null;
        }
        var lap = {
            "index" => index,
            "start" => _start,
            "end" => endOffset,
            "distance" => distance > _distance0 ? distance - _distance0 : 0.0,
            "timer" => timer,
        } as Dictionary;
        if (_hrCount > 0) {
            lap["hrAvg"] = (_hrSum + _hrCount / 2) / _hrCount;
            lap["hrMax"] = _hrMax;
        }
        if (intensity != null) {
            lap["intensity"] = intensity;
        }
        return lap;
    }
}

// Rota em blocos de TrackCodec.POINTS_PER_BLOCK pontos; cada bloco cheio vai para o Storage e sai
// da memória. Se o Storage encher, para de gravar a rota (voltas e totais continuam).
class Track {
    private var _id as String;
    private var _buffer as ByteArray? = null;
    private var _used as Number = 0;
    private var _seq as Number = 0;
    private var _ok as Boolean = true;

    function initialize(id as String) {
        _id = id;
    }

    function add(offsetSec as Number, latitude as Double or Float, longitude as Double or Float, heartRate as Number?) as Void {
        if (!_ok) {
            return;
        }
        if (_buffer == null) {
            _buffer = new [TrackCodec.BLOCK_BYTES]b;
        }
        TrackCodec.encodePoint(_buffer as ByteArray, _used, offsetSec, latitude, longitude, heartRate);
        _used++;
        if (_used == TrackCodec.POINTS_PER_BLOCK) {
            flush();
        }
    }

    // Grava o bloco parcial e devolve quantos blocos a corrida tem.
    function finish() as Number {
        flush();
        return _seq;
    }

    private function flush() as Void {
        if (_used == 0 || _buffer == null) {
            return;
        }
        var buffer = _buffer as ByteArray;
        var data = _used == TrackCodec.POINTS_PER_BLOCK ? buffer : buffer.slice(0, _used * TrackCodec.POINT_BYTES);
        if (FieldStore.saveBlock(_id, _seq, data)) {
            _seq++;
        } else {
            _ok = false;
        }
        _buffer = null;
        _used = 0;
    }
}
