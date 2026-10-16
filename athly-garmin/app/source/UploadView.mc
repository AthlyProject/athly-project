import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

// Depois de salvar (ou pelo item "A enviar" do menu): envia a fila na hora, em primeiro plano, e
// mostra o resultado. Se falhar, a fila fica e o segundo plano tenta a cada 5 min.
class UploadView extends WatchUi.View {
    private var _saved as Boolean;
    private var _uploader as Uploader?;
    private var _status as Number? = null;

    // saved: a corrida acabou de ser salva e entrou na fila (false: curta demais ou sem espaço).
    function initialize(saved as Boolean) {
        View.initialize();
        _saved = saved;
    }

    function onShow() as Void {
        if (_uploader == null && _status == null) {
            _uploader = new Uploader(method(:onDone));
            (_uploader as Uploader).start();
        }
    }

    function onDone(status as Number) as Void {
        _uploader = null;
        _status = status;
        if (RunQueue.size() > 0) {
            UploadRules.scheduleRetries();
        }
        WatchUi.requestUpdate();
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        var title = _saved ? Ui.str(Rez.Strings.RunSaved) : lastRunProblem();
        var detail;
        var color = Graphics.COLOR_WHITE;
        if (_uploader != null) {
            detail = Ui.str(Rez.Strings.Uploading);
        } else if (_status == UploadRules.UPLOAD_OK || (_status == UploadRules.UPLOAD_NOTHING_TO_SEND && RunQueue.size() == 0)) {
            detail = Ui.str(Rez.Strings.UploadSent);
            color = Graphics.COLOR_GREEN;
        } else if (_status != null && ErrorMap.isPhoneError(_status as Number)) {
            detail = Ui.str(Rez.Strings.UploadLater);
            color = Graphics.COLOR_YELLOW;
        } else if (_status == UploadRules.UPLOAD_NOTHING_TO_SEND) {
            detail = Ui.str(Rez.Strings.ErrUnpaired);
            color = Graphics.COLOR_YELLOW;
        } else {
            detail = Lang.format(Ui.str(Rez.Strings.UploadError), [_status == null ? 0 : _status]);
            color = Graphics.COLOR_YELLOW;
        }
        Ui.message(dc, title, null);
        var height = dc.getHeight();
        Ui.text(dc, height * 70 / 100, Graphics.FONT_TINY, detail, color, height * 20 / 100);
    }

    // Título quando a corrida não entrou na fila.
    private function lastRunProblem() as String {
        var event = RunQueue.lastEvent();
        if (event != null && event[0] == RunQueue.EVENT_TOO_SHORT) {
            return Ui.str(Rez.Strings.RunTooShort);
        }
        if (event != null && event[0] == RunQueue.EVENT_NO_ROOM) {
            return Ui.str(Rez.Strings.RunNoRoom);
        }
        return Ui.str(Rez.Strings.ToSendTitle);
    }
}

class UploadDelegate extends WatchUi.BehaviorDelegate {
    function initialize(view as UploadView) {
        BehaviorDelegate.initialize();
    }

    function onSelect() as Boolean {
        WorkoutMenu.show();
        return true;
    }

    function onBack() as Boolean {
        WorkoutMenu.show();
        return true;
    }
}
