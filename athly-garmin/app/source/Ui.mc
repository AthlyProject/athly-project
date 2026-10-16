import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

// Desenho de texto centralizado que cabe em telas redondas e quadradas.
module Ui {
    const BRAND = 0x0EA5E9;

    function str(id as ResourceId) as String {
        return WatchUi.loadResource(id) as String;
    }

    function clear(dc as Graphics.Dc) as Void {
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
        dc.clear();
    }

    // Texto quebrado em linhas para caber em 80% da largura e `maxHeight` de altura.
    function text(
        dc as Graphics.Dc,
        y as Number,
        font as Graphics.FontType,
        value as String,
        color as Graphics.ColorType,
        maxHeight as Number
    ) as Void {
        var width = (dc.getWidth() * 0.8).toNumber();
        var fitted = Graphics.fitTextToArea(value, font, width, maxHeight, true);
        dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        dc.drawText(
            dc.getWidth() / 2,
            y,
            font,
            fitted == null ? value : fitted,
            Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER
        );
    }

    // Tela de mensagem: texto principal e, opcionalmente, uma dica menor embaixo.
    function message(dc as Graphics.Dc, primary as String, secondary as String?) as Void {
        var height = dc.getHeight();
        clear(dc);
        text(dc, height * 42 / 100, Graphics.FONT_SMALL, primary, Graphics.COLOR_WHITE, height * 45 / 100);
        if (secondary != null) {
            text(dc, height * 78 / 100, Graphics.FONT_XTINY, secondary, Graphics.COLOR_LT_GRAY, height * 15 / 100);
        }
    }
}
