import Foundation

/// Acumula ganho de elevação a partir de fixes de GPS rejeitando o ruído que inflava o número.
///
/// O método antigo (somar todo delta de altitude > 0.5 m por fix) tinha dois defeitos opostos:
/// - **inflava** com o aquecimento do GPS — o altímetro "assenta" nos primeiros segundos e produz
///   saltos impossíveis (ex.: +92 m em 2 s), todos contados como ganho;
/// - **subestimava** subidas graduais reais — cada passo < 0.5 m caía abaixo do limiar por amostra.
///
/// Aqui o filtro tem três camadas:
/// 1. **Gate de precisão vertical**: descarta fixes com `verticalAccuracy` ruim (ou inválida, ≤ 0),
///    que é onde mora o lixo do aquecimento.
/// 2. **Suavização EMA** da altitude: remove o jitter de alta frequência.
/// 3. **Deadband (histerese)**: credita ganho só quando a altitude suavizada sobe um limiar acima
///    do vale corrente, e segue o vale na descida. O limiar é sobre a subida *acumulada* (não por
///    passo), então uma rampa lenta de muitos passinhos soma; o jitter não.
struct ElevationAccumulator {
    /// `verticalAccuracy` máxima aceita (m). Acima disso (ou ≤ 0, que o CoreLocation usa para
    /// altitude inválida) o fix é ignorado. O aquecimento do GPS costuma reportar vAcc alta.
    var maxVerticalAccuracy: Double = 8
    /// Fator da média móvel exponencial (0..1). Mais baixo suaviza mais.
    var smoothingAlpha: Double = 0.3
    /// Subida acumulada (m) acima do vale corrente necessária para creditar ganho.
    var gainThreshold: Double = 2.0

    private(set) var gain: Double = 0
    private var smoothed: Double?
    private var reference: Double?

    /// Altitude suavizada atual (m), ou nil enquanto nenhum fix válido foi aceito.
    var smoothedAltitude: Double? { smoothed }

    /// Processa um fix. Fixes reprovados no gate de vAcc não afetam nada.
    mutating func add(altitude: Double, verticalAccuracy: Double) {
        guard verticalAccuracy > 0, verticalAccuracy <= maxVerticalAccuracy else { return }

        let s: Double
        if let prev = smoothed {
            s = prev + smoothingAlpha * (altitude - prev)
        } else {
            s = altitude
        }
        smoothed = s

        guard let ref = reference else {
            reference = s
            return
        }
        if s - ref >= gainThreshold {
            gain += s - ref
            reference = s
        } else if s < ref {
            // Descendo: acompanha o vale para não exigir reescalar a partir de um pico antigo.
            reference = s
        }
    }

    mutating func reset() {
        gain = 0
        smoothed = nil
        reference = nil
    }
}
