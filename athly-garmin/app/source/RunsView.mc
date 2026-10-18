import Toybox.Communications;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.PersistedContent;
import Toybox.Timer;
import Toybox.WatchUi;

// Menu Corridas: envia o que ainda está no relógio, pergunta à Athly a situação das últimas corridas
// (chegou? o atleta já confirmou no app do iPhone?) e mostra a lista. Sem celular, mostra a última
// situação conhecida.
class RunsSyncView extends WatchUi.View {
    private var _uploader as Uploader?;
    private var _watchdog as Timer.Timer = new Timer.Timer();
    private var _seq as Number = 0;
    private var _started as Boolean = false;

    function initialize() {
        View.initialize();
    }

    function onShow() as Void {
        if (_started) {
            return;
        }
        _started = true;
        if (RunQueue.size() > 0) {
            _uploader = new Uploader(method(:onUploaded));
            (_uploader as Uploader).start();
        } else {
            requestStatus();
        }
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        Ui.message(dc, Ui.str(_uploader != null ? Rez.Strings.Uploading : Rez.Strings.RunsChecking), null);
    }

    function onUploaded(status as Number) as Void {
        _uploader = null;
        if (RunQueue.size() > 0) {
            UploadRules.scheduleRetries();
        }
        if (status != UploadRules.UPLOAD_OK && status != UploadRules.UPLOAD_NOTHING_TO_SEND) {
            // Sem celular ou erro: não adianta perguntar a situação agora.
            RunsMenu.show(status);
            return;
        }
        requestStatus();
    }

    function onStatus(
        responseCode as Number,
        data as Dictionary or String or PersistedContent.Iterator or Null,
        context as Object
    ) as Void {
        if (context != _seq) {
            return;
        }
        _watchdog.stop();
        var code = Api.status(responseCode, data);
        Log.d("runs status response=" + responseCode + " status=" + code);
        if (code == 200 && data instanceof Dictionary && (data as Dictionary)["runs"] instanceof Array) {
            RunQueue.setStatuses(RunStatus.merge(RunQueue.statuses(), (data as Dictionary)["runs"] as Array));
            RunsMenu.show(0);
            return;
        }
        RunsMenu.show(code);
    }

    function onWatchdog() as Void {
        _seq += 1;
        RunsMenu.show(-300);
    }

    private function requestStatus() as Void {
        var token = WorkoutStore.token();
        var history = RunQueue.history();
        if (token == null || history.size() == 0) {
            RunsMenu.show(0);
            return;
        }
        var ids = "";
        for (var i = 0; i < history.size(); i++) {
            ids += (i > 0 ? "," : "") + (history[i][0] as String);
        }
        _seq += 1;
        _watchdog.start(method(:onWatchdog), Config.REQUEST_TIMEOUT_MS, false);
        WatchUi.requestUpdate();
        Communications.makeWebRequest(
            Api.url("/connect-iq/activities/status"),
            { "ids" => ids },
            {
                :method => Communications.HTTP_REQUEST_METHOD_GET,
                :headers => Api.authHeaders(token),
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON,
                :context => _seq,
            },
            method(:onStatus)
        );
    }
}

// Lista: "Sincronizar agora", as corridas que faltam enviar e as últimas enviadas com a situação
// na Athly.
module RunsMenu {
    // problem: 0 = sincronizou; senão o status do envio ou da consulta que falhou.
    function show(problem as Number) as Void {
        var menu = new WatchUi.Menu2({ :title => Rez.Strings.Runs });
        var syncHint = problem == 0 ? null : ErrorMap.text(problem);
        menu.addItem(new WatchUi.MenuItem(Rez.Strings.SyncRunsNow, syncHint, :sync, null));

        var queue = RunQueue.queue();
        for (var i = queue.size() - 1; i >= 0; i--) {
            var id = queue[i][0] as String;
            menu.addItem(new WatchUi.MenuItem(
                RunStatus.title(startOf(id), RunQueue.titleOf(queue[i])), Ui.str(Rez.Strings.RunQueued), id, null));
        }
        var history = RunQueue.history();
        var statuses = RunQueue.statuses();
        for (var k = 0; k < history.size(); k++) {
            var entry = history[k];
            menu.addItem(new WatchUi.MenuItem(
                RunStatus.title(entry[1] as Number, entry[2] as String),
                RunStatus.label(statuses[entry[0]] as Array?),
                entry[0] as String,
                null
            ));
        }
        if (queue.size() == 0 && history.size() == 0) {
            menu.addItem(new WatchUi.MenuItem(Rez.Strings.NoRuns, null, :none, null));
        }
        WatchUi.switchToView(menu, new RunsMenuDelegate(), WatchUi.SLIDE_IMMEDIATE);
    }

    // O id da corrida é o início em segundos Unix.
    function startOf(id as String) as Number {
        var value = id.toNumber();
        return value == null ? 0 : value;
    }

    // Sublabel do item Corridas no menu principal: o que falta enviar ou a corrida mais recente.
    function summary() as String? {
        var pending = RunQueue.size();
        if (pending > 0) {
            return Lang.format(Ui.str(Rez.Strings.ToSend), [pending]);
        }
        var history = RunQueue.history();
        if (history.size() == 0) {
            return null;
        }
        return RunStatus.label(RunQueue.statuses()[history[0][0]] as Array?);
    }
}

class RunsMenuDelegate extends WatchUi.Menu2InputDelegate {
    function initialize() {
        Menu2InputDelegate.initialize();
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        if (item.getId() == :sync) {
            var view = new RunsSyncView();
            WatchUi.switchToView(view, new WatchUi.BehaviorDelegate(), WatchUi.SLIDE_IMMEDIATE);
        }
    }

    function onBack() as Void {
        WorkoutMenu.show();
    }
}
