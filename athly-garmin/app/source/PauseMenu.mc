import Toybox.Lang;
import Toybox.WatchUi;

// Corrida pausada: retomar, salvar (FIT na Garmin + envio para a Athly) ou descartar.
module PauseMenu {
    function show(run as RunSession) as Void {
        var menu = new WatchUi.Menu2({ :title => Rez.Strings.Paused });
        menu.addItem(new WatchUi.MenuItem(Rez.Strings.Resume, null, :resume, null));
        menu.addItem(new WatchUi.MenuItem(Rez.Strings.Save, null, :save, null));
        menu.addItem(new WatchUi.MenuItem(Rez.Strings.Discard, null, :discard, null));
        WatchUi.pushView(menu, new PauseMenuDelegate(run), WatchUi.SLIDE_UP);
    }
}

class PauseMenuDelegate extends WatchUi.Menu2InputDelegate {
    private var _run as RunSession;
    private var _confirmDiscard as Boolean = false;

    function initialize(run as RunSession) {
        Menu2InputDelegate.initialize();
        _run = run;
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var id = item.getId();
        if (id == :resume) {
            WatchUi.popView(WatchUi.SLIDE_DOWN);
            _run.start();
        } else if (id == :save) {
            var queued = _run.save();
            WatchUi.popView(WatchUi.SLIDE_IMMEDIATE);
            var upload = new UploadView(queued);
            WatchUi.switchToView(upload, new UploadDelegate(upload), WatchUi.SLIDE_IMMEDIATE);
        } else if (id == :discard) {
            if (!_confirmDiscard) {
                // Segundo toque confirma: descartar não tem volta.
                _confirmDiscard = true;
                item.setSubLabel(Rez.Strings.DiscardConfirm);
                WatchUi.requestUpdate();
                return;
            }
            _run.discard();
            WatchUi.popView(WatchUi.SLIDE_IMMEDIATE);
            WorkoutMenu.show();
        }
    }

    // BACK no menu: continua pausado.
    function onBack() as Void {
        WatchUi.popView(WatchUi.SLIDE_DOWN);
    }
}
