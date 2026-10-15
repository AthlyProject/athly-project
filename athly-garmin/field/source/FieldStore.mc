import Toybox.Application;
import Toybox.Lang;

// Tudo o que o campo guarda no Storage. Cada corrida finalizada vira:
//   "h<id>"     cabeçalho já no formato do POST /connect-iq/activities
//   "b<id>_<n>" blocos da rota (ByteArray, ver TrackCodec)
//   uma entrada [id, finalizadaEm] na fila "q"
// O processo em segundo plano lê e apaga essas chaves (Storage vale no background desde a 3.2).
(:background)
module FieldStore {
    // Corridas guardadas à espera de envio; a mais antiga sai para caber uma nova.
    const MAX_QUEUED = 3;

    function token() as String? {
        return Application.Storage.getValue("tok") as String?;
    }

    function setToken(token as String?) as Void {
        put("tok", token);
        put("tokOk", null);
    }

    // O backend já viu o token (GET /connect-iq/device): o dispositivo está ativo.
    function isTokenConfirmed() as Boolean {
        var value = Application.Storage.getValue("tokOk");
        return value instanceof Boolean && value as Boolean;
    }

    function setTokenConfirmed() as Void {
        put("tokOk", true);
    }

    // [código, pollToken, expiraEm, intervalo] do pareamento em andamento.
    function pendingPairing() as Array? {
        return Application.Storage.getValue("pp") as Array?;
    }

    function setPendingPairing(value as Array?) as Void {
        put("pp", value as Application.Storage.ValueType);
    }

    function queue() as Array<Array> {
        var value = Application.Storage.getValue("q");
        return value instanceof Array ? value as Array<Array> : [] as Array<Array>;
    }

    function hasQueued() as Boolean {
        return queue().size() > 0;
    }

    // Momento do último evento "atividade concluída" (ver Uploader.isConfirmed).
    function lastCompletedAt() as Number? {
        return Application.Storage.getValue("done") as Number?;
    }

    function setLastCompletedAt(value as Number) as Void {
        put("done", value);
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
    function enqueue(id as String, header as Dictionary, finalizedAt as Number) as Boolean {
        if (!putOrMakeRoom("h" + id, header as Application.Storage.ValueType, id)) {
            return false;
        }
        var q = queue();
        while (q.size() >= MAX_QUEUED) {
            removeFiles(q[0][0] as String);
            q = q.slice(1, null);
        }
        q.add([id, finalizedAt]);
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

    // Apaga os blocos de uma corrida que nem chegou a ir para a fila (curta demais).
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
            Application.Storage.setValue(key, value as Application.Storage.ValueType);
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
