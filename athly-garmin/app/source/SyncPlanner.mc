import Toybox.Lang;

// Compara o manifesto do backend com o que já está no relógio. Sem efeitos colaterais.
module SyncPlanner {
    // desired: entradas do manifesto ({"id", "rev", "date", "name", ...}) na ordem de download.
    // stored: athlyId → [rev, ciqId ou null, nome, data] (WorkoutStore).
    // planRevs: athlyId → rev do plano JSON guardado (o que o player do app executa).
    // onDevice: Workout.getId() dos treinos do app na lista nativa do relógio.
    // native: a opção "também na lista de treinos da Garmin" está ligada.
    //
    // Devolve:
    //   :plans  entradas cujo plano falta ou mudou (sempre baixado: é o que o app executa)
    //   :fits   entradas a baixar como FIT para a lista nativa (só com `native`)
    //   :keepCiq athlyId → ciqId dos FITs que ficam no relógio
    //   :remove ciqIds a apagar da lista nativa (rev antigo, fora do manifesto, órfão, ou tudo
    //           quando `native` está desligado)
    function plan(
        desired as Array<Dictionary>,
        stored as Dictionary,
        planRevs as Dictionary,
        onDevice as Array<Number>,
        useNative as Boolean
    ) as Dictionary {
        var plans = [] as Array<Dictionary>;
        var fits = [] as Array<Dictionary>;
        var keepCiq = {} as Dictionary;
        var keptIds = [] as Array<Number>;

        for (var i = 0; i < desired.size(); i++) {
            var entry = desired[i];
            var id = entry["id"] as String;
            var rev = entry["rev"] as String;
            var planRev = planRevs[id] as String?;
            if (planRev == null || !planRev.equals(rev)) {
                plans.add(entry);
            }
            if (!useNative) {
                continue;
            }
            var record = stored[id] as Array?;
            var ciqId = record != null ? record[WorkoutStore.CIQ_ID] as Number? : null;
            if (record != null && ciqId != null
                && rev.equals(record[WorkoutStore.REV] as String)
                && onDevice.indexOf(ciqId) >= 0) {
                keepCiq[id] = ciqId;
                keptIds.add(ciqId);
            } else {
                fits.add(entry);
            }
        }

        var remove = [] as Array<Number>;
        for (var k = 0; k < onDevice.size(); k++) {
            if (keptIds.indexOf(onDevice[k]) < 0) {
                remove.add(onDevice[k]);
            }
        }

        return { :plans => plans, :fits => fits, :keepCiq => keepCiq, :remove => remove };
    }
}
