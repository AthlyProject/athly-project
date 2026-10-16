import Toybox.Application;
import Toybox.Lang;
import Toybox.Test;

// Plano no formato do backend (fit/workout-watch-plan.ts): aquecimento, 3×(400 m + 90 s), desaquecimento.
function intervalPlan() as Array {
    return [
        { "name" => "Aquecimento", "intensity" => "warmup", "duration" => { "type" => "time", "value" => 600 }, "target" => null },
        {
            "name" => "400m forte",
            "intensity" => "active",
            "duration" => { "type" => "distance", "value" => 400 },
            "target" => { "type" => "pace", "fastSecPerKm" => 305, "slowSecPerKm" => 325 },
        },
        { "name" => "Recuperação", "intensity" => "recovery", "duration" => { "type" => "time", "value" => 90 }, "target" => { "type" => "hr", "zone" => 2 } },
        { "repeatFrom" => 1, "times" => 3 },
        { "name" => "Volta à calma", "intensity" => "cooldown", "duration" => { "type" => "open" }, "target" => null },
    ];
}

(:test)
function planExpandsRepeatsWithRepNumbers(logger as Logger) as Boolean {
    var steps = WorkoutPlan.expand(intervalPlan());
    // 1 + 3×2 + 1
    Test.assertEqual(steps.size(), 8);
    Test.assert(WorkoutPlan.title(steps[1]).equals("400m forte 1/3"));
    Test.assert(WorkoutPlan.title(steps[5]).equals("400m forte 3/3"));
    Test.assert(WorkoutPlan.title(steps[6]).equals("Recuperação 3/3"));
    Test.assert(WorkoutPlan.title(steps[0]).equals("Aquecimento"));
    Test.assertEqual(steps[1]["by"] as Number, WorkoutPlan.BY_DISTANCE);
    Test.assertEqual(steps[1]["fast"] as Number, 305);
    Test.assertEqual(steps[2]["zone"] as Number, 2);
    Test.assertEqual(steps[2]["intensity"] as Number, 4);
    Test.assertEqual(steps[7]["by"] as Number, WorkoutPlan.OPEN);
    return true;
}

(:test)
function playerAdvancesByTimeAndDistance(logger as Logger) as Boolean {
    var player = new Player(WorkoutPlan.expand(intervalPlan()));
    Test.assertEqual(player.start(0, 0.0), PlayerEvent.STEP_CHANGED);
    Test.assertEqual(player.remaining() as Number, 600);

    // Aquecimento: 595 s → aviso de fim; 600 s → próximo passo.
    Test.assertEqual(player.update(595000, 1500.0, null) & PlayerEvent.STEP_ENDING, PlayerEvent.STEP_ENDING);
    Test.assertEqual(player.update(600000, 1520.0, null), PlayerEvent.STEP_CHANGED);
    Test.assertEqual(player.index(), 1);
    Test.assertEqual(player.remaining() as Number, 400);

    // 400 m contados a partir do início do passo.
    Test.assertEqual(player.update(680000, 1800.0, 315) & PlayerEvent.STEP_CHANGED, 0);
    Test.assertEqual(player.update(690000, 1920.0, 315), PlayerEvent.STEP_CHANGED);
    Test.assertEqual(player.index(), 2);
    return true;
}

(:test)
function playerOpenStepWaitsForLapAndThenFinishes(logger as Logger) as Boolean {
    var steps = WorkoutPlan.expand(intervalPlan());
    var player = new Player(steps);
    player.start(0, 0.0);
    for (var i = 0; i < steps.size() - 1; i++) {
        player.advance(i * 1000, i * 10.0);
    }
    // Volta à calma (aberto): o tempo não termina o passo, só o botão.
    Test.assert(player.remaining() == null);
    Test.assertEqual(player.update(99999000, 99999.0, null), PlayerEvent.NONE);
    Test.assertEqual(player.advance(100000000, 100000.0), PlayerEvent.DONE);
    Test.assert(player.isDone());
    Test.assert(player.current() == null);
    return true;
}

(:test)
function playerPaceAlertWaits10sAndRepeatsEvery30s(logger as Logger) as Boolean {
    var player = new Player(WorkoutPlan.expand(intervalPlan()));
    player.start(0, 0.0);
    player.advance(0, 0.0);
    Test.assert(player.paceTarget() != null);

    // Lento (340 > 325): começa a contar em t=10, avisa em t=20.
    Test.assertEqual(player.update(10000, 10.0, 340), PlayerEvent.NONE);
    Test.assertEqual(player.update(19000, 20.0, 340), PlayerEvent.NONE);
    Test.assertEqual(player.update(20000, 21.0, 340), PlayerEvent.TOO_SLOW);
    // Não repete antes de 30 s.
    Test.assertEqual(player.update(40000, 40.0, 340), PlayerEvent.NONE);
    Test.assertEqual(player.update(50000, 50.0, 340), PlayerEvent.TOO_SLOW);
    // Voltou para a faixa: zera; rápido depois avisa TOO_FAST após 10 s.
    Test.assertEqual(player.update(51000, 52.0, 315), PlayerEvent.NONE);
    Test.assertEqual(player.update(52000, 54.0, 290), PlayerEvent.NONE);
    Test.assertEqual(player.update(62000, 90.0, 290), PlayerEvent.TOO_FAST);
    return true;
}

(:test)
function playerHasNoPaceAlertWithoutPaceTarget(logger as Logger) as Boolean {
    var player = new Player(WorkoutPlan.expand(intervalPlan()));
    player.start(0, 0.0);
    // Aquecimento sem alvo de pace: nenhum aviso, nem com pace muito lento.
    Test.assertEqual(player.update(30000, 10.0, 600), PlayerEvent.NONE);
    Test.assertEqual(player.update(60000, 20.0, 600), PlayerEvent.NONE);
    return true;
}

(:test)
function emptyPlanIsDoneImmediately(logger as Logger) as Boolean {
    var player = new Player([] as Array<Dictionary>);
    Test.assertEqual(player.start(0, 0.0), PlayerEvent.DONE);
    return true;
}

(:test)
function trackCodecWritesBigEndianPoint(logger as Logger) as Boolean {
    var buffer = new [TrackCodec.POINT_BYTES * 2]b;
    TrackCodec.encodePoint(buffer, 1, 42, -23.5613891d, -46.6565712d, 151);
    var at = TrackCodec.POINT_BYTES;
    // Mesmos bytes que o teste do backend (track-codec.spec.ts) lê.
    Test.assertEqual(buffer.decodeNumber(Lang.NUMBER_FORMAT_SINT32, { :offset => at, :endianness => Lang.ENDIAN_BIG }), 42);
    Test.assertEqual(buffer.decodeNumber(Lang.NUMBER_FORMAT_SINT32, { :offset => at + 4, :endianness => Lang.ENDIAN_BIG }), -235613891);
    Test.assertEqual(buffer.decodeNumber(Lang.NUMBER_FORMAT_SINT32, { :offset => at + 8, :endianness => Lang.ENDIAN_BIG }), -466565712);
    Test.assertEqual(buffer[at + 12], 151);
    return true;
}

(:test)
function paceWindowAveragesLast30Seconds(logger as Logger) as Boolean {
    var window = new PaceWindow(30);
    Test.assert(window.secPerKm() == null);
    for (var t = 0; t <= 40; t++) {
        window.add(t * 1000, (t * 3).toFloat());
    }
    Test.assertEqual(window.secPerKm() as Number, 333);
    return true;
}

(:test)
function lapStatsBuildsBackendLap(logger as Logger) as Boolean {
    var lap = new LapStats();
    lap.begin(600, 1700.0, 600000);
    lap.intensity = 0;
    lap.addHeartRate(150);
    lap.addHeartRate(161);
    var closed = lap.close(1, 900, 2650.5, 890000) as Dictionary;
    Test.assertEqual(closed["start"] as Number, 600);
    Test.assertEqual(closed["distance"] as Float, 950.5);
    Test.assertEqual(closed["hrAvg"] as Number, 156);
    Test.assertEqual(closed["intensity"] as Number, 0);
    return true;
}

(:test)
function runQueueQueuesAndRemovesRuns(logger as Logger) as Boolean {
    Application.Storage.clearValues();
    Test.assert(RunQueue.saveBlock("100", 0, [1, 2, 3]b));
    Test.assert(RunQueue.enqueue("100", { "id" => "100", "parts" => 1 }, 5000));
    Test.assertEqual(RunQueue.size(), 1);
    RunQueue.remove("100");
    Test.assertEqual(RunQueue.size(), 0);
    Test.assert(RunQueue.block("100", 0) == null);
    for (var i = 1; i <= RunQueue.MAX_QUEUED + 1; i++) {
        RunQueue.enqueue(i.toString(), { "id" => i.toString(), "parts" => 0 }, i);
    }
    Test.assertEqual(RunQueue.size(), RunQueue.MAX_QUEUED);
    Test.assert((RunQueue.queue()[0][0] as String).equals("2"));
    Application.Storage.clearValues();
    return true;
}
