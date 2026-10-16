import Toybox.Activity;
import Toybox.ActivityRecording;
import Toybox.Attention;
import Toybox.Lang;
import Toybox.Position;
import Toybox.Sensor;
import Toybox.Time;
import Toybox.Timer;
import Toybox.WatchUi;

enum {
    RUN_READY,
    RUN_RECORDING,
    RUN_PAUSED,
    RUN_FINISHED
}

// Uma corrida no app: grava o FIT da Garmin (ActivityRecording — vai para o Garmin Connect como
// qualquer corrida, com uma volta por passo), alimenta o Recorder (rota + passos para a Athly), o
// pace de 30 s e o Player, e vibra nas trocas de passo e quando o pace sai da faixa.
class RunSession {
    var state as Number = RUN_READY;
    var player as Player?;
    var pace as PaceWindow = new PaceWindow(30);
    // Último Activity.Info lido (a tela mostra tempo, distância, FC).
    var info as Activity.Info?;
    var gpsQuality as Number = Position.QUALITY_NOT_AVAILABLE;

    private var _title as String;
    private var _workoutId as String?;
    private var _session as ActivityRecording.Session?;
    private var _recorder as Recorder = new Recorder();
    private var _timer as Timer.Timer = new Timer.Timer();

    // steps: WorkoutPlan.expand do plano; null numa corrida livre.
    function initialize(title as String, workoutId as String?, steps as Array<Dictionary>?) {
        _title = title;
        _workoutId = workoutId;
        if (steps != null) {
            player = new Player(steps);
        }
    }

    function title() as String {
        return _title;
    }

    // Liga GPS e FC já na tela de "pronto", para o GPS achar posição antes do início.
    function open() as Void {
        Position.enableLocationEvents(Position.LOCATION_CONTINUOUS, method(:onPosition));
        Sensor.setEnabledSensors([Sensor.SENSOR_HEARTRATE] as Array<Sensor.SensorType>);
        _timer.start(method(:tick), 1000, true);
    }

    function close() as Void {
        _timer.stop();
        Position.enableLocationEvents(Position.LOCATION_DISABLE, method(:onPosition));
        Sensor.setEnabledSensors([] as Array<Sensor.SensorType>);
    }

    function onPosition(location as Position.Info) as Void {
        if (location.accuracy != null) {
            gpsQuality = location.accuracy;
        }
    }

    function start() as Void {
        var now = Time.now().value();
        if (state == RUN_READY) {
            _session = ActivityRecording.createSession({
                :sport => Activity.SPORT_RUNNING,
                :subSport => Activity.SUB_SPORT_GENERIC,
                :name => _title,
            });
            (_session as ActivityRecording.Session).start();
            state = RUN_RECORDING;
            _recorder.onTimerStart(now);
            if (player != null) {
                var p = player as Player;
                handle(p.start(0, 0.0));
                var step = p.current();
                _recorder.onWorkoutStarted(_workoutId as String, step != null ? step["intensity"] as Number? : null);
            }
            buzz(1);
        } else if (state == RUN_PAUSED) {
            (_session as ActivityRecording.Session).start();
            state = RUN_RECORDING;
            _recorder.onTimerResume(now);
        }
        WatchUi.requestUpdate();
    }

    function pause() as Void {
        if (state != RUN_RECORDING) {
            return;
        }
        (_session as ActivityRecording.Session).stop();
        state = RUN_PAUSED;
        _recorder.onTimerPause(Time.now().value());
        WatchUi.requestUpdate();
    }

    // Botão de volta: num treino avança o passo; numa corrida livre (ou depois do treino), volta.
    function lap() as Void {
        if (state != RUN_RECORDING) {
            return;
        }
        var now = Time.now().value();
        if (player != null && !(player as Player).isDone()) {
            var current = currentProgress();
            handle((player as Player).advance(current[0] as Number, current[1] as Float));
        } else {
            (_session as ActivityRecording.Session).addLap();
            _recorder.onTimerLap(now);
            pace.reset();
            buzz(1);
        }
        WatchUi.requestUpdate();
    }

    // Salva o FIT da Garmin e põe a corrida na fila da Athly. Devolve se entrou na fila.
    function save() as Boolean {
        var queued = false;
        if (_session != null) {
            var session = _session as ActivityRecording.Session;
            if (session.isRecording()) {
                session.stop();
            }
            session.save();
            queued = _recorder.finish(Time.now().value());
        }
        _session = null;
        state = RUN_FINISHED;
        close();
        return queued;
    }

    function discard() as Void {
        if (_session != null) {
            var session = _session as ActivityRecording.Session;
            if (session.isRecording()) {
                session.stop();
            }
            session.discard();
            _recorder.discard();
        }
        _session = null;
        state = RUN_FINISHED;
        close();
    }

    function tick() as Void {
        var current = Activity.getActivityInfo();
        info = current;
        if (current != null && state != RUN_READY) {
            var now = Time.now().value();
            _recorder.compute(current, now);
            if (state == RUN_RECORDING) {
                var progress = currentProgress();
                pace.add(progress[0] as Number, progress[1] as Float);
                if (player != null) {
                    handle((player as Player).update(progress[0] as Number, progress[1] as Float, pace.secPerKm()));
                }
            }
        }
        WatchUi.requestUpdate();
    }

    // [cronômetro ms, distância m] do último Activity.Info.
    private function currentProgress() as Array {
        var timerMs = info != null && info.timerTime != null ? info.timerTime as Number : 0;
        var distance = info != null && info.elapsedDistance != null ? info.elapsedDistance as Float : 0.0;
        return [timerMs, distance];
    }

    private function handle(events as Number) as Void {
        if (events & PlayerEvent.STEP_CHANGED) {
            var p = player as Player;
            if (p.index() > 0 && _session != null) {
                (_session as ActivityRecording.Session).addLap();
                var step = p.current();
                _recorder.onStepChanged(Time.now().value(), step != null ? step["intensity"] as Number? : null);
            }
            pace.reset();
            buzz(2);
            tone(Attention has :TONE_LAP ? Attention.TONE_LAP : null);
        }
        if (events & PlayerEvent.DONE) {
            if (_session != null) {
                (_session as ActivityRecording.Session).addLap();
                _recorder.onStepChanged(Time.now().value(), null);
            }
            buzz(3);
            tone(Attention has :TONE_SUCCESS ? Attention.TONE_SUCCESS : null);
        }
        if (events & PlayerEvent.STEP_ENDING) {
            buzz(1);
        }
        // Lento: dois toques curtos ("acelere"); rápido: um toque longo ("segure").
        if (events & PlayerEvent.TOO_SLOW) {
            buzz(2);
        }
        if (events & PlayerEvent.TOO_FAST) {
            buzzLong();
        }
    }

    private function buzz(pulses as Number) as Void {
        if (!(Attention has :vibrate)) {
            return;
        }
        var profile = [] as Array<Attention.VibeProfile>;
        for (var i = 0; i < pulses; i++) {
            profile.add(new Attention.VibeProfile(100, 250));
            if (i + 1 < pulses) {
                profile.add(new Attention.VibeProfile(0, 150));
            }
        }
        Attention.vibrate(profile);
    }

    private function buzzLong() as Void {
        if (Attention has :vibrate) {
            Attention.vibrate([new Attention.VibeProfile(100, 800)] as Array<Attention.VibeProfile>);
        }
    }

    private function tone(tone as Attention.Tone?) as Void {
        if (tone != null && Attention has :playTone) {
            Attention.playTone(tone);
        }
    }
}
