import Toybox.Activity;
import Toybox.Background;
import Toybox.Communications;
import Toybox.Lang;
import Toybox.PersistedContent;
import Toybox.StringUtil;
import Toybox.System;
import Toybox.Time;

// Quais corridas da fila podem ir para o backend.
(:background)
module UploadRules {
    // Sem o evento "atividade concluída" até aqui, a corrida foi descartada no relógio.
    const UNCONFIRMED_TTL_SEC = 6 * 3600;
    // O evento chega quando a atividade é salva, perto do onTimerReset que finaliza a corrida — a
    // ordem entre os dois não é documentada. A janela cobre o evento um pouco antes e o atleta que
    // demora na tela de resumo.
    const CONFIRM_BEFORE_SEC = 10 * 60;
    const CONFIRM_AFTER_SEC = 30 * 60;
    // Envio enquanto houver corrida na fila: a primeira tentativa sai 5 min depois de salvar mesmo
    // se o evento "atividade concluída" vier antes da corrida entrar na fila (ou nem vier).
    const RETRY_INTERVAL_SEC = 5 * 60;

    // Resultado de um envio (os demais valores são o status HTTP ou o código de erro do runtime).
    const UPLOAD_OK = 0;
    const UPLOAD_NOTHING_TO_SEND = 1;

    // Uma corrida finalizada pode ir para o backend (ver Config.REQUIRE_COMPLETED_EVENT).
    function isConfirmed(finalizedAt as Number, completedAt as Number?) as Boolean {
        return !Config.REQUIRE_COMPLETED_EVENT || completedNear(finalizedAt, completedAt);
    }

    // O evento "atividade concluída" veio perto da finalização da corrida.
    function completedNear(finalizedAt as Number, completedAt as Number?) as Boolean {
        return completedAt != null && completedAt >= finalizedAt - CONFIRM_BEFORE_SEC
            && completedAt <= finalizedAt + CONFIRM_AFTER_SEC;
    }

    // Agenda as tentativas de envio (repetem a cada RETRY_INTERVAL_SEC até a fila esvaziar).
    function scheduleRetries() as Void {
        try {
            Background.registerForTemporalEvent(new Time.Duration(RETRY_INTERVAL_SEC));
        } catch (e) {
            // Intervalo recusado (evento recente demais): o próximo evento ou campo aberto tenta.
        }
    }

    function isAbandoned(finalizedAt as Number, now as Number) as Boolean {
        return now - finalizedAt > UNCONFIRMED_TTL_SEC;
    }
}

// Envia as corridas da fila, uma request por vez (o processo em segundo plano tem 64 KB):
// cabeçalho → blocos que faltam → próxima corrida. O backend responde ao cabeçalho com os blocos
// que já tem, então um envio interrompido continua de onde parou na próxima tentativa.
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
        var token = FieldStore.token();
        if (token == null) {
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
        var status = FieldApi.status(responseCode, data);
        if (status != 200 || !(data instanceof Dictionary)) {
            fail(status);
            return;
        }
        var body = data as Dictionary;
        if (body["complete"] == true) {
            FieldStore.remove(_id);
            next();
            return;
        }
        var header = FieldStore.header(_id) as Dictionary;
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
        var status = FieldApi.status(responseCode, data);
        if (status != 200 || !(data instanceof Dictionary)) {
            fail(status);
            return;
        }
        if ((data as Dictionary)["complete"] == true) {
            FieldStore.remove(_id);
            next();
            return;
        }
        _missing = _missing.slice(1, null);
        sendPart();
    }

    // Próxima corrida confirmada da fila; apaga as descartadas.
    private function next() as Void {
        var now = Time.now().value();
        var completedAt = FieldStore.lastCompletedAt();
        var queue = FieldStore.queue();
        for (var i = 0; i < queue.size(); i++) {
            var id = queue[i][0] as String;
            var finalizedAt = queue[i][1] as Number;
            if (UploadRules.isConfirmed(finalizedAt, completedAt)) {
                var header = FieldStore.header(id);
                if (header != null) {
                    _id = id;
                    sendHeader(header);
                    return;
                }
                FieldStore.remove(id);
            } else if (UploadRules.isAbandoned(finalizedAt, now)) {
                FieldStore.remove(id);
            }
        }
        _done.invoke(UploadRules.UPLOAD_OK);
    }

    private function sendHeader(header as Dictionary) as Void {
        Communications.makeWebRequest(
            FieldApi.url("/connect-iq/activities"),
            header as Dictionary<Object, Object>,
            FieldApi.jsonPost(_token),
            method(:onHeader)
        );
    }

    private function sendPart() as Void {
        if (_missing.size() == 0) {
            // Nada faltando mas o backend não fechou: o cabeçalho de novo resolve (fica `ready`).
            sendHeader(FieldStore.header(_id) as Dictionary);
            return;
        }
        var seq = _missing[0];
        var block = FieldStore.block(_id, seq);
        if (block == null) {
            // Bloco perdido (Storage limpo): a corrida não fecha nunca. Desiste dela.
            FieldStore.remove(_id);
            next();
            return;
        }
        var encoded = StringUtil.convertEncodedString(block, {
            :fromRepresentation => StringUtil.REPRESENTATION_BYTE_ARRAY,
            :toRepresentation => StringUtil.REPRESENTATION_STRING_BASE64,
        }) as String;
        block = null;
        Communications.makeWebRequest(
            FieldApi.url("/connect-iq/activities/" + _id + "/parts"),
            { "seq" => seq, "data" => encoded },
            FieldApi.jsonPost(_token),
            method(:onPart)
        );
    }

    private function fail(status as Number) as Void {
        if (status == 401) {
            // Despareado no app: o campo volta a mostrar o código. A corrida fica guardada.
            FieldStore.setToken(null);
        } else if (status == 400 || status == 404) {
            // O backend recusou a corrida (inválida, antiga demais): reenviar não adianta.
            FieldStore.remove(_id);
            next();
            return;
        }
        _done.invoke(status);
    }
}

// Entrada do processo em segundo plano: roda quando uma atividade é salva e, enquanto houver
// corrida na fila, a cada 10 min (celular longe na hora de salvar).
(:background)
class UploadService extends System.ServiceDelegate {
    private var _uploader as Uploader?;

    function initialize() {
        ServiceDelegate.initialize();
    }

    function onActivityCompleted(activity as { :sport as Activity.Sport, :subSport as Activity.SubSport }) as Void {
        FieldStore.setLastCompletedAt(Time.now().value());
        run();
    }

    function onTemporalEvent() as Void {
        run();
    }

    function onDone(status as Number) as Void {
        if (FieldStore.hasQueued()) {
            UploadRules.scheduleRetries();
        } else {
            Background.deleteTemporalEvent();
        }
        Background.exit(status);
    }

    private function run() as Void {
        _uploader = new Uploader(method(:onDone));
        (_uploader as Uploader).start();
    }
}
