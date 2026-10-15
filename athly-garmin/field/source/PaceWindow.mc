import Toybox.Lang;

// Pace médio dos últimos ~30 s (tempo de cronômetro ÷ distância). O pace instantâneo do GPS oscila
// ±5–10 s/km e faz o alerta da Garmin disparar mesmo com o atleta no ritmo certo; a média de 30 s é
// o que o atleta consegue seguir.
class PaceWindow {
    // Abaixo disso a distância percorrida é ruído de GPS.
    const MIN_DISTANCE_M = 5.0;
    const MIN_SAMPLES = 6;

    private var _times as Array<Number>;
    private var _distances as Array<Float>;
    private var _size as Number;
    private var _count as Number = 0;
    private var _next as Number = 0;

    // Uma amostra por segundo (compute): `seconds + 1` amostras cobrem `seconds` segundos.
    function initialize(seconds as Number) {
        _size = seconds + 1;
        _times = new Array<Number>[_size];
        _distances = new Array<Float>[_size];
    }

    // Recomeça a janela (troca de passo: o pace do tiro não pode misturar com a recuperação).
    function reset() as Void {
        _count = 0;
        _next = 0;
    }

    function add(timerMs as Number?, distanceM as Float?) as Void {
        if (timerMs == null || distanceM == null) {
            return;
        }
        _times[_next] = timerMs;
        _distances[_next] = distanceM;
        _next = (_next + 1) % _size;
        if (_count < _size) {
            _count++;
        }
    }

    // s/km, ou null enquanto não há amostras suficientes (início do passo, parado).
    function secPerKm() as Number? {
        if (_count < MIN_SAMPLES) {
            return null;
        }
        var newest = (_next - 1 + _size) % _size;
        var oldest = _count < _size ? 0 : _next;
        var dt = (_times[newest] - _times[oldest]) / 1000.0;
        var dd = _distances[newest] - _distances[oldest];
        if (dd < MIN_DISTANCE_M || dt <= 0) {
            return null;
        }
        return (dt / dd * 1000.0 + 0.5).toNumber();
    }
}

module PaceMath {
    // Faixa de pace [rápido, lento] em s/km a partir do alvo de velocidade do passo, ou null.
    // A unidade de targetValueLow/High não é documentada: o FIT da Athly grava mm/s
    // (custom_target_speed, escala 1000). Valores até 100 são tratados como m/s.
    function paceRange(low as Number, high as Number) as [Number, Number]? {
        var slow = secPerKm(low < high ? low : high);
        var fast = secPerKm(low < high ? high : low);
        if (slow == null || fast == null) {
            return null;
        }
        return [fast, slow];
    }

    function secPerKm(speed as Number) as Number? {
        if (speed <= 0) {
            return null;
        }
        var metersPerSecond = speed > 100 ? speed / 1000.0 : speed.toFloat();
        return (1000.0 / metersPerSecond + 0.5).toNumber();
    }

    // 314 → "5:14"
    function format(secPerKm as Number) as String {
        return Lang.format("$1$:$2$", [secPerKm / 60, (secPerKm % 60).format("%02d")]);
    }
}
