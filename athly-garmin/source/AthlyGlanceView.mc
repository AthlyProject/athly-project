import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

// Glance: próximo treino salvo no relógio ("Hoje: Intervalado 6x400m").
(:glance)
class AthlyGlanceView extends WatchUi.GlanceView {
    function initialize() {
        GlanceView.initialize();
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        var line = nextWorkoutLine();
        var height = dc.getHeight();
        var fitted = Graphics.fitTextToArea(line, Graphics.FONT_TINY, dc.getWidth(), height / 2, true);

        dc.setColor(0x0EA5E9, Graphics.COLOR_TRANSPARENT);
        dc.drawText(0, height / 4, Graphics.FONT_XTINY, "ATHLY", Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER);
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(0, height * 2 / 3, Graphics.FONT_TINY, fitted == null ? line : fitted, Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER);
    }

    private function nextWorkoutLine() as String {
        var today = DateFmt.todayIso();
        var upcoming = WorkoutStore.upcoming(today);
        if (upcoming.size() == 0) {
            return WatchUi.loadResource(Rez.Strings.GlanceEmpty) as String;
        }
        var next = upcoming[0];
        return DateFmt.label(next[WorkoutStore.DATE] as String, today) + ": "
            + DateFmt.withoutDatePrefix(next[WorkoutStore.NAME] as String);
    }
}
