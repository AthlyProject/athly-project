import Toybox.Communications;
import Toybox.Lang;
import Toybox.PersistedContent;
import Toybox.System;
import Toybox.Time;

enum {
    FIELD_PAIRING_REQUESTING,
    FIELD_PAIRING_SHOWING,
    FIELD_PAIRING_ERROR,
    // Token recebido; falta o backend vê-lo para ativar o dispositivo.
    FIELD_PAIRING_CONFIRMING,
    FIELD_PAIRING_PAIRED
}

// Pareamento do campo de dados: mesmo fluxo do app de treinos (../source/PairingController.mc) —
// código de 8 dígitos que o atleta digita em Athly › Ajustes › Relógio Garmin. O Connect IQ isola
// cada app, então o campo tem token próprio. Campo de dados não tem Timer: o compute() (1 Hz) chama
// tick() e os pedidos saem quando vence o prazo.
class FieldPairing {
    // Depois de um erro (celular longe, servidor fora), espera isto antes de pedir de novo.
    const RETRY_SEC = 30;

    var state as Number = FIELD_PAIRING_REQUESTING;
    var code as String = "";
    var errorStatus as Number = 0;

    private var _pollToken as String = "";
    private var _expiresAt as Number = 0;
    private var _interval as Number = 5;
    private var _nextAt as Number = 0;
    private var _inFlight as Boolean = false;

    function initialize() {
        if (FieldStore.token() != null) {
            state = FIELD_PAIRING_CONFIRMING;
            return;
        }
        // Campo reaberto com um código ainda válido: continua com o mesmo.
        var pending = FieldStore.pendingPairing();
        if (pending != null && pending.size() == 4 && (pending[2] as Number) > now()) {
            code = pending[0] as String;
            _pollToken = pending[1] as String;
            _expiresAt = pending[2] as Number;
            _interval = pending[3] as Number;
            state = FIELD_PAIRING_SHOWING;
        }
    }

    // Pareado para o atleta (a tela já mostra o pace), mesmo antes da confirmação.
    function isPaired() as Boolean {
        return state == FIELD_PAIRING_CONFIRMING || state == FIELD_PAIRING_PAIRED;
    }

    function isDone() as Boolean {
        return state == FIELD_PAIRING_PAIRED;
    }

    function tick(now as Number) as Void {
        if (_inFlight || state == FIELD_PAIRING_PAIRED || now < _nextAt) {
            return;
        }
        if (state == FIELD_PAIRING_SHOWING && now >= _expiresAt) {
            FieldStore.setPendingPairing(null);
            state = FIELD_PAIRING_REQUESTING;
        }
        if (state == FIELD_PAIRING_CONFIRMING) {
            confirm();
        } else if (state == FIELD_PAIRING_SHOWING) {
            poll();
        } else {
            requestCode();
        }
    }

    // "4821 3907" — o mesmo agrupamento que o app aceita.
    function displayCode() as String {
        return code.length() == 8 ? code.substring(0, 4) + " " + code.substring(4, 8) : code;
    }

    function onCode(
        responseCode as Number,
        data as Dictionary or String or PersistedContent.Iterator or Null
    ) as Void {
        _inFlight = false;
        var status = FieldApi.status(responseCode, data);
        if (status != 200 || !(data instanceof Dictionary)) {
            fail(status);
            return;
        }
        var body = data as Dictionary;
        code = body["code"] as String;
        _pollToken = body["pollToken"] as String;
        _expiresAt = now() + (body["expiresInSec"] as Number);
        _interval = body["pollIntervalSec"] as Number;
        FieldStore.setPendingPairing([code, _pollToken, _expiresAt, _interval]);
        errorStatus = 0;
        state = FIELD_PAIRING_SHOWING;
        _nextAt = now() + _interval;
    }

    function onPoll(
        responseCode as Number,
        data as Dictionary or String or PersistedContent.Iterator or Null
    ) as Void {
        _inFlight = false;
        var status = FieldApi.status(responseCode, data);
        if (status != 200 || !(data instanceof Dictionary)) {
            // Continua mostrando o código e tentando enquanto ele vale.
            errorStatus = status;
            _nextAt = now() + _interval;
            return;
        }
        errorStatus = 0;
        var body = data as Dictionary;
        var result = body["status"] as String?;
        var token = body["deviceToken"] as String?;
        if (result != null && result.equals("paired") && token != null) {
            FieldStore.setToken(token);
            FieldStore.setPendingPairing(null);
            state = FIELD_PAIRING_CONFIRMING;
            _nextAt = now();
            return;
        }
        if (result != null && result.equals("expired")) {
            FieldStore.setPendingPairing(null);
            state = FIELD_PAIRING_REQUESTING;
            _nextAt = now();
            return;
        }
        _nextAt = now() + _interval;
    }

    function onConfirm(
        responseCode as Number,
        data as Dictionary or String or PersistedContent.Iterator or Null
    ) as Void {
        _inFlight = false;
        var status = FieldApi.status(responseCode, data);
        if (status == 200) {
            FieldStore.setTokenConfirmed();
            state = FIELD_PAIRING_PAIRED;
            return;
        }
        if (status == 401) {
            // Despareado no app antes de confirmar: começa de novo.
            FieldStore.setToken(null);
            state = FIELD_PAIRING_REQUESTING;
            _nextAt = now();
            return;
        }
        _nextAt = now() + RETRY_SEC;
    }

    private function confirm() as Void {
        var token = FieldStore.token();
        if (token == null) {
            state = FIELD_PAIRING_REQUESTING;
            return;
        }
        _inFlight = true;
        Communications.makeWebRequest(
            FieldApi.url("/connect-iq/device"),
            null,
            FieldApi.get(token),
            method(:onConfirm)
        );
    }

    private function requestCode() as Void {
        _inFlight = true;
        state = FIELD_PAIRING_REQUESTING;
        Communications.makeWebRequest(
            FieldApi.url("/connect-iq/pairings"),
            deviceInfo(),
            FieldApi.jsonPost(null),
            method(:onCode)
        );
    }

    private function poll() as Void {
        _inFlight = true;
        Communications.makeWebRequest(
            FieldApi.url("/connect-iq/pairings/poll"),
            { "pollToken" => _pollToken },
            FieldApi.jsonPost(null),
            method(:onPoll)
        );
    }

    private function fail(status as Number) as Void {
        errorStatus = status;
        state = FIELD_PAIRING_ERROR;
        _nextAt = now() + RETRY_SEC;
    }

    // Metadados do pedido de código; `kind` separa o campo do app de treinos no backend.
    private function deviceInfo() as Dictionary<Object, Object> {
        var settings = System.getDeviceSettings();
        var info = {
            "partNumber" => settings.partNumber,
            "apiLevel" => Lang.format("$1$.$2$.$3$", settings.monkeyVersion),
            "appVersion" => Config.APP_VERSION,
            "kind" => "data_field",
        } as Dictionary<Object, Object>;
        var uid = settings.uniqueIdentifier;
        if (uid != null) {
            info["uid"] = uid;
        }
        return info;
    }

    private function now() as Number {
        return Time.now().value();
    }
}
