import Toybox.Lang;
import Toybox.Test;

// Rodar: ver "Testes" no README (monkeyc --unit-test + monkeydo ... /t).

(:test)
function dayNumberCountsDaysSinceEpoch(logger as Logger) as Boolean {
    Test.assertEqual(DateFmt.dayNumber("1970-01-01") as Number, 0);
    Test.assertEqual(DateFmt.dayNumber("1970-01-02") as Number, 1);
    // 2024 é bissexto: de 28/02 a 01/03 são 2 dias.
    Test.assertEqual((DateFmt.dayNumber("2024-03-01") as Number) - (DateFmt.dayNumber("2024-02-28") as Number), 2);
    Test.assertEqual((DateFmt.dayNumber("2026-10-07") as Number) - (DateFmt.dayNumber("2026-10-06") as Number), 1);
    return true;
}

(:test)
function dayNumberRejectsMalformedDates(logger as Logger) as Boolean {
    Test.assert(DateFmt.dayNumber("07/10/2026") == null);
    Test.assert(DateFmt.dayNumber("2026-13-01") == null);
    Test.assert(DateFmt.dayNumber(null) == null);
    return true;
}

(:test)
function isoPadsMonthAndDay(logger as Logger) as Boolean {
    Test.assert(DateFmt.iso(2026, 3, 7).equals("2026-03-07"));
    return true;
}

(:test)
function withoutDatePrefixStripsBackendDate(logger as Logger) as Boolean {
    Test.assert(DateFmt.withoutDatePrefix("07/10 Intervalado 6x400m").equals("Intervalado 6x400m"));
    Test.assert(DateFmt.withoutDatePrefix("Rodagem").equals("Rodagem"));
    return true;
}

(:test)
function plannerKeepsUnchangedAndReplacesChanged(logger as Logger) as Boolean {
    var desired = [
        { "id" => "a", "rev" => "r1" },
        { "id" => "b", "rev" => "r2" },
    ] as Array<Dictionary>;
    var stored = {
        "a" => ["r1", 11, "07/10 A", "2026-10-07"],
        "b" => ["old", 12, "08/10 B", "2026-10-08"],
    } as Dictionary;

    var plan = SyncPlanner.plan(desired, stored, [11, 12, 13] as Array<Number>);

    var keep = plan[:keep] as Dictionary;
    var download = plan[:download] as Array<Dictionary>;
    var remove = plan[:remove] as Array<Number>;
    Test.assertEqual(keep.size(), 1);
    Test.assert(keep.hasKey("a"));
    Test.assertEqual(download.size(), 1);
    Test.assert((download[0]["id"] as String).equals("b"));
    // 12: versão antiga de "b"; 13: treino do app sem registro (órfão).
    Test.assertEqual(remove.size(), 2);
    Test.assert(remove.indexOf(12) >= 0);
    Test.assert(remove.indexOf(13) >= 0);
    return true;
}

(:test)
function plannerRedownloadsWorkoutDeletedOnWatch(logger as Logger) as Boolean {
    var desired = [{ "id" => "a", "rev" => "r1" }] as Array<Dictionary>;
    var stored = { "a" => ["r1", 11, "07/10 A", "2026-10-07"] } as Dictionary;

    // O atleta apagou o treino 11 direto no relógio.
    var plan = SyncPlanner.plan(desired, stored, [] as Array<Number>);

    Test.assertEqual((plan[:keep] as Dictionary).size(), 0);
    Test.assertEqual((plan[:download] as Array).size(), 1);
    Test.assertEqual((plan[:remove] as Array).size(), 0);
    return true;
}

(:test)
function plannerRemovesEverythingWhenManifestIsEmpty(logger as Logger) as Boolean {
    var stored = { "a" => ["r1", 11, "07/10 A", "2026-10-07"] } as Dictionary;

    var plan = SyncPlanner.plan([] as Array<Dictionary>, stored, [11] as Array<Number>);

    Test.assertEqual((plan[:download] as Array).size(), 0);
    Test.assertEqual((plan[:remove] as Array).size(), 1);
    return true;
}

(:test)
function errorMapGroupsRuntimeAndHttpCodes(logger as Logger) as Boolean {
    Test.assert(ErrorMap.message(-104) == Rez.Strings.ErrPhone);
    Test.assert(ErrorMap.message(-2) == Rez.Strings.ErrPhone);
    Test.assert(ErrorMap.message(401) == Rez.Strings.ErrUnpaired);
    Test.assert(ErrorMap.message(-300) == Rez.Strings.ErrTimeout);
    Test.assert(ErrorMap.message(-1000) == Rez.Strings.ErrStorage);
    Test.assert(ErrorMap.message(SyncStatus.NOT_SAVED) == Rez.Strings.ErrStorage);
    Test.assert(ErrorMap.message(503) == Rez.Strings.ErrServer);
    Test.assert(ErrorMap.message(SyncStatus.UNSUPPORTED) == Rez.Strings.ErrUnsupported);
    Test.assert(ErrorMap.message(418) == Rez.Strings.ErrGeneric);
    return true;
}

(:test)
function apiStatusReadsErrorEnvelope(logger as Logger) as Boolean {
    // O backend responde erro do relógio como 200 + {statusCode}.
    Test.assertEqual(Api.status(200, { "statusCode" => 401, "code" => "CIQ_DEVICE_UNAUTHORIZED" }), 401);
    Test.assertEqual(Api.status(200, { "v" => 1, "workouts" => [] }), 200);
    Test.assertEqual(Api.status(-104, null), -104);
    return true;
}
