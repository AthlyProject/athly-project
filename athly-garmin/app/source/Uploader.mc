import Toybox.Background;
import Toybox.Communications;
import Toybox.Lang;
import Toybox.PersistedContent;
import Toybox.StringUtil;
import Toybox.System;
import Toybox.Time;

(:background)
module UploadRules {
    // Nova tentativa enquanto houver corrida na fila (celular longe na hora de salvar).
    const RETRY_INTERVAL_SEC = 5 * 60;

    // Resultado de um envio (os demais valores são o status HTTP ou o código de erro do runtime).
    const UPLOAD_OK = 0;
    const UPLOAD_NOTHING_TO_SEND = 1;

    // Agenda as tentativas em segundo plano (repetem até a fila esvaziar).
    function scheduleRetries() as Void {
        try {
            Background.registerForTemporalEvent(new Time.Duration(RETRY_INTERVAL_SEC));
        } catch (e) {
            // Intervalo recusado (evento recente demais): a próxima abertura do app tenta.
        }
    }
}

// Envia as corridas da fila, uma request por vez (o processo em segundo plano tem 64 KB):
// cabeçalho → blocos que faltam → próxima corrida. O backend responde ao cabeçalho com os blocos
// que já tem, então um envio interrompido continua de onde parou na próxima tentativa. Toda corrida
// da fila foi salva pelo atleta no app (descartada não entra), então tudo vai.
(:background)
class Uploader {
    private var _done as Method(status as Number) as Void;
    private var _token as String = "";
    private var _id as String = "";
    private var _missing as Array<Number> = [] as Array<Number>;

    function initialize(done as Method(status as Number) as Void) {
        _done = done;
    }

    function start() as Void {
        var token = WorkoutStore.token();
        if (token == null || RunQueue.size() == 0) {
            _done.invoke(UploadRules.UPLOAD_NOTHING_TO_SEND);
            return;
        }
        _token = token;
        next();
    }

    function onHeader(
        responseCode as Number,
        data as Dictionary or String or PersistedContent.Iterator or Null
    ) as Void {
        var status = Api.status(responseCode, data);
        if (status != 200 || !(data instanceof Dictionary)) {
            fail(status);
            return;
        }
        var body = data as Dictionary;
        if (body["complete"] == true) {
            sent();
            return;
        }
        var header = RunQueue.header(_id) as Dictionary;
        var parts = header["parts"] as Number;
        var received = body["received"] as Array?;
        _missing = [] as Array<Number>;
        for (var seq = 0; seq < parts; seq++) {
            if (received == null || received.indexOf(seq) < 0) {
                _missing.add(seq);
            }
        }
        sendPart();
    }

    function onPart(
        responseCode as Number,
        data as Dictionary or String or PersistedContent.Iterator or Null
    ) as Void {
        var status = Api.status(responseCode, data);
        if (status != 200 || !(data instanceof Dictionary)) {
            fail(status);
            return;
        }
        if ((data as Dictionary)["complete"] == true) {
            sent();
            return;
        }
        _missing = _missing.slice(1, null);
        sendPart();
    }

    private function next() as Void {
        var queue = RunQueue.queue();
        for (var i = 0; i < queue.size(); i++) {
            var id = queue[i][0] as String;
            var header = RunQueue.header(id);
            if (header != null) {
                _id = id;
                sendHeader(header);
                return;
            }
            RunQueue.remove(id);
        }
        _done.invoke(UploadRules.UPLOAD_OK);
    }

    private function sendHeader(header as Dictionary) as Void {
        Communications.makeWebRequest(
            Api.url("/connect-iq/activities"),
            header as Dictionary<Object, Object>,
            Api.jsonPost(_token),
            method(:onHeader)
        );
    }

    private function sendPart() as Void {
        if (_missing.size() == 0) {
            // Nada faltando mas o backend não fechou: o cabeçalho de novo resolve (fica `ready`).
            sendHeader(RunQueue.header(_id) as Dictionary);
            return;
        }
        var seq = _missing[0];
        var block = RunQueue.block(_id, seq);
        if (block == null) {
            // Bloco perdido (Storage limpo): a corrida não fecha nunca. Desiste dela.
            RunQueue.remove(_id);
            next();
            return;
        }
        var encoded = StringUtil.convertEncodedString(block, {
            :fromRepresentation => StringUtil.REPRESENTATION_BYTE_ARRAY,
            :toRepresentation => StringUtil.REPRESENTATION_STRING_BASE64,
        }) as String;
        block = null;
        Communications.makeWebRequest(
            Api.url("/connect-iq/activities/" + _id + "/parts"),
            { "seq" => seq, "data" => encoded },
            Api.jsonPost(_token),
            method(:onPart)
        );
    }

    private function sent() as Void {
        RunQueue.remove(_id);
        RunQueue.setLastEvent(RunQueue.EVENT_SENT, 0);
        next();
    }

    private function fail(status as Number) as Void {
        var rejected = status == 400 || status == 404;
        RunQueue.setLastEvent(rejected ? RunQueue.EVENT_REJECTED : RunQueue.EVENT_FAILED, status);
        if (rejected) {
            // O backend recusou a corrida (inválida, antiga demais): reenviar não adianta.
            RunQueue.remove(_id);
            next();
            return;
        }
        if (status == 401) {
            // Despareado no app: o relógio volta ao pareamento; a corrida fica na fila.
            WorkoutStore.reset();
        }
        _done.invoke(status);
    }
}

// Entrada do processo em segundo plano: enquanto houver corrida na fila, tenta a cada 5 min.
(:background)
class UploadService extends System.ServiceDelegate {
    private var _uploader as Uploader?;

    function initialize() {
        ServiceDelegate.initialize();
    }

    function onTemporalEvent() as Void {
        _uploader = new Uploader(method(:onDone));
        (_uploader as Uploader).start();
    }

    function onDone(status as Number) as Void {
        if (RunQueue.size() == 0) {
            Background.deleteTemporalEvent();
        }
        Background.exit(status);
    }
}
