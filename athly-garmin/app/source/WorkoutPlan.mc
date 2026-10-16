import Toybox.Lang;

// Plano do backend (GET /connect-iq/workouts/:id/plan, ver fit/workout-watch-plan.ts) → lista plana
// de passos que o Player executa. Repetições ({repeatFrom, times}) são expandidas como o FIT faria.
module WorkoutPlan {
    // Duração do passo.
    const BY_TIME = 0;
    const BY_DISTANCE = 1;
    const OPEN = 2;

    // Activity.WorkoutIntensity, o mesmo número que o campo de dados mandava ao backend.
    function intensityOf(name as String?) as Number? {
        if (name == null) {
            return null;
        }
        if (name.equals("active")) {
            return 0;
        }
        if (name.equals("rest")) {
            return 1;
        }
        if (name.equals("warmup")) {
            return 2;
        }
        if (name.equals("cooldown")) {
            return 3;
        }
        if (name.equals("recovery")) {
            return 4;
        }
        return null;
    }

    // Passo executável: {
    //   "name" String, "notes" String?, "intensity" Number?,
    //   "by" BY_*, "value" Number (s ou m; 0 se OPEN),
    //   "fast"/"slow" Number? (faixa de pace s/km), "zone" Number? (zona de FC),
    //   "rep"/"reps" Number? (repetição atual/total, dentro de um bloco repetido)
    // }
    function expand(steps as Array) as Array<Dictionary> {
        var out = [] as Array<Dictionary>;
        // Índice em `out` onde cada passo de `steps` apareceu pela primeira vez.
        var firstAt = {} as Dictionary;
        for (var i = 0; i < steps.size(); i++) {
            var raw = steps[i] as Dictionary;
            if (raw.hasKey("repeatFrom")) {
                var from = raw["repeatFrom"] as Number;
                var times = raw["times"] as Number;
                var start = firstAt[from] as Number?;
                if (start == null || times < 2) {
                    continue;
                }
                var block = out.slice(start, null);
                for (var b = 0; b < block.size(); b++) {
                    block[b]["rep"] = 1;
                    block[b]["reps"] = times;
                }
                for (var rep = 2; rep <= times; rep++) {
                    for (var c = 0; c < block.size(); c++) {
                        var copy = copyOf(block[c]);
                        copy["rep"] = rep;
                        out.add(copy);
                    }
                }
                continue;
            }
            firstAt[i] = out.size();
            out.add(stepOf(raw));
        }
        return out;
    }

    function stepOf(raw as Dictionary) as Dictionary {
        var step = {
            "name" => raw["name"] instanceof String ? raw["name"] : "",
            "intensity" => intensityOf(raw["intensity"] as String?),
            "by" => OPEN,
            "value" => 0,
        } as Dictionary;
        if (raw["notes"] instanceof String) {
            step["notes"] = raw["notes"];
        }
        var duration = raw["duration"] as Dictionary?;
        if (duration != null && duration["value"] instanceof Number && (duration["value"] as Number) > 0) {
            var type = duration["type"] as String?;
            if (type != null && type.equals("time")) {
                step["by"] = BY_TIME;
                step["value"] = duration["value"];
            } else if (type != null && type.equals("distance")) {
                step["by"] = BY_DISTANCE;
                step["value"] = duration["value"];
            }
        }
        var target = raw["target"] as Dictionary?;
        if (target != null) {
            var kind = target["type"] as String?;
            if (kind != null && kind.equals("pace")
                && target["fastSecPerKm"] instanceof Number && target["slowSecPerKm"] instanceof Number) {
                step["fast"] = target["fastSecPerKm"];
                step["slow"] = target["slowSecPerKm"];
            } else if (kind != null && kind.equals("hr") && target["zone"] instanceof Number) {
                step["zone"] = target["zone"];
            }
        }
        return step;
    }

    function copyOf(step as Dictionary) as Dictionary {
        var copy = {} as Dictionary;
        var keys = step.keys();
        for (var i = 0; i < keys.size(); i++) {
            copy[keys[i]] = step[keys[i]];
        }
        return copy;
    }

    // "400m forte 3/6"
    function title(step as Dictionary) as String {
        var name = step["name"] as String;
        var rep = step["rep"] as Number?;
        return rep != null ? name + " " + rep + "/" + (step["reps"] as Number) : name;
    }
}
