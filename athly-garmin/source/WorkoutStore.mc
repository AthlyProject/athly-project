import Toybox.Application;
import Toybox.Lang;

// Estado do app guardado no relógio (Application.Storage). Lido também pelo glance.
(:glance)
module WorkoutStore {
    const KEY_TOKEN = "t";
    const KEY_WORKOUTS = "w";
    const KEY_LAST_SYNC = "ls";
    const KEY_PENDING_PAIRING = "pp";

    // Registro de cada treino sincronizado: [rev, ciqId, nome, data].
    // ciqId é o Workout.getId() do treino gravado no relógio.
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

    // Registros de hoje em diante, ordenados por data.
    function upcoming(todayIso as String) as Array<Array> {
        var today = DateFmt.dayNumber(todayIso);
        var records = workouts().values();
        var list = [] as Array<Array>;
        for (var i = 0; i < records.size(); i++) {
            var record = records[i] as Array;
            var day = DateFmt.dayNumber(record[DATE] as String);
            if (day != null && (today == null || day >= today)) {
                list.add(record);
            }
        }
        // Ordenação por inserção: no máximo 7 treinos.
        for (var k = 1; k < list.size(); k++) {
            var j = k;
            while (j > 0 && dayOf(list[j - 1]) > dayOf(list[j])) {
                var swap = list[j - 1];
                list[j - 1] = list[j];
                list[j] = swap;
                j -= 1;
            }
        }
        return list;
    }

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

    // Esquece o pareamento (desconectado no app ou no relógio).
    function reset() as Void {
        Application.Storage.deleteValue(KEY_TOKEN);
        Application.Storage.deleteValue(KEY_WORKOUTS);
        Application.Storage.deleteValue(KEY_LAST_SYNC);
        Application.Storage.deleteValue(KEY_PENDING_PAIRING);
    }
}
