import Toybox.Lang;
import Toybox.Time;
import Toybox.Time.Gregorian;
import Toybox.WatchUi;

// Lista dos treinos baixados (de hoje em diante) + sincronizar + desconectar. Montada do que está
// salvo no relógio, então funciona sem celular.
module WorkoutMenu {
    function show() as Void {
        WatchUi.switchToView(build(), new WorkoutMenuDelegate(), WatchUi.SLIDE_IMMEDIATE);
    }

    function build() as WatchUi.Menu2 {
        var menu = new WatchUi.Menu2({ :title => Rez.Strings.AppName });
        var today = DateFmt.todayIso();
        var records = WorkoutStore.upcoming(today);
        for (var i = 0; i < records.size(); i++) {
            var record = records[i];
            menu.addItem(new WatchUi.MenuItem(
                DateFmt.label(record[WorkoutStore.DATE] as String, today),
                DateFmt.withoutDatePrefix(record[WorkoutStore.NAME] as String),
                record[WorkoutStore.CIQ_ID] as Number,
                null
            ));
        }
        if (records.size() == 0) {
            menu.addItem(new WatchUi.MenuItem(Rez.Strings.NoWorkouts, null, :none, null));
        }
        menu.addItem(new WatchUi.MenuItem(Rez.Strings.SyncNow, lastSyncLabel(), :sync, null));
        menu.addItem(new WatchUi.MenuItem(Rez.Strings.Disconnect, null, :disconnect, null));
        return menu;
    }

    // "Última: 08:12" (hoje) ou "Última: 04/10".
    function lastSyncLabel() as String? {
        var last = WorkoutStore.lastSync();
        if (last == null) {
            return null;
        }
        var info = Gregorian.info(new Time.Moment(last), Time.FORMAT_SHORT);
        var day = info.day as Number;
        var month = info.month as Number;
        var when = DateFmt.iso(info.year as Number, month, day).equals(DateFmt.todayIso())
            ? (info.hour as Number).format("%02d") + ":" + (info.min as Number).format("%02d")
            : day.format("%02d") + "/" + month.format("%02d");
        return Lang.format(Ui.str(Rez.Strings.LastSync), [when]);
    }
}

class WorkoutMenuDelegate extends WatchUi.Menu2InputDelegate {
    // Mantém o timer do DeferredIntent vivo até disparar.
    private var _deferred as DeferredIntent? = null;

    function initialize() {
        Menu2InputDelegate.initialize();
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var id = item.getId();
        if (id == :sync) {
            var sync = new SyncView();
            WatchUi.switchToView(sync, new SyncDelegate(sync), WatchUi.SLIDE_IMMEDIATE);
        } else if (id == :disconnect) {
            Disconnect.confirm();
        } else if (id instanceof Number) {
            var workout = AppWorkouts.find(id as Number);
            if (workout == null) {
                var status = new StatusView(Rez.Strings.WorkoutMissing, false);
                WatchUi.pushView(status, new StatusDelegate(status), WatchUi.SLIDE_LEFT);
            } else {
                // Abre no player de treino nativo; o próprio relógio pede confirmação.
                _deferred = new DeferredIntent(workout.toIntent());
            }
        }
    }
}
