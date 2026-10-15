import Toybox.Application;
import Toybox.Lang;
import Toybox.Test;

// Rodar: ver "Campo de dados" no README (monkeyc --unit-test + monkeydo ... -t).

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
    // O primeiro ponto continua zerado.
    Test.assertEqual(buffer.decodeNumber(Lang.NUMBER_FORMAT_SINT32, { :offset => 4, :endianness => Lang.ENDIAN_BIG }), 0);
    return true;
}

(:test)
function trackCodecClampsHeartRate(logger as Logger) as Boolean {
    Test.assertEqual(TrackCodec.clampHeartRate(null), 0);
    Test.assertEqual(TrackCodec.clampHeartRate(-3), 0);
    Test.assertEqual(TrackCodec.clampHeartRate(300), 255);
    Test.assertEqual(TrackCodec.clampHeartRate(150), 150);
    return true;
}

(:test)
function paceWindowAveragesLast30Seconds(logger as Logger) as Boolean {
    var window = new PaceWindow(30);
    Test.assert(window.secPerKm() == null);
    // 3 m/s por 40 s: a janela usa só os últimos 30 s → 333 s/km (5:33).
    for (var t = 0; t <= 40; t++) {
        window.add(t * 1000, (t * 3).toFloat());
    }
    Test.assertEqual(window.secPerKm() as Number, 333);
    window.reset();
    Test.assert(window.secPerKm() == null);
    return true;
}

(:test)
function paceWindowIgnoresStandingStill(logger as Logger) as Boolean {
    var window = new PaceWindow(30);
    for (var t = 0; t < 10; t++) {
        window.add(t * 1000, 100.0 + t * 0.2);
    }
    Test.assert(window.secPerKm() == null);
    return true;
}

(:test)
function paceRangeFromSpeedTarget(logger as Logger) as Boolean {
    // FIT da Athly: 5:05–5:25/km = 3279–3077 mm/s (low = lento).
    var range = PaceMath.paceRange(3077, 3279) as [Number, Number];
    Test.assertEqual(range[0], 305);
    Test.assertEqual(range[1], 325);
    // Ordem invertida e m/s também funcionam.
    var meters = PaceMath.paceRange(4, 3) as [Number, Number];
    Test.assertEqual(meters[0], 250);
    Test.assertEqual(meters[1], 333);
    Test.assert(PaceMath.paceRange(0, 3279) == null);
    return true;
}

(:test)
function paceFormatPadsSeconds(logger as Logger) as Boolean {
    Test.assert(PaceMath.format(305).equals("5:05"));
    Test.assert(PaceMath.format(600).equals("10:00"));
    return true;
}

(:test)
function lapStatsBuildsBackendLap(logger as Logger) as Boolean {
    var lap = new LapStats();
    lap.begin(600, 1700.0, 600000);
    lap.intensity = 0;
    lap.addHeartRate(150);
    lap.addHeartRate(161);
    lap.addHeartRate(null);
    lap.addHeartRate(300);
    var closed = lap.close(1, 900, 2650.5, 890000) as Dictionary;
    Test.assertEqual(closed["index"] as Number, 1);
    Test.assertEqual(closed["start"] as Number, 600);
    Test.assertEqual(closed["end"] as Number, 900);
    Test.assertEqual(closed["distance"] as Float, 950.5);
    Test.assertEqual(closed["timer"] as Float, 290.0);
    Test.assertEqual(closed["hrAvg"] as Number, 156);
    Test.assertEqual(closed["hrMax"] as Number, 161);
    Test.assertEqual(closed["intensity"] as Number, 0);
    return true;
}

(:test)
function lapStatsSkipsEmptyLap(logger as Logger) as Boolean {
    var lap = new LapStats();
    lap.begin(100, 500.0, 100000);
    Test.assert(lap.close(0, 100, 500.0, 100400) == null);
    // Sem FC e sem intensidade: os campos opcionais ficam de fora (o backend recusa campo extra,
    // mas aceita ausente).
    var closed = lap.close(0, 160, 650.0, 160000) as Dictionary;
    Test.assert(!closed.hasKey("hrAvg"));
    Test.assert(!closed.hasKey("intensity"));
    return true;
}

(:test)
function uploadRulesNeedCompletedEventRightAfterFinish(logger as Logger) as Boolean {
    var finishedAt = 1000000;
    Test.assert(!UploadRules.isConfirmed(finishedAt, null));
    Test.assert(UploadRules.isConfirmed(finishedAt, finishedAt + 5));
    Test.assert(UploadRules.isConfirmed(finishedAt, finishedAt + 29 * 60));
    // Evento de outra atividade, bem depois: esta foi descartada.
    Test.assert(!UploadRules.isConfirmed(finishedAt, finishedAt + 31 * 60));
    // O evento pode chegar um pouco antes do onTimerReset.
    Test.assert(UploadRules.isConfirmed(finishedAt, finishedAt - 120));
    Test.assert(!UploadRules.isConfirmed(finishedAt, finishedAt - 11 * 60));
    Test.assert(UploadRules.isAbandoned(finishedAt, finishedAt + 7 * 3600));
    Test.assert(!UploadRules.isAbandoned(finishedAt, finishedAt + 3600));
    return true;
}

(:test)
function fieldStoreQueuesAndRemovesRuns(logger as Logger) as Boolean {
    Application.Storage.clearValues();
    Test.assert(FieldStore.saveBlock("100", 0, [1, 2, 3]b));
    Test.assert(FieldStore.saveBlock("100", 1, [4, 5, 6]b));
    Test.assert(FieldStore.enqueue("100", { "id" => "100", "parts" => 2 }, 5000));
    Test.assertEqual(FieldStore.queue().size(), 1);
    Test.assert((FieldStore.block("100", 1) as ByteArray).equals([4, 5, 6]b));

    FieldStore.remove("100");
    Test.assertEqual(FieldStore.queue().size(), 0);
    Test.assert(FieldStore.header("100") == null);
    Test.assert(FieldStore.block("100", 0) == null);
    Test.assert(FieldStore.block("100", 1) == null);
    return true;
}

(:test)
function fieldStoreKeepsOnlyNewestRuns(logger as Logger) as Boolean {
    Application.Storage.clearValues();
    for (var i = 1; i <= FieldStore.MAX_QUEUED + 1; i++) {
        FieldStore.enqueue(i.toString(), { "id" => i.toString(), "parts" => 0 }, i);
    }
    var queue = FieldStore.queue();
    Test.assertEqual(queue.size(), FieldStore.MAX_QUEUED);
    Test.assert((queue[0][0] as String).equals("2"));
    Test.assert(FieldStore.header("1") == null);
    Application.Storage.clearValues();
    return true;
}
