import Toybox.Activity;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Position;
import Toybox.System;
import Toybox.WatchUi;

// Tela da corrida. Página 0: passo e quanto falta, pace de 30 s com a régua da faixa (anel da borda
// verde dentro, vermelho lento, azul rápido), FC com zona, cadência, tempo e distância. Página 1:
// médias (pace, FC, cadência), barra de zonas, tempo, distância e próximo passo.
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
            drawMain(dc);
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

    // Página principal: passo e quanto falta, pace de 30 s com a régua da faixa, FC (zona) e
    // cadência, tempo e distância. O anel da borda mostra de relance o pace em relação à faixa.
    private function drawMain(dc as Graphics.Dc) as Void {
        var width = dc.getWidth();
        var height = dc.getHeight();
        var info = _run.info;
        var player = _run.player;
        var paceValue = _run.pace.secPerKm();
        var target = player != null ? player.paceTarget() : null;
        var status = paceColor(paceValue, target);

        Ui.clear(dc);
        if (status != null) {
            drawRing(dc, status);
        }

        Ui.text(dc, height * 15 / 100, Graphics.FONT_XTINY, stepLine(player), Graphics.COLOR_LT_GRAY, height * 8 / 100);
        // Num treino, quanto falta no passo; numa corrida livre, o pace médio.
        var second = remainingText(player);
        if (player == null) {
            var average = PaceMath.average(timerMs(info), distance(info));
            second = average != null ? Ui.str(Rez.Strings.AvgPace) + " " + PaceMath.format(average) : null;
        }
        if (second != null) {
            Ui.text(dc, height * 24 / 100, Graphics.FONT_SMALL, second, Graphics.COLOR_WHITE, height * 9 / 100);
        }

        dc.setColor(status != null ? status : Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(width / 2, height * 41 / 100, paceFont(dc), paceValue == null ? "--:--" : PaceMath.format(paceValue),
            Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);

        if (target != null) {
            drawGauge(dc, height * 57 / 100, paceValue, target);
        } else {
            Ui.text(dc, height * 57 / 100, Graphics.FONT_XTINY, Ui.str(Rez.Strings.Pace30), Graphics.COLOR_LT_GRAY, height * 7 / 100);
        }

        var heartRate = info != null ? info.currentHeartRate : null;
        var hr = heartRateLabel(heartRate, player);
        field(dc, width * 33 / 100, height * 73 / 100, heartRate != null ? heartRate.toString() : "--",
            hr[0] as String, hr[1] as Graphics.ColorType);
        var cadence = info != null ? info.currentCadence : null;
        field(dc, width * 67 / 100, height * 73 / 100, cadence != null ? cadence.toString() : "--",
            Ui.str(Rez.Strings.Cadence), Graphics.COLOR_WHITE);

        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(width * 37 / 100, height * 88 / 100, Graphics.FONT_SMALL, clock(timerMs(info) / 1000),
            Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
        dc.drawText(width * 63 / 100, height * 88 / 100, Graphics.FONT_SMALL, km(distance(info)),
            Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
    }

    // Página de médias: pace médio, barra de zonas, FC e cadência médias, tempo, distância e o
    // próximo passo.
    private function drawStats(dc as Graphics.Dc) as Void {
        var width = dc.getWidth();
        var height = dc.getHeight();
        var info = _run.info;
        Ui.clear(dc);

        Ui.text(dc, height * 15 / 100, Graphics.FONT_XTINY, Ui.str(Rez.Strings.AvgPace), Graphics.COLOR_LT_GRAY, height * 8 / 100);
        var average = PaceMath.average(timerMs(info), distance(info));
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(width / 2, height * 28 / 100, Graphics.FONT_NUMBER_MILD, average == null ? "--:--" : PaceMath.format(average),
            Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);

        var zones = _run.hrZones;
        var heartRate = info != null ? info.currentHeartRate : null;
        if (zones != null) {
            drawZoneBar(dc, height * 42 / 100, heartRate != null ? HrZones.zoneOf(heartRate, zones) : 0);
        }

        var averageHr = info != null ? info.averageHeartRate : null;
        field(dc, width * 33 / 100, height * 55 / 100, averageHr != null ? averageHr.toString() : "--",
            Ui.str(Rez.Strings.AvgHeartRate), Graphics.COLOR_LT_GRAY);
        var averageCadence = info != null ? info.averageCadence : null;
        field(dc, width * 67 / 100, height * 55 / 100, averageCadence != null ? averageCadence.toString() : "--",
            Ui.str(Rez.Strings.AvgCadence), Graphics.COLOR_LT_GRAY);

        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(width * 35 / 100, height * 72 / 100, Graphics.FONT_MEDIUM, clock(timerMs(info) / 1000),
            Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
        dc.drawText(width * 65 / 100, height * 72 / 100, Graphics.FONT_MEDIUM, km(distance(info)),
            Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);

        var player = _run.player;
        var next = player != null ? player.next() : null;
        if (next != null) {
            Ui.text(dc, height * 86 / 100, Graphics.FONT_XTINY,
                Ui.str(Rez.Strings.NextStep) + " " + WorkoutPlan.title(next), Graphics.COLOR_LT_GRAY, height * 9 / 100);
        }
    }

    // Passo atual, "Corrida livre", "Treino concluído" ou "Pausado".
    private function stepLine(player as Player?) as String {
        if (_run.state == RUN_PAUSED) {
            return Ui.str(Rez.Strings.Paused);
        }
        if (player == null) {
            return Ui.str(Rez.Strings.FreeRun);
        }
        if (player.isDone()) {
            return Ui.str(Rez.Strings.WorkoutDone);
        }
        var step = player.current();
        return step != null ? WorkoutPlan.title(step) : "";
    }

    // Verde na faixa, azul rápido, vermelho lento; null sem alvo de pace ou sem pace ainda.
    private function paceColor(pace as Number?, target as [Number, Number]?) as Graphics.ColorType? {
        if (pace == null || target == null) {
            return null;
        }
        var off = PaceMath.offTarget(pace, target);
        return off > 0 ? Graphics.COLOR_RED : off < 0 ? Graphics.COLOR_BLUE : Graphics.COLOR_GREEN;
    }

    // Maior fonte numérica que cabe em ~24% da altura: o tamanho varia muito entre MIP e AMOLED.
    private function paceFont(dc as Graphics.Dc) as Graphics.FontType {
        var fonts = [Graphics.FONT_NUMBER_HOT, Graphics.FONT_NUMBER_MEDIUM] as Array<Graphics.FontType>;
        for (var i = 0; i < fonts.size(); i++) {
            if (dc.getFontHeight(fonts[i]) <= dc.getHeight() * 24 / 100) {
                return fonts[i];
            }
        }
        return Graphics.FONT_NUMBER_MILD;
    }

    // Anel na borda (contorno arredondado em tela retangular).
    private function drawRing(dc as Graphics.Dc, color as Graphics.ColorType) as Void {
        var width = dc.getWidth();
        var height = dc.getHeight();
        var pen = width * 3 / 100;
        dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        dc.setPenWidth(pen);
        if (System.getDeviceSettings().screenShape == System.SCREEN_SHAPE_RECTANGLE) {
            dc.drawRoundedRectangle(pen / 2, pen / 2, width - pen, height - pen, width / 6);
        } else {
            dc.drawCircle(width / 2, height / 2, width / 2 - pen / 2);
        }
        dc.setPenWidth(1);
    }

    // Régua do pace: rápido (azul) | faixa (verde) | lento (vermelho), com um marcador no pace
    // atual. Embaixo, quanto está fora da faixa ("+0:12" lento, "-0:08" rápido) ou a própria faixa.
    private function drawGauge(dc as Graphics.Dc, y as Number, pace as Number?, target as [Number, Number]) as Void {
        var width = dc.getWidth();
        var barWidth = width * 64 / 100;
        var left = (width - barWidth) / 2;
        var barHeight = dc.getHeight() * 3 / 100;
        var top = y - barHeight / 2;
        var bandStart = left + (barWidth * PaceMath.gaugeFraction(target[0], target)).toNumber();
        var bandEnd = left + (barWidth * PaceMath.gaugeFraction(target[1], target)).toNumber();
        dc.setColor(Graphics.COLOR_BLUE, Graphics.COLOR_TRANSPARENT);
        dc.fillRectangle(left, top, bandStart - left, barHeight);
        dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
        dc.fillRectangle(bandStart, top, bandEnd - bandStart, barHeight);
        dc.setColor(Graphics.COLOR_RED, Graphics.COLOR_TRANSPARENT);
        dc.fillRectangle(bandEnd, top, left + barWidth - bandEnd, barHeight);

        var label = PaceMath.format(target[0]) + "-" + PaceMath.format(target[1]);
        var labelColor = Graphics.COLOR_LT_GRAY;
        if (pace != null) {
            var x = left + (barWidth * PaceMath.gaugeFraction(pace, target)).toNumber();
            var size = barHeight;
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.fillPolygon([[x - size, top - size - 2], [x + size, top - size - 2], [x, top - 1]]);
            dc.fillRectangle(x - 1, top, 3, barHeight);
            var off = PaceMath.offTarget(pace, target);
            if (off != 0) {
                label = (off > 0 ? "+" : "-") + PaceMath.format(off.abs());
                labelColor = off > 0 ? Graphics.COLOR_RED : Graphics.COLOR_BLUE;
            } else {
                labelColor = Graphics.COLOR_GREEN;
            }
        }
        var labelHeight = dc.getFontHeight(Graphics.FONT_XTINY);
        Ui.text(dc, top + barHeight + labelHeight / 2, Graphics.FONT_XTINY, label, labelColor, labelHeight);
    }

    // Cinco segmentos nas cores das zonas; o da zona atual fica mais alto.
    private function drawZoneBar(dc as Graphics.Dc, y as Number, zone as Number) as Void {
        var width = dc.getWidth();
        var barWidth = width * 64 / 100;
        var gap = 3;
        var segment = (barWidth - 4 * gap) / 5;
        var left = (width - barWidth) / 2;
        var low = dc.getHeight() * 2 / 100;
        for (var z = 1; z <= 5; z++) {
            var segmentHeight = z == zone ? low * 3 : low;
            dc.setColor(HrZones.color(z), Graphics.COLOR_TRANSPARENT);
            dc.fillRectangle(left + (z - 1) * (segment + gap), y - segmentHeight / 2, segment, segmentHeight);
        }
    }

    // [rótulo, cor] da FC: a zona na cor dela; num passo com zona alvo, "Z3 · alvo Z2" em verde
    // dentro do alvo, azul abaixo e vermelho acima. Sem zonas no perfil, só o rótulo "FC".
    private function heartRateLabel(heartRate as Number?, player as Player?) as Array {
        var zones = _run.hrZones;
        if (heartRate == null || zones == null) {
            return [Ui.str(Rez.Strings.HeartRate), Graphics.COLOR_WHITE];
        }
        var zone = HrZones.zoneOf(heartRate, zones);
        var step = player != null && !player.isDone() ? player.current() : null;
        var targetZone = step != null && step["zone"] instanceof Number ? step["zone"] as Number : null;
        if (targetZone == null) {
            return ["Z" + zone, HrZones.color(zone)];
        }
        var color = zone < targetZone ? Graphics.COLOR_BLUE : zone > targetZone ? Graphics.COLOR_RED : Graphics.COLOR_GREEN;
        return [Lang.format(Ui.str(Rez.Strings.ZoneTarget), [zone, targetZone]), color];
    }

    // Valor (FONT_MEDIUM, na cor do rótulo quando é a FC) com um rótulo pequeno embaixo, centrados em x.
    private function field(dc as Graphics.Dc, x as Number, y as Number, value as String, label as String, labelColor as Graphics.ColorType) as Void {
        var valueColor = labelColor == Graphics.COLOR_LT_GRAY ? Graphics.COLOR_WHITE : labelColor;
        dc.setColor(valueColor, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x, y, Graphics.FONT_MEDIUM, value, Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
        dc.setColor(labelColor, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x, y + dc.getFontHeight(Graphics.FONT_MEDIUM) * 45 / 100 + dc.getFontHeight(Graphics.FONT_XTINY) * 40 / 100,
            Graphics.FONT_XTINY, label, Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
    }

    private function timerMs(info as Activity.Info?) as Number {
        return info != null && info.timerTime != null ? info.timerTime as Number : 0;
    }

    private function distance(info as Activity.Info?) as Float {
        return info != null && info.elapsedDistance != null ? info.elapsedDistance as Float : 0.0;
    }

    // 5240.0 → "5.24 km"
    private function km(meters as Float) as String {
        return (meters / 1000.0).format("%.2f") + " km";
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
