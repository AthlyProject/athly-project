import Toybox.Lang;
import Toybox.Time;
import Toybox.Time.Gregorian;

// Situação de uma corrida enviada, como o backend responde em GET /connect-iq/activities/status:
// status missing | receiving | ready | resolved; resolução linked | free_run | dismissed.
module RunStatus {
    // Texto do menu Corridas para uma corrida enviada. `cached` = [status, resolução, treino] ou null.
    function label(cached as Array?) as String {
        if (cached == null || cached.size() < 3 || !(cached[0] instanceof String)) {
            return Ui.str(Rez.Strings.RunSent);
        }
        var status = cached[0] as String;
        var resolution = cached[1] as String?;
        var workout = cached[2] as String?;
        if (status.equals("ready")) {
            return Ui.str(Rez.Strings.RunAwaitingApp);
        }
        if (status.equals("receiving")) {
            return Ui.str(Rez.Strings.RunIncomplete);
        }
        if (status.equals("missing")) {
            return Ui.str(Rez.Strings.RunMissing);
        }
        if (resolution != null && resolution.equals("linked")) {
            return workout != null
                ? Lang.format(Ui.str(Rez.Strings.RunSavedTo), [workout])
                : Ui.str(Rez.Strings.RunSavedToWorkout);
        }
        if (resolution != null && resolution.equals("free_run")) {
            return Ui.str(Rez.Strings.RunSavedFree);
        }
        if (resolution != null && resolution.equals("dismissed")) {
            return Ui.str(Rez.Strings.RunIgnored);
        }
        return Ui.str(Rez.Strings.RunSent);
    }

    // Resposta {runs: [{id, status, resolution, workoutTitle}]} → cache de RunQueue.statuses.
    function merge(cache as Dictionary, runs as Array) as Dictionary {
        for (var i = 0; i < runs.size(); i++) {
            var run = runs[i];
            if (!(run instanceof Dictionary) || !((run as Dictionary)["id"] instanceof String)) {
                continue;
            }
            var entry = run as Dictionary;
            cache[entry["id"]] = [entry["status"], entry["resolution"], entry["workoutTitle"]];
        }
        return cache;
    }

    // "16/10 Intervalado" — data de início (do id, segundos Unix) e o nome do treino.
    function title(startedAt as Number, name as String) as String {
        var shown = name.length() > 0 ? name : Ui.str(Rez.Strings.FreeRun);
        if (startedAt <= 0) {
            return shown;
        }
        var info = Gregorian.info(new Time.Moment(startedAt), Time.FORMAT_SHORT);
        return (info.day as Number).format("%02d") + "/" + (info.month as Number).format("%02d") + " " + shown;
    }
}
