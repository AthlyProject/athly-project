import Toybox.Lang;
import Toybox.Test;

// Limites de zona como os do UserProfile: [mín Z1, máx Z1, máx Z2, máx Z3, máx Z4, máx Z5].
function zoneLimits() as Array<Number> {
    return [100, 120, 140, 160, 175, 190];
}

(:test)
function hrZoneUsesUpperLimitsInclusive(logger as Logger) as Boolean {
    var limits = zoneLimits();
    Test.assertEqual(HrZones.zoneOf(99, limits), 0);
    Test.assertEqual(HrZones.zoneOf(100, limits), 1);
    Test.assertEqual(HrZones.zoneOf(120, limits), 1);
    Test.assertEqual(HrZones.zoneOf(121, limits), 2);
    Test.assertEqual(HrZones.zoneOf(160, limits), 3);
    Test.assertEqual(HrZones.zoneOf(175, limits), 4);
    Test.assertEqual(HrZones.zoneOf(176, limits), 5);
    Test.assertEqual(HrZones.zoneOf(205, limits), 5);
    return true;
}

(:test)
function offTargetIsSignedSecondsOutsideTheRange(logger as Logger) as Boolean {
    var target = [305, 325] as [Number, Number];
    Test.assertEqual(PaceMath.offTarget(315, target), 0);
    Test.assertEqual(PaceMath.offTarget(305, target), 0);
    Test.assertEqual(PaceMath.offTarget(325, target), 0);
    Test.assertEqual(PaceMath.offTarget(337, target), 12);
    Test.assertEqual(PaceMath.offTarget(297, target), -8);
    return true;
}

(:test)
function gaugeKeepsTheRangeInTheMiddleAndClampsTheEnds(logger as Logger) as Boolean {
    // Faixa de 20 s com margem de 20 s de cada lado: régua de 285 a 345 s/km.
    var target = [305, 325] as [Number, Number];
    Test.assertEqual(PaceMath.gaugeFraction(285, target), 0.0);
    Test.assertEqual(PaceMath.gaugeFraction(345, target), 1.0);
    Test.assert((PaceMath.gaugeFraction(315, target) - 0.5).abs() < 0.001);
    Test.assertEqual(PaceMath.gaugeFraction(200, target), 0.0);
    Test.assertEqual(PaceMath.gaugeFraction(500, target), 1.0);
    // Faixa estreita: a margem mínima de 20 s vale.
    var narrow = [300, 310] as [Number, Number];
    Test.assert((PaceMath.gaugeFraction(280, narrow)).abs() < 0.001);
    return true;
}

(:test)
function averagePaceNeedsFiftyMeters(logger as Logger) as Boolean {
    Test.assert(PaceMath.average(10000, 40.0) == null);
    Test.assert(PaceMath.average(0, 1000.0) == null);
    // 25 min em 5 km = 5:00/km
    Test.assertEqual(PaceMath.average(1500000, 5000.0), 300);
    return true;
}
