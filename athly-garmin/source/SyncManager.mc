import Toybox.Communications;
import Toybox.Lang;
import Toybox.PersistedContent;
import Toybox.Time;
import Toybox.Timer;

// Estados da sincronização (Numbers, para comparar sem conversão).
enum {
    SYNC_IDLE,
    SYNC_MANIFEST,
    SYNC_DOWNLOAD,
    SYNC_DONE,
    SYNC_FAILED,
    SYNC_UNPAIRED
}

// Códigos internos do app (os do runtime são negativos até -1002).
module SyncStatus {
    // HTTP 200 sem treino no iterator: o relógio recusou gravar (quase sempre falta de espaço).
    const NOT_SAVED = -2000;
    // makeWebRequest recusou HTTP_RESPONSE_CONTENT_TYPE_FIT neste relógio.
    const UNSUPPORTED = -2001;
    // Corpo do manifesto fora do formato esperado.
    const BAD_MANIFEST = -2002;
}

// Uma sincronização: manifesto → apaga treinos velhos → baixa os novos, um por vez → relatório.
// Só em primeiro plano: PersistedContent não está disponível em background.
class SyncManager {
    var state as Number = SYNC_IDLE;
    var status as Number = 0;
    var total as Number = 0;
    var downloaded as Number = 0;
    var failed as Number = 0;
    var storageFull as Boolean = false;

    private var _listener as Method() as Void;
    private var _token as String = "";
    private var _today as String = "";
    private var _queue as Array<Dictionary> = [] as Array<Dictionary>;
    private var _index as Number = 0;
    private var _current as Dictionary? = null;
    private var _records as Dictionary = {} as Dictionary;
    private var _removed as Number = 0;
    private var _failures as Array<Dictionary> = [] as Array<Dictionary>;
    // Identifica a requisição em andamento; respostas de requisições abandonadas são ignoradas.
    private var _seq as Number = 0;
    private var _watchdog as Timer.Timer = new Timer.Timer();

    function initialize(listener as Method() as Void) {
        _listener = listener;
    }

    function start() as Void {
        var token = WorkoutStore.token();
        if (token == null) {
            state = SYNC_UNPAIRED;
            notify();
            return;
        }
        _token = token;
        _today = DateFmt.todayIso();
        state = SYNC_MANIFEST;
        notify();

        _seq += 1;
        startWatchdog();
        Communications.makeWebRequest(
            Api.url("/connect-iq/manifest"),
            { "today" => _today },
            {
                :method => Communications.HTTP_REQUEST_METHOD_GET,
                :headers => Api.authHeaders(_token),
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON,
                :context => _seq,
            },
            method(:onManifest)
        );
    }

    function onManifest(
        responseCode as Number,
        data as Dictionary or String or PersistedContent.Iterator or Null,
        context as Object
    ) as Void {
        if (context != _seq) {
            return;
        }
        _watchdog.stop();
        var code = Api.status(responseCode, data);
        if (code == 401) {
            unpair();
            return;
        }
        if (code != 200 || !(data instanceof Dictionary)) {
            fail(code);
            return;
        }
        var workouts = (data as Dictionary)["workouts"];
        if (!(workouts instanceof Array)) {
            fail(SyncStatus.BAD_MANIFEST);
            return;
        }

        var plan = SyncPlanner.plan(workouts as Array<Dictionary>, WorkoutStore.workouts(), AppWorkouts.ids());
        _records = plan[:keep] as Dictionary;
        _queue = plan[:download] as Array<Dictionary>;
        // Apaga antes de baixar: libera espaço e tira do relógio treinos mudados ou cancelados.
        _removed = AppWorkouts.remove(plan[:remove] as Array<Number>);
        total = _queue.size();
        state = SYNC_DOWNLOAD;
        notify();
        downloadNext();
    }

    private function downloadNext() as Void {
        if (_index >= _queue.size() || storageFull) {
            complete();
            return;
        }
        var entry = _queue[_index];
        _index += 1;
        _current = entry;

        _seq += 1;
        startWatchdog();
        try {
            Communications.makeWebRequest(
                Api.url("/connect-iq/workouts/" + (entry["id"] as String) + "/fit"),
                { "today" => _today },
                {
                    :method => Communications.HTTP_REQUEST_METHOD_GET,
                    :headers => Api.authHeaders(_token),
                    :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_FIT,
                    :context => _seq,
                },
                method(:onFit)
            );
        } catch (e instanceof Lang.SymbolNotAllowedException) {
            _watchdog.stop();
            fail(SyncStatus.UNSUPPORTED);
        }
    }

    function onFit(
        responseCode as Number,
        data as Dictionary or String or PersistedContent.Iterator or Null,
        context as Object
    ) as Void {
        if (context != _seq) {
            return;
        }
        _watchdog.stop();
        var entry = _current as Dictionary;

        var workout = savedWorkout(responseCode, data);
        if (workout != null) {
            _records[entry["id"]] = [entry["rev"], workout.getId(), workout.getName(), entry["date"]];
            downloaded += 1;
        } else if (responseCode == 200 || responseCode == -1000) {
            // Sem espaço para treinos: não adianta tentar os próximos.
            storageFull = true;
            recordFailure(entry, responseCode == 200 ? SyncStatus.NOT_SAVED : -1000);
        } else if (ErrorMap.isPhoneError(responseCode)) {
            // Sem celular, todos os próximos falhariam igual.
            recordFailure(entry, responseCode);
            fail(responseCode);
            return;
        } else {
            recordFailure(entry, responseCode);
        }
        notify();
        downloadNext();
    }

    // Treino que o relógio acabou de gravar, ou null se recusou (sem espaço, FIT inválido...).
    private function savedWorkout(
        responseCode as Number,
        data as Dictionary or String or PersistedContent.Iterator or Null
    ) as PersistedContent.Workout? {
        if (responseCode != 200 || !(data instanceof PersistedContent.Iterator)) {
            return null;
        }
        var item = (data as PersistedContent.Iterator).next();
        return item instanceof PersistedContent.Workout ? item as PersistedContent.Workout : null;
    }

    function onWatchdog() as Void {
        // A resposta, se ainda chegar, será ignorada.
        _seq += 1;
        if (state == SYNC_MANIFEST) {
            fail(-300);
            return;
        }
        recordFailure(_current as Dictionary, -300);
        notify();
        downloadNext();
    }

    // Resposta do relatório: não muda nada no relógio.
    function onReport(
        responseCode as Number,
        data as Dictionary or String or PersistedContent.Iterator or Null
    ) as Void {
    }

    private function complete() as Void {
        WorkoutStore.setWorkouts(_records);
        WorkoutStore.setLastSync(Time.now().value());
        sendReport();
        state = SYNC_DONE;
        notify();
    }

    private function fail(code as Number) as Void {
        _watchdog.stop();
        if (state == SYNC_DOWNLOAD) {
            // Os treinos velhos já saíram do relógio: o registro tem que refletir isso.
            WorkoutStore.setWorkouts(_records);
            sendReport();
        }
        status = code;
        state = SYNC_FAILED;
        notify();
    }

    // Desconectado no app (token revogado): limpa tudo e volta ao pareamento.
    private function unpair() as Void {
        AppWorkouts.removeAll();
        WorkoutStore.reset();
        state = SYNC_UNPAIRED;
        notify();
    }

    private function recordFailure(entry as Dictionary, code as Number) as Void {
        failed += 1;
        if (_failures.size() < 10) {
            _failures.add({ "id" => entry["id"], "code" => code });
        }
    }

    private function sendReport() as Void {
        Communications.makeWebRequest(
            Api.url("/connect-iq/sync-reports"),
            {
                "downloaded" => downloaded,
                "removed" => _removed,
                "failures" => _failures,
                "syncedIds" => _records.keys(),
                "storageFull" => storageFull,
                "appVersion" => Config.APP_VERSION,
            },
            {
                :method => Communications.HTTP_REQUEST_METHOD_POST,
                :headers => Api.jsonPostHeaders(_token),
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON,
            },
            method(:onReport)
        );
    }

    private function startWatchdog() as Void {
        _watchdog.stop();
        _watchdog.start(method(:onWatchdog), Config.REQUEST_TIMEOUT_MS, false);
    }

    private function notify() as Void {
        _listener.invoke();
    }
}
