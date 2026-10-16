import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Position;
import Toybox.WatchUi;

// Tela da corrida. Página 0: passo, pace médio de 30 s (fundo verde dentro da faixa, vermelho lento,
// azul rápido), faixa e quanto falta. Página 1: FC, tempo e distância totais, próximo passo.
// Antes de iniciar: nome do treino, GPS e "START para começar".
class RunView extends WatchUi.View {
    var page as Number = 0;
    private var _run as RunSession;

    function initialize(run as RunSession) {
        View.initialize();
        _run = run;
    }

    function onShow() as Void {
        if (_run.state == RUN_READY) {
            _run.open();
        }
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        if (_run.state == RUN_READY) {
            drawReady(dc);
        } else if (page == 0) {
            drawPace(dc);
        } else {
            drawStats(dc);
        }
    }

    private function drawReady(dc as Graphics.Dc) as Void {
        var height = dc.getHeight();
        Ui.clear(dc);
        Ui.text(dc, height * 28 / 100, Graphics.FONT_SMALL, _run.title(), Graphics.COLOR_WHITE, height * 25 / 100);
        var gpsOk = _run.gpsQuality >= Position.QUALITY_USABLE;
        Ui.text(dc, height * 55 / 100, Graphics.FONT_MEDIUM,
            Ui.str(gpsOk ? Rez.Strings.GpsReady : Rez.Strings.GpsSearching),
            gpsOk ? Graphics.COLOR_GREEN : Graphics.COLOR_YELLOW, height * 15 / 100);
        Ui.text(dc, height * 78 / 100, Graphics.FONT_XTINY, Ui.str(Rez.Strings.PressStart), Graphics.COLOR_LT_GRAY, height * 12 / 100);
    }

    private function drawPace(dc as Graphics.Dc) as Void {
        var width = dc.getWidth();
        var height = dc.getHeight();
        var paceValue = _run.pace.secPerKm();
        var player = _run.player;
        var target = player != null ? player.paceTarget() : null;

        var background = Graphics.COLOR_BLACK;
        if (target != null && paceValue != null) {
            background = paceValue < target[0] ? Graphics.COLOR_BLUE
                : paceValue > target[1] ? Graphics.COLOR_RED : Graphics.COLOR_DK_GREEN;
        }
        dc.setColor(Graphics.COLOR_WHITE, background);
        dc.clear();

        // Passo atual (ou "Corrida livre" / "Treino concluído").
        var stepLine;
        if (player == null) {
            stepLine = Ui.str(Rez.Strings.FreeRun);
        } else if (player.isDone()) {
            stepLine = Ui.str(Rez.Strings.WorkoutDone);
        } else {
            var step = player.current();
            stepLine = step != null ? WorkoutPlan.title(step) : "";
        }
        if (_run.state == RUN_PAUSED) {
            stepLine = Ui.str(Rez.Strings.Paused);
        }
        Ui.text(dc, height * 18 / 100, Graphics.FONT_SMALL, stepLine, Graphics.COLOR_WHITE, height * 14 / 100);

        // Pace de 30 s, grande.
        var paceText = paceValue == null ? "--:--" : PaceMath.format(paceValue);
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(width / 2, height * 45 / 100, Graphics.FONT_NUMBER_HOT, paceText,
            Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);

        // Faixa do passo e quanto falta.
        var rangeLine = target != null
            ? PaceMath.format(target[0]) + "-" + PaceMath.format(target[1])
            : Ui.str(Rez.Strings.Pace30);
        Ui.text(dc, height * 68 / 100, Graphics.FONT_TINY, rangeLine, Graphics.COLOR_WHITE, height * 10 / 100);
        var left = remainingText(player);
        if (left != null) {
            Ui.text(dc, height * 82 / 100, Graphics.FONT_MEDIUM, left, Graphics.COLOR_WHITE, height * 12 / 100);
        }
    }

    private function drawStats(dc as Graphics.Dc) as Void {
        var height = dc.getHeight();
        Ui.clear(dc);
        var info = _run.info;
        var heartRate = info != null && info.currentHeartRate != null ? (info.currentHeartRate as Number).toString() : "--";
        var timerMs = info != null && info.timerTime != null ? info.timerTime as Number : 0;
        var distance = info != null && info.elapsedDistance != null ? info.elapsedDistance as Float : 0.0;

        Ui.text(dc, height * 20 / 100, Graphics.FONT_NUMBER_MEDIUM, heartRate, Graphics.COLOR_RED, height * 18 / 100);
        Ui.text(dc, height * 38 / 100, Graphics.FONT_XTINY, Ui.str(Rez.Strings.HeartRate), Graphics.COLOR_LT_GRAY, height * 8 / 100);
        Ui.text(dc, height * 54 / 100, Graphics.FONT_MEDIUM, clock(timerMs / 1000), Graphics.COLOR_WHITE, height * 12 / 100);
        Ui.text(dc, height * 68 / 100, Graphics.FONT_MEDIUM, (distance / 1000.0).format("%.2f") + " km", Graphics.COLOR_WHITE, height * 12 / 100);

        var player = _run.player;
        var next = player != null ? player.next() : null;
        if (next != null) {
            Ui.text(dc, height * 84 / 100, Graphics.FONT_XTINY,
                Ui.str(Rez.Strings.NextStep) + " " + WorkoutPlan.title(next), Graphics.COLOR_LT_GRAY, height * 10 / 100);
        }
    }

    private function remainingText(player as Player?) as String? {
        if (player == null || player.isDone()) {
            return null;
        }
        var step = player.current();
        var left = player.remaining();
        if (step == null) {
            return null;
        }
        if (left == null) {
            return Ui.str(Rez.Strings.LapToContinue);
        }
        return (step["by"] as Number) == WorkoutPlan.BY_TIME ? clock(left) : left + " m";
    }

    // 754 → "12:34"; 3754 → "1:02:34"
    static function clock(seconds as Number) as String {
        var hours = seconds / 3600;
        var minutes = (seconds % 3600) / 60;
        var secs = seconds % 60;
        if (hours > 0) {
            return Lang.format("$1$:$2$:$3$", [hours, minutes.format("%02d"), secs.format("%02d")]);
        }
        return Lang.format("$1$:$2$", [minutes, secs.format("%02d")]);
    }
}

// START: começa / pausa (abre o menu de pausa). BACK/LAP: avança o passo ou marca volta; antes de
// começar, volta ao menu. Cima/baixo: troca de página.
class RunDelegate extends WatchUi.BehaviorDelegate {
    private var _run as RunSession;
    private var _view as RunView;

    function initialize(run as RunSession, view as RunView) {
        BehaviorDelegate.initialize();
        _run = run;
        _view = view;
    }

    function onSelect() as Boolean {
        if (_run.state == RUN_READY || _run.state == RUN_PAUSED) {
            _run.start();
        } else if (_run.state == RUN_RECORDING) {
            _run.pause();
            PauseMenu.show(_run);
        }
        return true;
    }

    function onBack() as Boolean {
        if (_run.state == RUN_READY) {
            _run.close();
            WorkoutMenu.show();
            return true;
        }
        if (_run.state == RUN_RECORDING) {
            _run.lap();
            return true;
        }
        if (_run.state == RUN_PAUSED) {
            PauseMenu.show(_run);
        }
        return true;
    }

    function onNextPage() as Boolean {
        _view.page = (_view.page + 1) % 2;
        WatchUi.requestUpdate();
        return true;
    }

    function onPreviousPage() as Boolean {
        return onNextPage();
    }
}
