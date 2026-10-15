import Toybox.Application;
import Toybox.Background;
import Toybox.Lang;
import Toybox.System;
import Toybox.Time;
import Toybox.WatchUi;

// Entrada do campo de dados. (:background) porque o processo em segundo plano (envio das corridas,
// UploadService) também nasce daqui.
(:background)
class AthlyFieldApp extends Application.AppBase {
    // Só existe no processo de primeiro plano.
    private var _field as AthlyField?;

    function initialize() {
        AppBase.initialize();
    }

    // Campo fechado sem onTimerReset (atividade encerrada de outro jeito): não perde a corrida.
    (:typecheck(disableBackgroundCheck))
    function onStop(state as Dictionary?) as Void {
        if (_field != null) {
            (_field as AthlyField).finishRecording();
        }
    }

    function getServiceDelegate() as [ System.ServiceDelegate ] {
        return [new UploadService()];
    }

    // Só roda em primeiro plano (tela de corrida aberta).
    (:typecheck(disableBackgroundCheck))
    function getInitialView() as [ WatchUi.Views ] or [ WatchUi.Views, WatchUi.InputDelegates ] {
        // Idempotente: o envio sai quando a corrida é salva, mesmo com o campo já fechado.
        Background.registerForActivityCompletedEvent();
        // Corrida de outro dia ainda na fila (celular estava longe): garante a nova tentativa.
        if (FieldStore.hasQueued() && Background.getTemporalEventRegisteredTime() == null) {
            UploadRules.scheduleRetries();
        }
        _field = new AthlyField();
        return [_field as AthlyField];
    }
}
