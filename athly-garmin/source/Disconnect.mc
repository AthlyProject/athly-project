import Toybox.Communications;
import Toybox.Lang;
import Toybox.PersistedContent;
import Toybox.WatchUi;

// "Desconectar" no relógio: revoga o token no backend, apaga os treinos do app e volta ao
// pareamento.
module Disconnect {
    function confirm() as Void {
        var menu = new WatchUi.Menu2({ :title => Rez.Strings.DisconnectTitle });
        menu.addItem(new WatchUi.MenuItem(Rez.Strings.Disconnect, null, :yes, null));
        menu.addItem(new WatchUi.MenuItem(Rez.Strings.Cancel, null, :no, null));
        WatchUi.pushView(menu, new DisconnectDelegate(), WatchUi.SLIDE_UP);
    }
}

class DisconnectDelegate extends WatchUi.Menu2InputDelegate {
    function initialize() {
        Menu2InputDelegate.initialize();
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        if (item.getId() != :yes) {
            WatchUi.popView(WatchUi.SLIDE_DOWN);
            return;
        }
        var token = WorkoutStore.token();
        if (token != null) {
            // Sem celular a chamada falha; o atleta ainda pode desconectar pelo app da Athly.
            Communications.makeWebRequest(
                Api.url("/connect-iq/device"),
                null,
                {
                    :method => Communications.HTTP_REQUEST_METHOD_DELETE,
                    :headers => Api.authHeaders(token),
                    :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON,
                },
                method(:onDeleted)
            );
        }
        AppWorkouts.removeAll();
        WorkoutStore.reset();
        WatchUi.popView(WatchUi.SLIDE_IMMEDIATE);
        var pairing = new PairingView();
        WatchUi.switchToView(pairing, new PairingDelegate(pairing), WatchUi.SLIDE_IMMEDIATE);
    }

    function onDeleted(
        responseCode as Number,
        data as Dictionary or String or PersistedContent.Iterator or Null
    ) as Void {
    }
}
