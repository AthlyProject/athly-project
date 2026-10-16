import Toybox.Lang;

// Eventos devolvidos por Player.update/advance (bits).
module PlayerEvent {
    const NONE = 0;
    // Começou o próximo passo (vibrar, nova volta no FIT, nova volta para a Athly).
    const STEP_CHANGED = 1;
    // Faltam 5 s ou 50 m para o fim do passo.
    const STEP_ENDING = 2;
    // Pace de 30 s fora da faixa há 10 s (no máximo um aviso a cada 30 s).
    const TOO_SLOW = 4;
    const TOO_FAST = 8;
    // Último passo terminou: a corrida continua gravando, sem alvo.
    const DONE = 16;
}

// Executa os passos de um WorkoutPlan.expand. Sem acesso a sensores nem tela: recebe tempo de
// cronômetro (ms), distância (m) e pace de 30 s a cada segundo, e devolve eventos — por isso dá
// para testar. Tempo de cronômetro não anda na pausa, então pausar não encurta o passo.
class Player {
    const ENDING_SEC = 5;
    const ENDING_M = 50;
    const ALERT_AFTER_SEC = 10;
    const ALERT_EVERY_SEC = 30;

    private var _steps as Array<Dictionary>;
    private var _index as Number = -1;
    private var _stepTimer0 as Number = 0;
    private var _stepDistance0 as Float = 0.0;
    private var _warned as Boolean = false;
    private var _outSince as Number? = null;
    private var _lastAlert as Number? = null;
    private var _done as Boolean = false;
    // Último progresso, para a tela.
    private var _timerMs as Number = 0;
    private var _distance as Float = 0.0;

    function initialize(steps as Array<Dictionary>) {
        _steps = steps;
    }

    function start(timerMs as Number, distance as Float) as Number {
        _timerMs = timerMs;
        _distance = distance;
        if (_steps.size() == 0) {
            _done = true;
            return PlayerEvent.DONE;
        }
        begin(0, timerMs, distance);
        return PlayerEvent.STEP_CHANGED;
    }

    function isDone() as Boolean {
        return _done;
    }

    function index() as Number {
        return _index;
    }

    function stepCount() as Number {
        return _steps.size();
    }

    function current() as Dictionary? {
        return _done || _index < 0 ? null : _steps[_index];
    }

    function next() as Dictionary? {
        return _done || _index + 1 >= _steps.size() ? null : _steps[_index + 1];
    }

    // Faixa [rápido, lento] em s/km do passo atual, ou null.
    function paceTarget() as [Number, Number]? {
        var step = current();
        if (step == null || !(step["fast"] instanceof Number) || !(step["slow"] instanceof Number)) {
            return null;
        }
        return [step["fast"] as Number, step["slow"] as Number];
    }

    // Segundos (BY_TIME) ou metros (BY_DISTANCE) que faltam no passo; null num passo aberto.
    function remaining() as Number? {
        var step = current();
        if (step == null) {
            return null;
        }
        var by = step["by"] as Number;
        var value = step["value"] as Number;
        if (by == WorkoutPlan.BY_TIME) {
            var left = value - (_timerMs - _stepTimer0) / 1000;
            return left < 0 ? 0 : left;
        }
        if (by == WorkoutPlan.BY_DISTANCE) {
            var leftM = value - (_distance - _stepDistance0);
            return leftM < 0 ? 0 : leftM.toNumber();
        }
        return null;
    }

    // Uma vez por segundo, com o cronômetro rodando.
    function update(timerMs as Number, distance as Float, paceSecPerKm as Number?) as Number {
        _timerMs = timerMs;
        _distance = distance;
        if (_done || _index < 0) {
            return PlayerEvent.NONE;
        }
        var step = _steps[_index];
        var by = step["by"] as Number;
        var value = step["value"] as Number;
        var events = PlayerEvent.NONE;

        if (by == WorkoutPlan.BY_TIME || by == WorkoutPlan.BY_DISTANCE) {
            var progress = by == WorkoutPlan.BY_TIME
                ? (timerMs - _stepTimer0) / 1000.0
                : distance - _stepDistance0;
            if (progress >= value) {
                return advance(timerMs, distance);
            }
            var ending = by == WorkoutPlan.BY_TIME ? ENDING_SEC : ENDING_M;
            if (!_warned && value > ending * 2 && progress >= value - ending) {
                _warned = true;
                events |= PlayerEvent.STEP_ENDING;
            }
        }
        return events | paceAlert(timerMs / 1000, paceSecPerKm);
    }

    // Botão de volta (passo aberto, ou o atleta quer pular) e fim natural do passo.
    function advance(timerMs as Number, distance as Float) as Number {
        if (_done || _index < 0) {
            return PlayerEvent.NONE;
        }
        if (_index + 1 >= _steps.size()) {
            _done = true;
            return PlayerEvent.DONE;
        }
        begin(_index + 1, timerMs, distance);
        return PlayerEvent.STEP_CHANGED;
    }

    private function begin(index as Number, timerMs as Number, distance as Float) as Void {
        _index = index;
        _stepTimer0 = timerMs;
        _stepDistance0 = distance;
        _warned = false;
        _outSince = null;
        _lastAlert = null;
    }

    // Fora da faixa por ALERT_AFTER_SEC → avisa; enquanto continuar fora, repete no máximo a cada
    // ALERT_EVERY_SEC.
    private function paceAlert(nowSec as Number, pace as Number?) as Number {
        var target = paceTarget();
        if (target == null || pace == null) {
            _outSince = null;
            return PlayerEvent.NONE;
        }
        var slow = pace > target[1];
        var fast = pace < target[0];
        if (!slow && !fast) {
            // De volta à faixa: um novo desvio avisa de novo depois de ALERT_AFTER_SEC.
            _outSince = null;
            _lastAlert = null;
            return PlayerEvent.NONE;
        }
        if (_outSince == null) {
            _outSince = nowSec;
            return PlayerEvent.NONE;
        }
        if (nowSec - (_outSince as Number) < ALERT_AFTER_SEC) {
            return PlayerEvent.NONE;
        }
        if (_lastAlert != null && nowSec - (_lastAlert as Number) < ALERT_EVERY_SEC) {
            return PlayerEvent.NONE;
        }
        _lastAlert = nowSec;
        return slow ? PlayerEvent.TOO_SLOW : PlayerEvent.TOO_FAST;
    }
}
