import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

// Mensagem simples. Com `opensMenu`, tocar leva à lista de treinos salvos.
class StatusView extends WatchUi.View {
    var opensMenu as Boolean;
    private var _message as ResourceId;

    function initialize(message as ResourceId, opensMenu as Boolean) {
        View.initialize();
        _message = message;
        self.opensMenu = opensMenu;
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        Ui.message(dc, Ui.str(_message), opensMenu ? Ui.str(Rez.Strings.TapToContinue) : null);
    }
}

class StatusDelegate extends WatchUi.BehaviorDelegate {
    private var _view as StatusView;

    function initialize(view as StatusView) {
        BehaviorDelegate.initialize();
        _view = view;
    }

    function onSelect() as Boolean {
        if (_view.opensMenu) {
            WorkoutMenu.show();
        }
        return true;
    }
}
