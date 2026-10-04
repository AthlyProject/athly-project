import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

// Sincroniza ao abrir. Deu tudo certo: vai direto para a lista; senão mostra o motivo.
class SyncView extends WatchUi.View {
    var sync as SyncManager;
    private var _started as Boolean = false;

    function initialize() {
        View.initialize();
        sync = new SyncManager(method(:onSyncChanged));
    }

    function onShow() as Void {
        if (!_started) {
            _started = true;
            sync.start();
        }
    }

    function onSyncChanged() as Void {
        if (sync.state == SYNC_DONE && sync.failed == 0) {
            WorkoutMenu.show();
            return;
        }
        if (sync.state == SYNC_UNPAIRED) {
            var pairing = new PairingView();
            WatchUi.switchToView(pairing, new PairingDelegate(pairing), WatchUi.SLIDE_IMMEDIATE);
            return;
        }
        WatchUi.requestUpdate();
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        var state = sync.state;
        if (state == SYNC_DOWNLOAD && sync.total > 0) {
            var current = sync.downloaded + sync.failed + 1;
            Ui.message(dc, Lang.format(Ui.str(Rez.Strings.Downloading), [current > sync.total ? sync.total : current, sync.total]), null);
        } else if (state == SYNC_DONE) {
            var problem = sync.storageFull
                ? Ui.str(Rez.Strings.ErrStorage)
                : Lang.format(Ui.str(Rez.Strings.SyncPartial), [sync.failed]);
            Ui.message(dc, problem, Ui.str(Rez.Strings.TapToContinue));
        } else if (state == SYNC_FAILED) {
            Ui.message(dc, ErrorMap.text(sync.status), Ui.str(Rez.Strings.TapToContinue));
        } else {
            Ui.message(dc, Ui.str(Rez.Strings.Syncing), null);
        }
    }
}

class SyncDelegate extends WatchUi.BehaviorDelegate {
    private var _view as SyncView;

    function initialize(view as SyncView) {
        BehaviorDelegate.initialize();
        _view = view;
    }

    // Depois de uma falha, os treinos já salvos continuam acessíveis.
    function onSelect() as Boolean {
        var state = _view.sync.state;
        if (state == SYNC_DONE || state == SYNC_FAILED) {
            WorkoutMenu.show();
        }
        return true;
    }
}
