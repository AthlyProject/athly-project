import Toybox.Application;
import Toybox.Lang;

// Estado do app guardado no relógio (Application.Storage). Lido também pelo glance e pelo processo
// em segundo plano (token para enviar as corridas).
(:glance, :background)
module WorkoutStore {
    const KEY_TOKEN = "t";
    const KEY_WORKOUTS = "w";
    const KEY_LAST_SYNC = "ls";
    const KEY_PENDING_PAIRING = "pp";
    const KEY_NATIVE = "nat";
    // Plano de cada treino fica em chave própria ("p" + athlyId): o glance não carrega os planos.
    const PLAN_PREFIX = "p";

    // Registro de cada treino sincronizado: [rev, ciqId, nome, data].
    // ciqId é o Workout.getId() do FIT na lista nativa, ou null sem a opção da lista nativa.
    const REV = 0;
    const CIQ_ID = 1;
    const NAME = 2;
    const DATE = 3;

    function token() as String? {
        return Application.Storage.getValue(KEY_TOKEN) as String?;
    }

    function setToken(token as String) as Void {
        Application.Storage.setValue(KEY_TOKEN, token);
    }

    // athlyId → [rev, ciqId, nome, data]
    function workouts() as Dictionary {
        var value = Application.Storage.getValue(KEY_WORKOUTS);
        return value instanceof Dictionary ? value as Dictionary : ({} as Dictionary);
    }

    function setWorkouts(workouts as Dictionary) as Void {
        Application.Storage.setValue(KEY_WORKOUTS, workouts as Dictionary<Application.Storage.KeyType, Application.Storage.ValueType>);
    }

    // Plano do treino (GET /connect-iq/workouts/:id/plan): { rev, name, steps }.
    function plan(athlyId as String) as Dictionary? {
        var value = Application.Storage.getValue(PLAN_PREFIX + athlyId);
        return value instanceof Dictionary ? value as Dictionary : null;
    }

    function setPlan(athlyId as String, plan as Dictionary) as Void {
        Application.Storage.setValue(PLAN_PREFIX + athlyId, plan as Dictionary<Application.Storage.KeyType, Application.Storage.ValueType>);
    }

    function deletePlan(athlyId as String) as Void {
        Application.Storage.deleteValue(PLAN_PREFIX + athlyId);
    }

    // athlyId → rev dos planos guardados, para o SyncPlanner.
    function planRevs(athlyIds as Array<String>) as Dictionary {
        var revs = {} as Dictionary;
        for (var i = 0; i < athlyIds.size(); i++) {
            var plan = plan(athlyIds[i]);
            if (plan != null && plan["rev"] instanceof String) {
                revs[athlyIds[i]] = plan["rev"];
            }
        }
        return revs;
    }

    // Também mandar os treinos para a lista nativa Treino › Treinos (player da Garmin). Desligado
    // por padrão: o caminho principal é o player do app, que grava e envia a corrida.
    function nativeList() as Boolean {
        var value = Application.Storage.getValue(KEY_NATIVE);
        return value instanceof Boolean && value as Boolean;
    }

    function setNativeList(enabled as Boolean) as Void {
        Application.Storage.setValue(KEY_NATIVE, enabled);
    }

    // Registros de hoje em diante, ordenados por data: [athlyId, registro]. Só menu e glance (o
    // DateFmt usa textos que o processo em segundo plano não enxerga).
    (:typecheck(disableBackgroundCheck))
    function upcoming(todayIso as String) as Array<Array> {
        var today = DateFmt.dayNumber(todayIso);
        var all = workouts();
        var ids = all.keys();
        var list = [] as Array<Array>;
        for (var i = 0; i < ids.size(); i++) {
            var record = all[ids[i]] as Array;
            var day = DateFmt.dayNumber(record[DATE] as String);
            if (day != null && (today == null || day >= today)) {
                list.add([ids[i], record]);
            }
        }
        // Ordenação por inserção: no máximo 7 treinos.
        for (var k = 1; k < list.size(); k++) {
            var j = k;
            while (j > 0 && dayOf(list[j - 1][1] as Array) > dayOf(list[j][1] as Array)) {
                var swap = list[j - 1];
                list[j - 1] = list[j];
                list[j] = swap;
                j -= 1;
            }
        }
        return list;
    }

    (:typecheck(disableBackgroundCheck))
    function dayOf(record as Array) as Number {
        var day = DateFmt.dayNumber(record[DATE] as String);
        return day == null ? 0 : day;
    }

    // Época (segundos) da última sincronização completa.
    function lastSync() as Number? {
        return Application.Storage.getValue(KEY_LAST_SYNC) as Number?;
    }

    function setLastSync(epochSeconds as Number) as Void {
        Application.Storage.setValue(KEY_LAST_SYNC, epochSeconds);
    }

    // Código em exibição, para continuar o pareamento se o app for reaberto:
    // [código, pollToken, expiraEm (época), intervaloDoPoll (s)].
    function pendingPairing() as Array? {
        var value = Application.Storage.getValue(KEY_PENDING_PAIRING);
        return value instanceof Array ? value as Array : null;
    }

    function setPendingPairing(value as Array?) as Void {
        if (value == null) {
            Application.Storage.deleteValue(KEY_PENDING_PAIRING);
        } else {
            Application.Storage.setValue(KEY_PENDING_PAIRING, value as Array<Application.Storage.ValueType>);
        }
    }

    // Esquece o pareamento (desconectado no app ou no relógio). Corridas na fila de envio ficam
    // (RunQueue): saem depois de parear de novo.
    function reset() as Void {
        var ids = workouts().keys();
        for (var i = 0; i < ids.size(); i++) {
            deletePlan(ids[i] as String);
        }
        Application.Storage.deleteValue(KEY_TOKEN);
        Application.Storage.deleteValue(KEY_WORKOUTS);
        Application.Storage.deleteValue(KEY_LAST_SYNC);
        Application.Storage.deleteValue(KEY_PENDING_PAIRING);
    }
}
