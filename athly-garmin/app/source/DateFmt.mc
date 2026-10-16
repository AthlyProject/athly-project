import Toybox.Lang;
import Toybox.Time;
import Toybox.Time.Gregorian;
import Toybox.WatchUi;

// Datas como "YYYY-MM-DD" (o formato do backend) e rótulos curtos para a lista e o glance.
(:glance)
module DateFmt {
    // Data local do relógio.
    function todayIso() as String {
        var info = Gregorian.info(Time.now(), Time.FORMAT_SHORT);
        return iso(info.year as Number, info.month as Number, info.day as Number);
    }

    function iso(year as Number, month as Number, day as Number) as String {
        return year.format("%04d") + "-" + month.format("%02d") + "-" + day.format("%02d");
    }

    // Dias desde 1970-01-01 (algoritmo days_from_civil); null se a data não for "YYYY-MM-DD".
    function dayNumber(isoDate as String?) as Number? {
        if (isoDate == null || isoDate.length() != 10) {
            return null;
        }
        var y = part(isoDate, 0, 4);
        var m = part(isoDate, 5, 7);
        var d = part(isoDate, 8, 10);
        if (y == null || m == null || d == null || m < 1 || m > 12 || d < 1 || d > 31) {
            return null;
        }
        if (m <= 2) {
            y -= 1;
        }
        var era = (y >= 0 ? y : y - 399) / 400;
        var yoe = y - era * 400;
        var doy = (153 * ((m + 9) % 12) + 2) / 5 + d - 1;
        var doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        return era * 146097 + doe - 719468;
    }

    // "Hoje", "Amanhã" ou "Qua 07/10".
    function label(isoDate as String, todayIsoDate as String) as String {
        var day = dayNumber(isoDate);
        var today = dayNumber(todayIsoDate);
        if (day == null || today == null) {
            return isoDate;
        }
        if (day == today) {
            return WatchUi.loadResource(Rez.Strings.Today) as String;
        }
        if (day == today + 1) {
            return WatchUi.loadResource(Rez.Strings.Tomorrow) as String;
        }
        // 1970-01-01 foi uma quinta-feira (índice 4 com domingo = 0).
        var weekdays = [
            Rez.Strings.Sun, Rez.Strings.Mon, Rez.Strings.Tue, Rez.Strings.Wed,
            Rez.Strings.Thu, Rez.Strings.Fri, Rez.Strings.Sat,
        ];
        var weekday = WatchUi.loadResource(weekdays[(day + 4) % 7]) as String;
        return weekday + " " + slice(isoDate, 8, 10) + "/" + slice(isoDate, 5, 7);
    }

    // O backend nomeia os treinos "DD/MM título"; na lista a data já aparece no rótulo.
    function withoutDatePrefix(name as String) as String {
        if (name.length() > 6 && slice(name, 2, 3).equals("/") && slice(name, 5, 6).equals(" ")) {
            return slice(name, 6, name.length());
        }
        return name;
    }

    // substring sem null (o SDK tipa o retorno como String?).
    function slice(text as String, start as Number, end as Number) as String {
        var value = text.substring(start, end);
        return value == null ? "" : value;
    }

    function part(text as String, start as Number, end as Number) as Number? {
        return slice(text, start, end).toNumber();
    }
}
