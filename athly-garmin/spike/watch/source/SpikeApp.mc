import Toybox.Application;
import Toybox.Communications;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.PersistedContent;
import Toybox.System;
import Toybox.Timer;
import Toybox.WatchUi;

// Spike da Phase 0 — não vai para a loja. Troque pela URL HTTPS do túnel antes de compilar.
const SPIKE_BASE = "https://REPLACE-ME.trycloudflare.com";

class SpikeApp extends Application.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    function getInitialView() as [ WatchUi.Views ] or [ WatchUi.Views, WatchUi.InputDelegates ] {
        var menu = new WatchUi.Menu2({ :title => "Athly spike" });
        menu.addItem(new WatchUi.MenuItem("Fixtures", "GET /list", :fixtures, null));
        menu.addItem(new WatchUi.MenuItem("JSON 401", "status real", :json401, null));
        menu.addItem(new WatchUi.MenuItem("JSON 401 env", "200 + statusCode", :json401w, null));
        menu.addItem(new WatchUi.MenuItem("Treinos do app", "getAppWorkouts", :list, null));
        menu.addItem(new WatchUi.MenuItem("Iniciar ultimo", "exitTo", :start, null));
        menu.addItem(new WatchUi.MenuItem("Encher ate o limite", "cap-01..30", :fill, null));
        menu.addItem(new WatchUi.MenuItem("Remover todos", "remove()", :removeAll, null));
        return [menu, new SpikeDelegate()];
    }
}

// Mostra o resultado em texto; voltar fecha.
class ResultView extends WatchUi.View {
    private var _text as String;

    function initialize(text as String) {
        View.initialize();
        _text = text;
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
        dc.clear();
        var fitted = Graphics.fitTextToArea(_text, Graphics.FONT_XTINY, dc.getWidth() * 8 / 10, dc.getHeight() * 8 / 10, true);
        dc.drawText(dc.getWidth() / 2, dc.getHeight() / 2, Graphics.FONT_XTINY, fitted == null ? _text : fitted, Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
    }
}

function showResult(text as String) as Void {
    System.println(text);
    WatchUi.pushView(new ResultView(text), new WatchUi.BehaviorDelegate(), WatchUi.SLIDE_LEFT);
}

class SpikeDelegate extends WatchUi.Menu2InputDelegate {
    // Último treino salvo, para "Iniciar ultimo".
    private var _lastId as Number? = null;
    private var _fillIndex as Number = 0;
    private var _timer as Timer.Timer = new Timer.Timer();
    private var _intent as System.Intent? = null;

    function initialize() {
        Menu2InputDelegate.initialize();
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var id = item.getId();
        if (id == :fixtures) {
            Communications.makeWebRequest(SPIKE_BASE + "/list", null,
                { :method => Communications.HTTP_REQUEST_METHOD_GET, :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON },
                method(:onList));
        } else if (id == :json401) {
            jsonProbe("/json/401");
        } else if (id == :json401w) {
            jsonProbe("/json/401w");
        } else if (id == :list) {
            showResult(describeAppWorkouts());
        } else if (id == :start) {
            startLast();
        } else if (id == :fill) {
            _fillIndex = 1;
            fillNext();
        } else if (id == :removeAll) {
            var removed = 0;
            var iterator = PersistedContent.getAppWorkouts();
            var w = iterator.next();
            while (w != null) {
                if (w instanceof PersistedContent.Workout && (w has :remove)) {
                    (w as PersistedContent.Workout).remove();
                    removed += 1;
                }
                w = iterator.next();
            }
            showResult("removidos: " + removed);
        } else if (id instanceof String) {
            // "<fixture>|<ct>"
            var parts = id as String;
            var bar = parts.find("|") as Number;
            download(parts.substring(0, bar), parts.substring(bar + 1, parts.length()), method(:onFit));
        }
    }

    function onList(responseCode as Number, data as Dictionary or String or PersistedContent.Iterator or Null) as Void {
        if (responseCode != 200 || !(data instanceof Dictionary)) {
            showResult("list: " + responseCode);
            return;
        }
        var names = (data as Dictionary)["fixtures"] as Array;
        var types = (data as Dictionary)["contentTypes"] as Array;
        var menu = new WatchUi.Menu2({ :title => "Fixtures" });
        for (var i = 0; i < names.size(); i++) {
            for (var j = 0; j < types.size(); j++) {
                var key = (names[i] as String) + "|" + (types[j] as String);
                menu.addItem(new WatchUi.MenuItem(names[i] as String, types[j] as String, key, null));
            }
        }
        WatchUi.pushView(menu, self, WatchUi.SLIDE_LEFT);
    }

    // FIT só com Authorization (Content-Type JSON numa requisição FIT quebra nos relógios).
    function download(name as String, ct as String, callback as Method) as Void {
        try {
            Communications.makeWebRequest(SPIKE_BASE + "/fit/" + name, { "ct" => ct },
                {
                    :method => Communications.HTTP_REQUEST_METHOD_GET,
                    :headers => { "Authorization" => "Bearer spike" },
                    :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_FIT,
                },
                callback);
        } catch (e instanceof Lang.SymbolNotAllowedException) {
            showResult("FIT nao suportado neste relogio");
        }
    }

    function onFit(responseCode as Number, data as Dictionary or String or PersistedContent.Iterator or Null) as Void {
        showResult(describeFit(responseCode, data));
    }

    function describeFit(responseCode as Number, data as Dictionary or String or PersistedContent.Iterator or Null) as String {
        if (!(data instanceof PersistedContent.Iterator)) {
            return "code " + responseCode + "\ndata " + (data == null ? "null" : data.toString());
        }
        var item = (data as PersistedContent.Iterator).next();
        if (!(item instanceof PersistedContent.Workout)) {
            return "code " + responseCode + "\niterator vazio (sem espaco?)";
        }
        var workout = item as PersistedContent.Workout;
        _lastId = workout.getId();
        return "code " + responseCode + "\n" + workout.getName() + "\nid " + workout.getId();
    }

    function jsonProbe(path as String) as Void {
        Communications.makeWebRequest(SPIKE_BASE + path, null,
            { :method => Communications.HTTP_REQUEST_METHOD_GET, :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON },
            method(:onJsonProbe));
    }

    function onJsonProbe(responseCode as Number, data as Dictionary or String or PersistedContent.Iterator or Null) as Void {
        showResult("code " + responseCode + "\n" + (data == null ? "null" : data.toString()));
    }

    function describeAppWorkouts() as String {
        var text = "";
        var count = 0;
        var iterator = PersistedContent.getAppWorkouts();
        var item = iterator.next();
        while (item != null) {
            if (item instanceof PersistedContent.Workout) {
                var workout = item as PersistedContent.Workout;
                text += workout.getId().toString() + " " + workout.getName() + "\n";
                count += 1;
            }
            item = iterator.next();
        }
        return count.toString() + " treinos\n" + text;
    }

    function startLast() as Void {
        if (_lastId == null) {
            showResult("baixe um treino antes");
            return;
        }
        var iterator = PersistedContent.getAppWorkouts();
        var item = iterator.next();
        while (item != null) {
            if (item instanceof PersistedContent.Workout && (item as PersistedContent.Workout).getId() == _lastId) {
                _intent = (item as PersistedContent.Workout).toIntent();
                _timer.start(method(:exitToWorkout), 200, false);
                return;
            }
            item = iterator.next();
        }
        showResult("treino " + _lastId + " sumiu");
    }

    function exitToWorkout() as Void {
        if (_intent != null) {
            System.exitTo(_intent as System.Intent);
        }
    }

    function fillNext() as Void {
        download("cap-" + _fillIndex.format("%02d"), "vnd", method(:onFill));
    }

    function onFill(responseCode as Number, data as Dictionary or String or PersistedContent.Iterator or Null) as Void {
        var saved = data instanceof PersistedContent.Iterator
            && (data as PersistedContent.Iterator).next() instanceof PersistedContent.Workout;
        if (!saved) {
            showResult("parou no cap-" + _fillIndex.format("%02d") + "\ncode " + responseCode + "\n" + describeAppWorkouts());
            return;
        }
        if (_fillIndex >= 30) {
            showResult("30 salvos\n" + describeAppWorkouts());
            return;
        }
        _fillIndex += 1;
        fillNext();
    }
}
