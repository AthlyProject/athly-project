import Foundation
import CoreLocation

/// Um split de 1 km (o último pode ser parcial). `paceSecondsPerKm` é derivado da distância
/// real do segmento — então o km parcial final também sai com pace correto.
struct KmSplit: Sendable {
    let kilometer: Int
    let startDate: Date
    let endDate: Date
    let distanceMeters: Double
    let durationSeconds: Double
    let elevationDelta: Double

    var paceSecondsPerKm: Double {
        distanceMeters > 0 ? durationSeconds / (distanceMeters / 1000.0) : 0
    }
}

/// Algoritmo único de splits por km, compartilhado entre o tracker ao vivo (`RunTracker`) e a
/// leitura de rota do Apple Health (`WorkoutDetailFetcher`). Centralizar evita que os dois
/// caminhos voltem a divergir — foi justamente a divergência entre eles que produziu o bug do
/// km 1 inflado (pace do split ~7' enquanto o pace ao vivo era 5'40-6').
///
/// O pace do split é calculado na MESMA base do tracker ao vivo:
/// - saltos de GPS rejeitados por plausibilidade de velocidade (≤ `maxPlausibleSpeed`);
/// - tempo parado / buracos de GPS (pausa, tela bloqueada) excluídos da duração;
/// - o relógio do km 1 só começa no primeiro movimento real (descarta o tempo parado inicial);
/// - fronteiras de km exatas por interpolação linear.
enum SplitCalculator {
    /// Intervalo de pausa explícita (botão de pausa). Cruzar um intervalo desses não conta nem
    /// distância (a corda entre fim e retomada é deriva sem sentido) nem tempo — espelha o
    /// caminho ao vivo, onde os fixes durante a pausa nem chegam a ser gravados.
    struct PauseInterval: Codable, Sendable, Equatable {
        let start: Date
        let end: Date
    }

    /// Velocidade máxima plausível em corrida (m/s ≈ 2:23/km). Acima disso é salto de GPS.
    static let maxPlausibleSpeed: Double = 7.0
    /// Gap (s) entre fixes acima do qual o intervalo é candidato a pausa/blackout de GPS.
    static let gapCapSeconds: Double = 6.0
    /// Velocidade (m/s) abaixo da qual um gap grande é tratado como parado (não conta tempo).
    /// Acima disso, um gap grande foi corrido de fato (ex.: blackout de GPS) e o tempo conta.
    static let stationarySpeed: Double = 0.5
    /// Distância (m) que marca o "primeiro movimento": o relógio do km 1 só começa aqui,
    /// descartando o tempo parado / GPS esquentando no início.
    static let startMovementMeters: Double = 20.0
    /// Distância mínima (m) para registrar um km parcial final.
    static let minTrailingMeters: Double = 50.0
    /// Gap máximo (s) que ainda recebe crédito de distância pela velocidade pré-gap.
    static let maxBridgeGapSeconds: Double = 90.0
    /// Janela (s de tempo em movimento) usada para estimar a velocidade pré-gap.
    static let speedLookbackSeconds: Double = 30.0

    /// Amostra normalizada da trajetória. `movingTime` é o tempo de movimento acumulado
    /// (pausas/buracos já descontados); `distance` é a distância acumulada já filtrada.
    private struct Sample {
        let date: Date
        let movingTime: Double
        let distance: Double
        let altitude: Double
    }

    /// Quebra os locations em splits de 1 km. Retorna `[]` se não houver dados suficientes.
    static func kmSplits(from locations: [CLLocation], pauses: [PauseInterval] = []) -> [KmSplit] {
        let samples = normalize(locations, pauses: pauses)
        guard samples.count >= 2 else { return [] }

        // Âncora de primeiro movimento: tudo antes de cruzar `startMovementMeters` é descartado.
        let anchor = samples.first { $0.distance >= startMovementMeters } ?? samples[0]
        let runDistance = samples.last!.distance - anchor.distance
        guard runDistance >= minTrailingMeters else { return [] }

        var splits: [KmSplit] = []
        var prev = anchor
        let fullKms = Int(runDistance / 1000.0)

        var km = 1
        while km <= fullKms {
            let boundary = anchor.distance + Double(km) * 1000.0
            let at = interpolate(samples, atDistance: boundary)
            splits.append(KmSplit(
                kilometer: km,
                startDate: prev.date,
                endDate: at.date,
                distanceMeters: 1000,
                durationSeconds: max(0, at.movingTime - prev.movingTime),
                elevationDelta: at.altitude - prev.altitude
            ))
            prev = at
            km += 1
        }

        // Km parcial final.
        let leftover = runDistance - Double(fullKms) * 1000.0
        if leftover >= minTrailingMeters {
            let last = samples.last!
            splits.append(KmSplit(
                kilometer: fullKms + 1,
                startDate: prev.date,
                endDate: last.date,
                distanceMeters: leftover,
                durationSeconds: max(0, last.movingTime - prev.movingTime),
                elevationDelta: last.altitude - prev.altitude
            ))
        }

        return splits
    }

    /// Distância real percorrida em cada intervalo de tempo, derivada da rota com o mesmo
    /// filtro de salto/pausa dos splits. Usada para dar distância (e portanto pace) real aos
    /// laps de treino — ratear a distância total pelo tempo dava a todo lap o pace médio da
    /// sessão. Retorna nil sem amostras suficientes.
    static func distances(forRanges ranges: [(start: Date, end: Date)], from locations: [CLLocation], pauses: [PauseInterval] = []) -> [Double]? {
        let samples = normalize(locations, pauses: pauses)
        guard samples.count >= 2 else { return nil }
        return ranges.map { range in
            max(0, distance(at: range.end, samples) - distance(at: range.start, samples))
        }
    }

    /// Distância acumulada (já filtrada) interpolada na data `date`.
    private static func distance(at date: Date, _ samples: [Sample]) -> Double {
        guard let first = samples.first, let last = samples.last else { return 0 }
        if date <= first.date { return first.distance }
        if date >= last.date { return last.distance }
        for i in 1..<samples.count {
            let a = samples[i - 1]
            let b = samples[i]
            if b.date >= date {
                let span = b.date.timeIntervalSince(a.date)
                guard span > 0 else { return b.distance }
                let f = date.timeIntervalSince(a.date) / span
                return a.distance + (b.distance - a.distance) * f
            }
        }
        return last.distance
    }

    // MARK: - Private

    /// Constrói a linha do tempo normalizada a partir dos fixes crus, aplicando o mesmo filtro
    /// de salto do tracker ao vivo e descontando o tempo de pausas/buracos.
    private static func normalize(_ locations: [CLLocation], pauses: [PauseInterval]) -> [Sample] {
        let sorted = locations.sorted { $0.timestamp < $1.timestamp }
        guard let first = sorted.first else { return [] }

        var samples: [Sample] = [
            Sample(date: first.timestamp, movingTime: 0, distance: 0, altitude: first.altitude)
        ]
        var lastGood = first
        var cumDistance: Double = 0
        var cumTime: Double = 0

        for i in 1..<sorted.count {
            let loc = sorted[i]
            let delta = loc.distance(from: lastGood)
            let dt = loc.timestamp.timeIntervalSince(lastGood.timestamp)
            guard dt > 0 else { continue }

            // Salto de GPS: velocidade implausível → ignora SEM avançar `lastGood`, para medir o
            // próximo ponto a partir do último bom (espelha RunTracker.processNewLocation).
            let impliedSpeed = delta / dt
            if impliedSpeed > maxPlausibleSpeed { continue }

            // O passo cruza uma pausa explícita? Então é tempo/posição "morta" entre o fim de um
            // trecho e a retomada: nem distância (a corda é deriva do GPS parado), nem tempo. Sem
            // isto o gap de uma pausa — cuja corda dá velocidade implícita ≥ 0.5 m/s — era lido
            // como blackout de GPS em movimento, creditando distância fantasma e contando o tempo
            // parado como movimento (splits não fechavam com o total). Espelha o caminho ao vivo,
            // onde os fixes durante a pausa nem são gravados.
            let crossesPause = pauses.contains { $0.start < loc.timestamp && $0.end > lastGood.timestamp }

            // Gap grande + pouco movimento → parado/pausa: não conta o tempo. Gap grande com
            // movimento real (blackout de GPS enquanto corria) → conta o tempo todo.
            let timeStep = crossesPause ? 0 : ((dt > gapCapSeconds && impliedSpeed < stationarySpeed) ? 0 : dt)

            // Gap com movimento: a corda entre o último ponto bom e este perde as curvas
            // do trajeto — contar tempo cheio com distância encurtada fazia o km do buraco
            // sair mais lento que o corrido. Credita a distância estimada pela velocidade
            // dos últimos 30s antes do gap (a corda permanece como piso; teto plausível).
            var distStep = crossesPause ? 0 : delta
            if !crossesPause,
               dt > gapCapSeconds,
               dt <= maxBridgeGapSeconds,
               impliedSpeed >= stationarySpeed,
               let speedBefore = recentSpeed(samples) {
                distStep = min(max(delta, speedBefore * dt), maxPlausibleSpeed * dt)
            }

            cumDistance += distStep
            cumTime += timeStep
            samples.append(Sample(
                date: loc.timestamp,
                movingTime: cumTime,
                distance: cumDistance,
                altitude: loc.altitude
            ))
            lastGood = loc
        }

        return samples
    }

    /// Velocidade média (m/s) nos últimos `speedLookbackSeconds` de tempo em movimento
    /// já normalizados. Nil quando não há histórico suficiente ou a velocidade não é
    /// plausível para corrida.
    private static func recentSpeed(_ samples: [Sample]) -> Double? {
        guard let last = samples.last else { return nil }
        let anchor = samples.last(where: { last.movingTime - $0.movingTime >= speedLookbackSeconds })
            ?? samples.first
        guard let anchor else { return nil }
        let timeSpan = last.movingTime - anchor.movingTime
        guard timeSpan >= 5 else { return nil }
        let speed = (last.distance - anchor.distance) / timeSpan
        guard speed >= stationarySpeed, speed <= maxPlausibleSpeed else { return nil }
        return speed
    }

    /// Interpola linearmente a amostra (tempo/data/altitude) na distância acumulada `d`.
    private static func interpolate(_ samples: [Sample], atDistance d: Double) -> Sample {
        if d <= samples.first!.distance { return samples.first! }
        if d >= samples.last!.distance { return samples.last! }

        for i in 1..<samples.count {
            let a = samples[i - 1]
            let b = samples[i]
            if b.distance >= d {
                let span = b.distance - a.distance
                guard span > 0 else { return b }
                let f = (d - a.distance) / span
                return Sample(
                    date: a.date.addingTimeInterval(b.date.timeIntervalSince(a.date) * f),
                    movingTime: a.movingTime + (b.movingTime - a.movingTime) * f,
                    distance: d,
                    altitude: a.altitude + (b.altitude - a.altitude) * f
                )
            }
        }
        return samples.last!
    }
}
