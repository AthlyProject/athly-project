import Toybox.Activity;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Time;
import Toybox.Time.Gregorian;
import Toybox.WatchUi;

// O campo na tela de corrida. Pareado: pace médio de 30 s, com fundo verde dentro da faixa do passo,
// vermelho acima (lento) e azul abaixo (rápido); o rótulo mostra a faixa. Sem pareamento: o código
// para digitar no app. Em qualquer caso grava a corrida (Recorder) — a rota sai do relógio só depois.
// Abrir a corrida sem iniciar também envia na hora o que estiver na fila, mostrando o andamento.
class AthlyField extends WatchUi.DataField {
    const UPLOAD_RETRY_SEC = 60;

    private var _recorder as Recorder = new Recorder();
    private var _pace as PaceWindow = new PaceWindow(30);
    private var _pairing as FieldPairing?;
    // [rápido, lento] em s/km, do alvo de velocidade do passo atual.
    private var _target as [Number, Number]? = null;
    // Envio em primeiro plano; o processo em segundo plano continua tentando a cada 5 min.
    private var _uploader as Uploader?;
    private var _uploadStatus as Number? = null;
    private var _nextUploadAt as Number = 0;

    function initialize() {
        DataField.initialize();
        if (FieldStore.token() == null || !FieldStore.isTokenConfirmed()) {
            _pairing = new FieldPairing();
        }
    }

    function compute(info as Activity.Info) as Void {
        var now = Time.now().value();
        if (_pairing != null) {
            var pairing = _pairing as FieldPairing;
            pairing.tick(now);
            if (pairing.isDone()) {
                _pairing = null;
            }
        }
        _recorder.compute(info, now);
        if (_pairing == null && !_recorder.isActive() && info.timerState != Activity.TIMER_STATE_ON) {
            maybeUpload(now);
        }
        if (info.timerState == Activity.TIMER_STATE_ON) {
            _pace.add(info.timerTime, info.elapsedDistance);
        }
        if (_target == null && info.timerState == Activity.TIMER_STATE_ON) {
            _target = stepTarget();
        }
    }

    function onTimerStart() as Void {
        _recorder.onTimerStart(Time.now().value());
    }

    function onTimerResume() as Void {
        _recorder.onTimerResume(Time.now().value());
    }

    function onTimerPause() as Void {
        _recorder.onTimerPause(Time.now().value());
    }

    function onTimerStop() as Void {
        _recorder.onTimerPause(Time.now().value());
    }

    function onTimerLap() as Void {
        _recorder.onTimerLap(Time.now().value());
    }

    function onWorkoutStarted() as Void {
        _recorder.onWorkoutStarted(Time.now().value());
        _pace.reset();
        _target = stepTarget();
    }

    function onWorkoutStepComplete() as Void {
        _recorder.onWorkoutStepComplete(Time.now().value());
        _pace.reset();
        _target = stepTarget();
    }

    function onTimerReset() as Void {
        finishRecording();
    }

    function finishRecording() as Void {
        _recorder.finish(Time.now().value());
        _pace.reset();
        _target = null;
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        var background = getBackgroundColor();
        var foreground = background == Graphics.COLOR_BLACK ? Graphics.COLOR_WHITE : Graphics.COLOR_BLACK;
        var label;
        var value;
        var numeric = false;

        if (_pairing != null && !(_pairing as FieldPairing).isPaired()) {
            label = WatchUi.loadResource(Rez.Strings.PairLabel) as String;
            value = pairingText(_pairing as FieldPairing);
        } else {
            var pace = _pace.secPerKm();
            value = pace == null ? "--:--" : PaceMath.format(pace);
            numeric = true;
            if (_target != null) {
                var target = _target as [Number, Number];
                label = PaceMath.format(target[0]) + "-" + PaceMath.format(target[1]);
                if (pace != null) {
                    background = pace < target[0] ? Graphics.COLOR_BLUE
                        : pace > target[1] ? Graphics.COLOR_RED : Graphics.COLOR_DK_GREEN;
                    foreground = Graphics.COLOR_WHITE;
                }
            } else if (!_recorder.isActive() && (_uploader != null || FieldStore.hasQueued())) {
                // Antes de começar: corrida esperando envio, e o andamento do envio.
                label = Lang.format(WatchUi.loadResource(Rez.Strings.PendingUploads) as String, [FieldStore.queue().size()]);
                var progress = uploadText();
                if (progress != null) {
                    value = progress;
                    numeric = false;
                }
            } else if (!_recorder.isActive()) {
                // Antes de iniciar, sem nada na fila: o que aconteceu com a última corrida, ou a
                // versão (confirma o build instalado).
                var last = lastRunText();
                label = last != null ? last : "Athly " + Config.APP_VERSION;
            } else {
                label = WatchUi.loadResource(Rez.Strings.Pace30) as String;
            }
        }

        dc.setColor(foreground, background);
        dc.clear();
        var width = dc.getWidth();
        var height = dc.getHeight();
        dc.setColor(foreground, Graphics.COLOR_TRANSPARENT);
        dc.drawText(width / 2, height * 22 / 100, Graphics.FONT_XTINY, label,
            Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
        dc.drawText(width / 2, height * 62 / 100, fontFor(dc, value, numeric), value,
            Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
    }

    function onUploadDone(status as Number) as Void {
        _uploader = null;
        _uploadStatus = status;
        _nextUploadAt = Time.now().value() + UPLOAD_RETRY_SEC;
    }

    private function maybeUpload(now as Number) as Void {
        if (_uploader != null || now < _nextUploadAt || !FieldStore.hasQueued() || FieldStore.token() == null) {
            return;
        }
        _uploader = new Uploader(method(:onUploadDone));
        (_uploader as Uploader).start();
    }

    // "Enviando", ou o erro do último envio; null antes da primeira tentativa.
    private function uploadText() as String? {
        if (_uploader != null) {
            return WatchUi.loadResource(Rez.Strings.Uploading) as String;
        }
        var status = _uploadStatus;
        if (status == null) {
            // Sem tentativa nesta abertura: mostra a falha do envio em segundo plano, se houver.
            var event = FieldStore.lastEvent();
            if (event != null && event[0] == FieldStore.EVENT_FAILED) {
                status = event[2] as Number;
            }
        }
        if (status == null || status == UploadRules.UPLOAD_OK || status == UploadRules.UPLOAD_NOTHING_TO_SEND) {
            return null;
        }
        if (FieldApi.isPhoneError(status)) {
            return WatchUi.loadResource(Rez.Strings.PairNoPhone) as String;
        }
        return Lang.format(WatchUi.loadResource(Rez.Strings.UploadError) as String, [status]);
    }

    // Última corrida nas últimas 24 h: "Enviado 19:42", "Corrida curta"... ou null.
    private function lastRunText() as String? {
        var event = FieldStore.lastEvent();
        if (event == null || event.size() < 3 || Time.now().value() - (event[1] as Number) > 24 * 3600) {
            return null;
        }
        var kind = event[0] as Number;
        if (kind == FieldStore.EVENT_SENT) {
            var at = Gregorian.info(new Time.Moment(event[1] as Number), Time.FORMAT_SHORT);
            return Lang.format(WatchUi.loadResource(Rez.Strings.LastSent) as String,
                [Lang.format("$1$:$2$", [at.hour, (at.min as Number).format("%02d")])]);
        }
        if (kind == FieldStore.EVENT_TOO_SHORT) {
            return WatchUi.loadResource(Rez.Strings.LastTooShort) as String;
        }
        if (kind == FieldStore.EVENT_NO_ROOM) {
            return WatchUi.loadResource(Rez.Strings.LastNoRoom) as String;
        }
        if (kind == FieldStore.EVENT_REJECTED) {
            return Lang.format(WatchUi.loadResource(Rez.Strings.LastRejected) as String, [event[2]]);
        }
        // Na fila mas a fila está vazia: a corrida sumiu do Storage sem envio.
        if (kind == FieldStore.EVENT_QUEUED) {
            return WatchUi.loadResource(Rez.Strings.LastLost) as String;
        }
        return null;
    }

    private function pairingText(pairing as FieldPairing) as String {
        if (pairing.state == FIELD_PAIRING_SHOWING) {
            return pairing.displayCode();
        }
        if (pairing.state == FIELD_PAIRING_ERROR) {
            return WatchUi.loadResource(
                FieldApi.isPhoneError(pairing.errorStatus) ? Rez.Strings.PairNoPhone : Rez.Strings.PairError
            ) as String;
        }
        return WatchUi.loadResource(Rez.Strings.PairRequesting) as String;
    }

    // Maior fonte em que o texto cabe em 90% da largura e 55% da altura do campo (o layout muda
    // de 1 a 4+ campos por tela).
    private function fontFor(dc as Graphics.Dc, text as String, numeric as Boolean) as Graphics.FontType {
        var fonts = numeric
            ? [Graphics.FONT_NUMBER_HOT, Graphics.FONT_NUMBER_MEDIUM, Graphics.FONT_NUMBER_MILD, Graphics.FONT_MEDIUM, Graphics.FONT_SMALL]
            : [Graphics.FONT_MEDIUM, Graphics.FONT_SMALL, Graphics.FONT_TINY, Graphics.FONT_XTINY];
        var maxWidth = dc.getWidth() * 9 / 10;
        var maxHeight = dc.getHeight() * 55 / 100;
        for (var i = 0; i < fonts.size(); i++) {
            var size = dc.getTextDimensions(text, fonts[i]);
            if (size[0] <= maxWidth && size[1] <= maxHeight) {
                return fonts[i];
            }
        }
        return Graphics.FONT_XTINY;
    }

    // Faixa de pace do passo atual, quando o alvo é velocidade (o FIT da Athly sempre usa).
    private function stepTarget() as [Number, Number]? {
        var info = Activity.getCurrentWorkoutStep();
        if (info == null) {
            return null;
        }
        var step = info.step;
        if (step instanceof Activity.WorkoutIntervalStep) {
            var interval = step as Activity.WorkoutIntervalStep;
            var resting = info.intensity == Activity.WORKOUT_INTENSITY_REST
                || info.intensity == Activity.WORKOUT_INTENSITY_RECOVERY;
            step = resting ? interval.restStep : interval.activeStep;
        }
        var workoutStep = step as Activity.WorkoutStep;
        if (workoutStep.targetType != Activity.WORKOUT_STEP_TARGET_SPEED) {
            return null;
        }
        return PaceMath.paceRange(workoutStep.targetValueLow, workoutStep.targetValueHigh);
    }
}
