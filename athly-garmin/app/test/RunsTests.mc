import Toybox.Application;
import Toybox.Lang;
import Toybox.Test;

(:test)
function runStatusLabelsEveryBackendState(logger as Logger) as Boolean {
    Test.assert(RunStatus.label(null).equals(Ui.str(Rez.Strings.RunSent)));
    Test.assert(RunStatus.label(["ready", null, null]).equals(Ui.str(Rez.Strings.RunAwaitingApp)));
    Test.assert(RunStatus.label(["receiving", null, null]).equals(Ui.str(Rez.Strings.RunIncomplete)));
    Test.assert(RunStatus.label(["missing", null, null]).equals(Ui.str(Rez.Strings.RunMissing)));
    Test.assert(RunStatus.label(["resolved", "linked", "Intervalado"]).equals(
        Lang.format(Ui.str(Rez.Strings.RunSavedTo), ["Intervalado"])));
    Test.assert(RunStatus.label(["resolved", "linked", null]).equals(Ui.str(Rez.Strings.RunSavedToWorkout)));
    Test.assert(RunStatus.label(["resolved", "free_run", null]).equals(Ui.str(Rez.Strings.RunSavedFree)));
    Test.assert(RunStatus.label(["resolved", "dismissed", null]).equals(Ui.str(Rez.Strings.RunIgnored)));
    return true;
}

(:test)
function runStatusMergesBackendResponse(logger as Logger) as Boolean {
    var cache = { "old" => ["ready", null, null] } as Dictionary;
    var runs = [
        { "id" => "a", "status" => "resolved", "resolution" => "linked", "workoutTitle" => "Tempo" },
        { "status" => "ready" },
        "lixo",
    ];
    var merged = RunStatus.merge(cache, runs);
    Test.assert(((merged["a"] as Array)[2] as String).equals("Tempo"));
    Test.assert(merged.hasKey("old"));
    Test.assertEqual(merged.size(), 2);
    return true;
}

(:test)
function sentRunMovesToHistoryAsAwaitingApp(logger as Logger) as Boolean {
    Application.Storage.clearValues();
    RunQueue.enqueue("1792152000", { "id" => "1792152000", "start" => 1792152000, "parts" => 0 }, 5, "Tempo run");
    RunQueue.markSent("1792152000");
    Test.assertEqual(RunQueue.size(), 0);
    var history = RunQueue.history();
    Test.assertEqual(history.size(), 1);
    Test.assert((history[0][2] as String).equals("Tempo run"));
    Test.assertEqual(history[0][1] as Number, 1792152000);
    Test.assert(((RunQueue.statuses()["1792152000"] as Array)[0] as String).equals("ready"));
    Application.Storage.clearValues();
    return true;
}

(:test)
function historyKeepsFiveNewestAndTheirStatuses(logger as Logger) as Boolean {
    Application.Storage.clearValues();
    for (var i = 1; i <= RunQueue.MAX_HISTORY + 2; i++) {
        RunQueue.addHistory(i.toString(), i, "");
        var statuses = RunQueue.statuses();
        statuses[i.toString()] = ["ready", null, null];
        RunQueue.setStatuses(statuses);
    }
    var history = RunQueue.history();
    Test.assertEqual(history.size(), RunQueue.MAX_HISTORY);
    Test.assert((history[0][0] as String).equals("7"));
    // A mais antiga que saiu do histórico também sai do cache (a "1" e a "2").
    RunQueue.addHistory("8", 8, "");
    Test.assert(!RunQueue.statuses().hasKey("1"));
    Test.assert(!RunQueue.statuses().hasKey("3"));
    Application.Storage.clearValues();
    return true;
}

(:test)
function oldQueueEntryWithoutTitleStillWorks(logger as Logger) as Boolean {
    Test.assert(RunQueue.titleOf(["123", 5]).equals(""));
    Test.assert(RunQueue.titleOf(["123", 5, "Longão"]).equals("Longão"));
    Test.assert(RunStatus.title(0, "Longão").equals("Longão"));
    return true;
}
