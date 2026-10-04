import Toybox.Lang;

// Compara o manifesto do backend com o que já está no relógio. Sem efeitos colaterais.
module SyncPlanner {
    // desired: entradas do manifesto ({"id", "rev", "date", "name", ...}) na ordem de download.
    // stored: athlyId → [rev, ciqId, nome, data] (WorkoutStore).
    // onDevice: Workout.getId() dos treinos do app presentes no relógio.
    //
    // Devolve {:keep => athlyId → registro, :download => entradas, :remove => ciqIds}:
    // fica o que está no relógio com o mesmo rev; baixa o resto; remove do relógio tudo que não
    // ficou (rev antigo, treino fora do manifesto ou órfão sem registro).
    function plan(desired as Array<Dictionary>, stored as Dictionary, onDevice as Array<Number>) as Dictionary {
        var keep = {} as Dictionary;
        var download = [] as Array<Dictionary>;
        var keptIds = [] as Array<Number>;

        for (var i = 0; i < desired.size(); i++) {
            var entry = desired[i];
            var id = entry["id"] as String;
            var rev = entry["rev"] as String;
            var record = stored[id] as Array?;
            if (record != null
                && rev.equals(record[WorkoutStore.REV] as String)
                && onDevice.indexOf(record[WorkoutStore.CIQ_ID] as Number) >= 0) {
                keep[id] = record;
                keptIds.add(record[WorkoutStore.CIQ_ID] as Number);
            } else {
                download.add(entry);
            }
        }

        var remove = [] as Array<Number>;
        for (var k = 0; k < onDevice.size(); k++) {
            if (keptIds.indexOf(onDevice[k]) < 0) {
                remove.add(onDevice[k]);
            }
        }

        return { :keep => keep, :download => download, :remove => remove };
    }
}
