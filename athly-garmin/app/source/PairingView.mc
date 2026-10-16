import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

// Tela de pareamento: mostra o código para digitar no app da Athly.
class PairingView extends WatchUi.View {
    var pairing as PairingController;

    function initialize() {
        View.initialize();
        pairing = new PairingController(method(:onPairingChanged));
    }

    function onShow() as Void {
        pairing.start();
    }

    function onHide() as Void {
        pairing.stop();
    }

    function onPairingChanged() as Void {
        if (pairing.state == PAIRING_PAIRED) {
            var sync = new SyncView();
            WatchUi.switchToView(sync, new SyncDelegate(sync), WatchUi.SLIDE_LEFT);
            return;
        }
        WatchUi.requestUpdate();
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        if (pairing.state == PAIRING_SHOWING) {
            drawCode(dc);
        } else if (pairing.state == PAIRING_EXPIRED) {
            Ui.message(dc, Ui.str(Rez.Strings.PairExpired), null);
        } else if (pairing.state == PAIRING_ERROR) {
            Ui.message(dc, ErrorMap.text(pairing.errorStatus), Ui.str(Rez.Strings.TapToRetry));
        } else {
            Ui.message(dc, Ui.str(Rez.Strings.PairRequesting), null);
        }
    }

    private function drawCode(dc as Graphics.Dc) as Void {
        var height = dc.getHeight();
        var code = pairing.code;
        // "4821 3907": mais fácil de ler e digitar.
        var shown = code.length() == 8 ? code.substring(0, 4) + " " + code.substring(4, 8) : code;
        var footer = pairing.pollError != 0
            ? ErrorMap.text(pairing.pollError)
            : Lang.format(Ui.str(Rez.Strings.PairExpires), [pairing.remainingMinutes()]);

        Ui.clear(dc);
        Ui.text(dc, height * 17 / 100, Graphics.FONT_XTINY, Ui.str(Rez.Strings.PairTitle), Ui.BRAND, height * 10 / 100);
        Ui.text(dc, height * 36 / 100, Graphics.FONT_XTINY, Ui.str(Rez.Strings.PairInstructions), Graphics.COLOR_WHITE, height * 25 / 100);
        Ui.text(dc, height * 60 / 100, Graphics.FONT_LARGE, shown, Graphics.COLOR_WHITE, height * 20 / 100);
        Ui.text(dc, height * 81 / 100, Graphics.FONT_XTINY, footer, Graphics.COLOR_LT_GRAY, height * 14 / 100);
    }
}

class PairingDelegate extends WatchUi.BehaviorDelegate {
    private var _view as PairingView;

    function initialize(view as PairingView) {
        BehaviorDelegate.initialize();
        _view = view;
    }

    function onSelect() as Boolean {
        _view.pairing.retry();
        return true;
    }
}
