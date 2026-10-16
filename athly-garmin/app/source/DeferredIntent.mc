import Toybox.Lang;
import Toybox.System;
import Toybox.Timer;

// Chama System.exitTo depois de 200 ms: chamar direto do callback do menu falha em alguns
// firmwares (contorno recomendado pela Garmin, também usado pelo app da TrainAsONE).
class DeferredIntent {
    private var _intent as System.Intent;
    private var _timer as Timer.Timer = new Timer.Timer();

    function initialize(intent as System.Intent) {
        _intent = intent;
        _timer.start(method(:fire), 200, false);
    }

    function fire() as Void {
        System.exitTo(_intent);
    }
}
