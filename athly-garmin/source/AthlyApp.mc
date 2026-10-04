import Toybox.Application;
import Toybox.Lang;
import Toybox.WatchUi;

// Entrada do app. (:glance) porque o glance também nasce daqui; o resto das telas só roda em
// primeiro plano.
(:glance)
class AthlyApp extends Application.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    function getGlanceView() as [ WatchUi.GlanceView ] or [ WatchUi.GlanceView, WatchUi.GlanceViewDelegate ] or Null {
        return [new AthlyGlanceView()];
    }

    // Só roda em primeiro plano; as telas não precisam existir no escopo do glance.
    (:typecheck(disableGlanceCheck))
    function getInitialView() as [ WatchUi.Views ] or [ WatchUi.Views, WatchUi.InputDelegates ] {
        if (!AppWorkouts.isSupported()) {
            var unsupported = new StatusView(Rez.Strings.ErrUnsupported, false);
            return [unsupported, new StatusDelegate(unsupported)];
        }
        if (WorkoutStore.token() == null) {
            var pairing = new PairingView();
            return [pairing, new PairingDelegate(pairing)];
        }
        var sync = new SyncView();
        return [sync, new SyncDelegate(sync)];
    }
}
