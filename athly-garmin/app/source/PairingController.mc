import Toybox.Communications;
import Toybox.Lang;
import Toybox.PersistedContent;
import Toybox.Time;
import Toybox.Timer;

enum {
    PAIRING_REQUESTING,
    PAIRING_SHOWING,
    PAIRING_EXPIRED,
    PAIRING_ERROR,
    PAIRING_PAIRED
}

// Pareamento por código: o relógio pede um código ao backend, mostra na tela e consulta até o
// atleta digitar o código no app da Athly. Aí recebe o token do relógio.
class PairingController {
    var state as Number = PAIRING_REQUESTING;
    var code as String = "";
    var expiresAt as Number = 0;
    // Último erro de rede durante a consulta (0 = nenhum); a tela mostra, e a consulta continua.
    var pollError as Number = 0;
    var errorStatus as Number = 0;

    private var _listener as Method() as Void;
    private var _pollToken as String = "";
    private var _interval as Number = 5;
    private var _started as Boolean = false;
    private var _timer as Timer.Timer = new Timer.Timer();

    function initialize(listener as Method() as Void) {
        _listener = listener;
    }

    function start() as Void {
        if (_started) {
            if (state == PAIRING_SHOWING) {
                schedulePoll();
            }
            return;
        }
        _started = true;

        // App reaberto com um código ainda válido: continua com o mesmo.
        var pending = WorkoutStore.pendingPairing();
        if (pending != null && pending.size() == 4 && (pending[2] as Number) > now()) {
            code = pending[0] as String;
            _pollToken = pending[1] as String;
            expiresAt = pending[2] as Number;
            _interval = pending[3] as Number;
            state = PAIRING_SHOWING;
            notify();
            schedulePoll();
            return;
        }
        requestCode();
    }

    function stop() as Void {
        _timer.stop();
    }

    // Toque na tela depois de o código vencer ou de um erro: pede outro código.
    function retry() as Void {
        if (state == PAIRING_EXPIRED || state == PAIRING_ERROR) {
            requestCode();
        }
    }

    function remainingMinutes() as Number {
        var seconds = expiresAt - now();
        return seconds <= 0 ? 0 : (seconds + 59) / 60;
    }

    function onCode(
        responseCode as Number,
        data as Dictionary or String or PersistedContent.Iterator or Null
    ) as Void {
        var status = Api.status(responseCode, data);
        if (status != 200 || !(data instanceof Dictionary)) {
            errorStatus = status;
            state = PAIRING_ERROR;
            notify();
            return;
        }
        var body = data as Dictionary;
        code = body["code"] as String;
        _pollToken = body["pollToken"] as String;
        expiresAt = now() + (body["expiresInSec"] as Number);
        _interval = body["pollIntervalSec"] as Number;
        WorkoutStore.setPendingPairing([code, _pollToken, expiresAt, _interval]);
        pollError = 0;
        state = PAIRING_SHOWING;
        notify();
        schedulePoll();
    }

    function poll() as Void {
        if (now() >= expiresAt) {
            expire();
            return;
        }
        Communications.makeWebRequest(
            Api.url("/connect-iq/pairings/poll"),
            { "pollToken" => _pollToken },
            {
                :method => Communications.HTTP_REQUEST_METHOD_POST,
                :headers => Api.jsonPostHeaders(null),
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON,
            },
            method(:onPoll)
        );
    }

    function onPoll(
        responseCode as Number,
        data as Dictionary or String or PersistedContent.Iterator or Null
    ) as Void {
        var status = Api.status(responseCode, data);
        if (status != 200 || !(data instanceof Dictionary)) {
            // Celular longe ou servidor fora: continua tentando enquanto o código vale.
            pollError = status;
            notify();
            schedulePoll();
            return;
        }
        pollError = 0;
        var body = data as Dictionary;
        var result = body["status"] as String?;
        var token = body["deviceToken"] as String?;
        if (result != null && result.equals("paired") && token != null) {
            _timer.stop();
            WorkoutStore.setToken(token);
            WorkoutStore.setPendingPairing(null);
            state = PAIRING_PAIRED;
            notify();
            return;
        }
        if (result != null && result.equals("expired")) {
            expire();
            return;
        }
        // Pendente: atualiza o contador e consulta de novo.
        notify();
        schedulePoll();
    }

    private function requestCode() as Void {
        _timer.stop();
        state = PAIRING_REQUESTING;
        notify();
        Communications.makeWebRequest(
            Api.url("/connect-iq/pairings"),
            Api.deviceInfo(),
            {
                :method => Communications.HTTP_REQUEST_METHOD_POST,
                :headers => Api.jsonPostHeaders(null),
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON,
            },
            method(:onCode)
        );
    }

    private function schedulePoll() as Void {
        _timer.stop();
        _timer.start(method(:poll), _interval * 1000, false);
    }

    private function expire() as Void {
        _timer.stop();
        WorkoutStore.setPendingPairing(null);
        state = PAIRING_EXPIRED;
        notify();
    }

    private function notify() as Void {
        _listener.invoke();
    }

    private function now() as Number {
        return Time.now().value();
    }
}
