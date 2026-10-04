import Toybox.Lang;
import Toybox.PersistedContent;

// Treinos que este app gravou na lista nativa do relógio (PersistedContent).
module AppWorkouts {
    // Relógio grava treinos FIT baixados e permite ao app listar os próprios.
    function isSupported() as Boolean {
        return (Toybox has :PersistedContent) && (PersistedContent has :getAppWorkouts);
    }

    // Workout.getId() de todos os treinos deste app no relógio.
    function ids() as Array<Number> {
        var ids = [] as Array<Number>;
        var iterator = PersistedContent.getAppWorkouts();
        var item = iterator.next();
        while (item != null) {
            if (item instanceof PersistedContent.Workout) {
                ids.add((item as PersistedContent.Workout).getId());
            }
            item = iterator.next();
        }
        return ids;
    }

    function find(ciqId as Number) as PersistedContent.Workout? {
        var iterator = PersistedContent.getAppWorkouts();
        var item = iterator.next();
        while (item != null) {
            if (item instanceof PersistedContent.Workout && (item as PersistedContent.Workout).getId() == ciqId) {
                return item as PersistedContent.Workout;
            }
            item = iterator.next();
        }
        return null;
    }

    // Apaga do relógio os treinos do app com esses ids; devolve quantos saíram.
    function remove(ciqIds as Array<Number>) as Number {
        if (ciqIds.size() == 0) {
            return 0;
        }
        var removed = 0;
        var iterator = PersistedContent.getAppWorkouts();
        var item = iterator.next();
        while (item != null) {
            if (item instanceof PersistedContent.Workout) {
                var workout = item as PersistedContent.Workout;
                if (ciqIds.indexOf(workout.getId()) >= 0 && (workout has :remove)) {
                    workout.remove();
                    removed += 1;
                }
            }
            item = iterator.next();
        }
        return removed;
    }

    function removeAll() as Number {
        return remove(ids());
    }
}
