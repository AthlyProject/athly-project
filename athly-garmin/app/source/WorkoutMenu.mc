import Toybox.Lang;
import Toybox.Time;
import Toybox.Time.Gregorian;
import Toybox.WatchUi;

// Menu principal: treinos sincronizados (de hoje em diante), corrida livre, corridas a enviar,
// sincronizar, a opção da lista nativa da Garmin e desconectar. Montado do que está salvo no
// relógio, então funciona sem celular.
module WorkoutMenu {
    function show() as Void {
        WatchUi.switchToView(build(), new WorkoutMenuDelegate(), WatchUi.SLIDE_IMMEDIATE);
    }

    function build() as WatchUi.Menu2 {
        // Versão no título: confirma qual build está instalado.
        var menu = new WatchUi.Menu2({ :title => Ui.str(Rez.Strings.AppName) + " " + Config.APP_VERSION });
        var today = DateFmt.todayIso();
        var upcoming = WorkoutStore.upcoming(today);
        for (var i = 0; i < upcoming.size(); i++) {
            var record = upcoming[i][1] as Array;
            menu.addItem(new WatchUi.MenuItem(
                DateFmt.label(record[WorkoutStore.DATE] as String, today),
                DateFmt.withoutDatePrefix(record[WorkoutStore.NAME] as String),
                upcoming[i][0] as String,
                null
            ));
        }
        if (upcoming.size() == 0) {
            menu.addItem(new WatchUi.MenuItem(Rez.Strings.NoWorkouts, null, :none, null));
        }
        menu.addItem(new WatchUi.MenuItem(Rez.Strings.FreeRun, null, :free, null));
        var pending = RunQueue.size();
        if (pending > 0) {
            menu.addItem(new WatchUi.MenuItem(
                Lang.format(Ui.str(Rez.Strings.ToSend), [pending]), null, :upload, null));
        }
        menu.addItem(new WatchUi.MenuItem(Rez.Strings.SyncNow, lastSyncLabel(), :sync, null));
        if (AppWorkouts.isSupported()) {
            menu.addItem(new WatchUi.ToggleMenuItem(
                Rez.Strings.NativeList, Rez.Strings.NativeListHint, :nativeList, WorkoutStore.nativeList(), null));
        }
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

    // Abre o treino no player do app (grava e envia para a Athly).
    function startWithAthly(athlyId as String, plan as Dictionary, name as String) as Void {
        var steps = WorkoutPlan.expand(plan["steps"] as Array);
        var run = new RunSession(DateFmt.withoutDatePrefix(name), athlyId, steps);
        var view = new RunView(run);
        WatchUi.switchToView(view, new RunDelegate(run, view), WatchUi.SLIDE_IMMEDIATE);
    }

    function startFreeRun() as Void {
        var run = new RunSession(Ui.str(Rez.Strings.FreeRun), null, null);
        var view = new RunView(run);
        WatchUi.switchToView(view, new RunDelegate(run, view), WatchUi.SLIDE_IMMEDIATE);
    }
}

class WorkoutMenuDelegate extends WatchUi.Menu2InputDelegate {
    // Mantém o timer do DeferredIntent vivo até disparar.
    (:typecheck(false))
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
        } else if (id == :free) {
            WorkoutMenu.startFreeRun();
        } else if (id == :upload) {
            var upload = new UploadView(false);
            WatchUi.switchToView(upload, new UploadDelegate(upload), WatchUi.SLIDE_IMMEDIATE);
        } else if (id == :nativeList) {
            // Liga/desliga a lista nativa e sincroniza para baixar ou apagar os FITs.
            WorkoutStore.setNativeList((item as WatchUi.ToggleMenuItem).isEnabled());
            var sync = new SyncView();
            WatchUi.switchToView(sync, new SyncDelegate(sync), WatchUi.SLIDE_IMMEDIATE);
        } else if (id instanceof String) {
            open(id as String);
        }
    }

    private function open(athlyId as String) as Void {
        var record = WorkoutStore.workouts()[athlyId] as Array?;
        if (record == null) {
            return;
        }
        var name = record[WorkoutStore.NAME] as String;
        var plan = WorkoutStore.plan(athlyId);
        var ciqId = record[WorkoutStore.CIQ_ID] as Number?;
        var garminWorkout = ciqId != null && AppWorkouts.isSupported() ? AppWorkouts.find(ciqId) : null;
        if (plan != null && garminWorkout != null) {
            WorkoutActionMenu.show(athlyId, plan, name, garminWorkout);
        } else if (plan != null) {
            WorkoutMenu.startWithAthly(athlyId, plan, name);
        } else if (garminWorkout != null) {
            _deferred = new DeferredIntent(garminWorkout.toIntent());
        } else {
            var status = new StatusView(Rez.Strings.WorkoutMissing, false);
            WatchUi.pushView(status, new StatusDelegate(status), WatchUi.SLIDE_LEFT);
        }
    }
}

// Treino com os dois players disponíveis: o do app (grava e envia) ou o nativo da Garmin.
module WorkoutActionMenu {
    function show(athlyId as String, plan as Dictionary, name as String, garminWorkout as Toybox.PersistedContent.Workout) as Void {
        var menu = new WatchUi.Menu2({ :title => DateFmt.withoutDatePrefix(name) });
        menu.addItem(new WatchUi.MenuItem(Rez.Strings.StartWithAthly, Rez.Strings.StartWithAthlyHint, :athly, null));
        menu.addItem(new WatchUi.MenuItem(Rez.Strings.OpenInGarmin, Rez.Strings.OpenInGarminHint, :garmin, null));
        WatchUi.pushView(menu, new WorkoutActionDelegate(athlyId, plan, name, garminWorkout), WatchUi.SLIDE_LEFT);
    }
}

class WorkoutActionDelegate extends WatchUi.Menu2InputDelegate {
    private var _athlyId as String;
    private var _plan as Dictionary;
    private var _name as String;
    private var _garminWorkout as Toybox.PersistedContent.Workout;
    (:typecheck(false))
    private var _deferred as DeferredIntent? = null;

    function initialize(athlyId as String, plan as Dictionary, name as String, garminWorkout as Toybox.PersistedContent.Workout) {
        Menu2InputDelegate.initialize();
        _athlyId = athlyId;
        _plan = plan;
        _name = name;
        _garminWorkout = garminWorkout;
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        if (item.getId() == :athly) {
            WatchUi.popView(WatchUi.SLIDE_IMMEDIATE);
            WorkoutMenu.startWithAthly(_athlyId, _plan, _name);
        } else {
            // Abre no player de treino nativo; o próprio relógio pede confirmação.
            _deferred = new DeferredIntent(_garminWorkout.toIntent());
        }
    }
}
