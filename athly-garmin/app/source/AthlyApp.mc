import Toybox.Application;
import Toybox.Background;
import Toybox.Lang;
import Toybox.System;
import Toybox.WatchUi;

// Entrada do app. (:glance) porque o glance também nasce daqui e (:background) porque o envio das
// corridas que sobraram (UploadService) também; as telas só rodam em primeiro plano.
(:glance, :background)
class AthlyApp extends Application.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    (:typecheck(disableBackgroundCheck))
    function getGlanceView() as [ WatchUi.GlanceView ] or [ WatchUi.GlanceView, WatchUi.GlanceViewDelegate ] or Null {
        return [new AthlyGlanceView()];
    }

    (:typecheck(disableGlanceCheck))
    function getServiceDelegate() as [ System.ServiceDelegate ] {
        return [new UploadService()];
    }

    // Só roda em primeiro plano; as telas não precisam existir no escopo do glance/background.
    (:typecheck([disableGlanceCheck, disableBackgroundCheck]))
    function getInitialView() as [ WatchUi.Views ] or [ WatchUi.Views, WatchUi.InputDelegates ] {
        // Corrida de outro dia ainda na fila (celular estava longe): garante a nova tentativa.
        if (RunQueue.size() > 0 && Background.getTemporalEventRegisteredTime() == null) {
            UploadRules.scheduleRetries();
        }
        if (WorkoutStore.token() == null) {
            var pairing = new PairingView();
            return [pairing, new PairingDelegate(pairing)];
        }
        var sync = new SyncView();
        return [sync, new SyncDelegate(sync)];
    }
}
