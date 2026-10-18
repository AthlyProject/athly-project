import Toybox.Application;
import Toybox.Lang;
import Toybox.Time;

// Corridas salvas esperando envio. Cada uma vira:
//   "h<id>"     cabeçalho já no formato do POST /connect-iq/activities
//   "b<id>_<n>" blocos da rota (ByteArray, ver TrackCodec)
//   uma entrada [id, salvaEm, título] na fila "q"
// Depois de enviada, a corrida vai para o histórico "hist" ([id, início, título], as 5 mais recentes
// primeiro) e o menu Corridas mostra a situação dela na Athly, guardada em "rs" (id → [status,
// resolução, treino]; ver RunStatus). Lido e apagado também pelo processo em segundo plano.
(:background)
module RunQueue {
    // Corridas guardadas à espera de envio; a mais antiga sai para caber uma nova.
    const MAX_QUEUED = 3;
    // Corridas enviadas que o menu Corridas acompanha.
    const MAX_HISTORY = 5;

    // Último acontecimento com uma corrida, mostrado no menu e na tela de envio.
    const EVENT_QUEUED = 1;
    const EVENT_TOO_SHORT = 2;
    const EVENT_NO_ROOM = 3;
    const EVENT_SENT = 4;
    const EVENT_REJECTED = 5;
    const EVENT_FAILED = 6;

    function queue() as Array<Array> {
        var value = Application.Storage.getValue("q");
        return value instanceof Array ? value as Array<Array> : [] as Array<Array>;
    }

    function size() as Number {
        return queue().size();
    }

    // [evento, momento, status HTTP/runtime ou 0].
    function lastEvent() as Array? {
        return Application.Storage.getValue("ev") as Array?;
    }

    function setLastEvent(event as Number, status as Number) as Void {
        var value = [event, Time.now().value(), status] as Array<Application.Storage.ValueType>;
        Application.Storage.setValue("ev", value);
    }

    function header(id as String) as Dictionary? {
        return Application.Storage.getValue("h" + id) as Dictionary?;
    }

    function block(id as String, seq as Number) as ByteArray? {
        return Application.Storage.getValue(blockKey(id, seq)) as ByteArray?;
    }

    // false quando o Storage está cheio mesmo depois de abrir espaço.
    function saveBlock(id as String, seq as Number, data as ByteArray) as Boolean {
        return putOrMakeRoom(blockKey(id, seq), data, id);
    }

    // Guarda o cabeçalho e põe a corrida na fila. false se não couber.
    function enqueue(id as String, header as Dictionary, savedAt as Number, title as String) as Boolean {
        if (!putOrMakeRoom("h" + id, header as Application.Storage.ValueType, id)) {
            return false;
        }
        var q = queue();
        while (q.size() >= MAX_QUEUED) {
            removeFiles(q[0][0] as String);
            q = q.slice(1, null);
        }
        q.add([id, savedAt, title]);
        put("q", q as Application.Storage.ValueType);
        return true;
    }

    // Tira a corrida da fila e apaga cabeçalho e blocos.
    function remove(id as String) as Void {
        removeFiles(id);
        var q = queue();
        var kept = [] as Array<Array>;
        for (var i = 0; i < q.size(); i++) {
            if (!(q[i][0] as String).equals(id)) {
                kept.add(q[i]);
            }
        }
        put("q", kept as Application.Storage.ValueType);
    }

    // Título de uma entrada da fila (filas antigas não tinham).
    function titleOf(entry as Array) as String {
        return entry.size() > 2 && entry[2] instanceof String ? entry[2] as String : "";
    }

    // Corrida enviada: sai da fila e entra no histórico, como "esperando o app".
    function markSent(id as String) as Void {
        var title = "";
        var q = queue();
        for (var i = 0; i < q.size(); i++) {
            if ((q[i][0] as String).equals(id)) {
                title = titleOf(q[i]);
            }
        }
        var header = header(id);
        var startedAt = header != null && header["start"] instanceof Number ? header["start"] as Number : 0;
        addHistory(id, startedAt, title);
        remove(id);
        var statuses = statuses();
        statuses[id] = ["ready", null, null];
        setStatuses(statuses);
    }

    // [id, início, título], mais recente primeiro.
    function history() as Array<Array> {
        var value = Application.Storage.getValue("hist");
        return value instanceof Array ? value as Array<Array> : [] as Array<Array>;
    }

    function addHistory(id as String, startedAt as Number, title as String) as Void {
        var list = [[id, startedAt, title]] as Array<Array>;
        var old = history();
        for (var i = 0; i < old.size() && list.size() < MAX_HISTORY; i++) {
            if (!(old[i][0] as String).equals(id)) {
                list.add(old[i]);
            }
        }
        put("hist", list as Application.Storage.ValueType);
        // Situação só das corridas que continuam no histórico.
        var statuses = statuses();
        var kept = {} as Dictionary;
        for (var k = 0; k < list.size(); k++) {
            var key = list[k][0] as String;
            if (statuses.hasKey(key)) {
                kept[key] = statuses[key];
            }
        }
        setStatuses(kept);
    }

    // id → [status, resolução, treino] (última resposta de GET /connect-iq/activities/status).
    function statuses() as Dictionary {
        var value = Application.Storage.getValue("rs");
        return value instanceof Dictionary ? value as Dictionary : {} as Dictionary;
    }

    function setStatuses(value as Dictionary) as Void {
        put("rs", value as Application.Storage.ValueType);
    }

    // Apaga os blocos de uma corrida que não foi para a fila (descartada ou curta demais).
    function discardBlocks(id as String, count as Number) as Void {
        for (var seq = 0; seq < count; seq++) {
            Application.Storage.deleteValue(blockKey(id, seq));
        }
    }

    function blockKey(id as String, seq as Number) as String {
        return "b" + id + "_" + seq;
    }

    function removeFiles(id as String) as Void {
        var header = header(id);
        var parts = header != null ? header["parts"] as Number? : null;
        // Sem cabeçalho (corrida interrompida) não se sabe quantos blocos há: apaga até faltar um.
        var seq = 0;
        while (parts != null ? seq < parts : Application.Storage.getValue(blockKey(id, seq)) != null) {
            Application.Storage.deleteValue(blockKey(id, seq));
            seq++;
        }
        Application.Storage.deleteValue("h" + id);
    }

    function put(key as String, value as Application.Storage.ValueType) as Void {
        if (value == null) {
            Application.Storage.deleteValue(key);
        } else {
            Application.Storage.setValue(key, value);
        }
    }

    // Storage cheio lança exceção: apaga a corrida mais antiga da fila (que não seja `keep`) e
    // tenta de novo uma vez.
    function putOrMakeRoom(key as String, value as Application.Storage.ValueType, keep as String) as Boolean {
        try {
            Application.Storage.setValue(key, value);
            return true;
        } catch (e) {
            var q = queue();
            if (q.size() == 0 || (q[0][0] as String).equals(keep)) {
                return false;
            }
            remove(q[0][0] as String);
        }
        try {
            Application.Storage.setValue(key, value);
            return true;
        } catch (e) {
            return false;
        }
    }
}
