import XCTest
import CoreLocation
@testable import AthlyRunner

/// Cobre o bug de reconciliação: na presença de pausas, os splits offline (`SplitCalculator`)
/// creditavam distância fantasma no buraco da pausa e contavam o tempo parado como movimento,
/// fazendo a soma dos splits estourar o total. Passar as janelas de pausa zera os dois.
final class SplitCalculatorTests: XCTestCase {

    private let base = Date(timeIntervalSince1970: 1_700_000_000)
    /// 1 grau de latitude ≈ 111_320 m. Passo de ~6 m por fix de 2 s ⇒ ~3 m/s (~5:33/km).
    private let metersPerDegLat = 111_320.0

    private func fix(latIndex: Double, alt: Double = 100, vAcc: Double = 5, at t: TimeInterval) -> CLLocation {
        let lat = -25.42 + (latIndex * 6.0) / metersPerDegLat
        return CLLocation(
            coordinate: CLLocationCoordinate2D(latitude: lat, longitude: -49.35),
            altitude: alt,
            horizontalAccuracy: 5,
            verticalAccuracy: vAcc,
            course: 0,
            speed: 3,
            timestamp: base.addingTimeInterval(t)
        )
    }

    /// Trajeto reto contínuo: `count` fixes, 6 m e 2 s entre eles.
    private func continuousTrack(count: Int) -> [CLLocation] {
        (0..<count).map { i in fix(latIndex: Double(i), at: Double(i) * 2.0) }
    }

    private func distSum(_ splits: [KmSplit]) -> Double { splits.reduce(0) { $0 + $1.distanceMeters } }
    private func durSum(_ splits: [KmSplit]) -> Double { splits.reduce(0) { $0 + $1.durationSeconds } }

    // MARK: - Bug central: pausa não pode virar distância/tempo fantasma

    func testPauseDoesNotInflateDistanceOrDuration() {
        // 150 fixes contínuos (~894 m), depois uma PAUSA de 30 s com deriva de ~5 m,
        // depois mais 150 fixes (~894 m). Total real corrido ≈ 1788 m em 600 s de movimento.
        let firstLeg = continuousTrack(count: 150) // t: 0..298, dist ~894 m
        let pauseStartT = 298.0
        let pauseEndT = pauseStartT + 30.0

        // Fix de retomada: 30 s depois, deriva de ~18 m (velocidade implícita ~0.6 m/s ≥ 0.5,
        // como os 16.5 m em 29 s do treino real). É o que disparava o bug: o caminho antigo lia
        // como blackout em movimento → bridge ≈ speedBefore*30 ≈ 90 m fantasma + 30 s contados.
        let resumeLatIndex = 149.0 + 18.0 / 6.0
        var track = firstLeg
        track.append(fix(latIndex: resumeLatIndex, at: pauseEndT))
        for i in 1..<150 {
            track.append(fix(latIndex: resumeLatIndex + Double(i), at: pauseEndT + Double(i) * 2.0))
        }

        let pauses = [SplitCalculator.PauseInterval(start: base.addingTimeInterval(pauseStartT),
                                                    end: base.addingTimeInterval(pauseEndT))]

        let fixed = SplitCalculator.kmSplits(from: track, pauses: pauses)
        let buggy = SplitCalculator.kmSplits(from: track, pauses: [])

        XCTAssertFalse(fixed.isEmpty)
        XCTAssertFalse(buggy.isEmpty)

        // (1) Duração: o caminho buggy soma os 30 s da pausa como movimento; o corrigido não.
        let durGap = durSum(buggy) - durSum(fixed)
        XCTAssertEqual(durGap, 30.0, accuracy: 2.0,
                       "Pausa de 30 s não deve contar como tempo em movimento nos splits")

        // (2) Distância: o caminho buggy credita ~speedBefore*30 ≈ 90 m de distância fantasma.
        let distGap = distSum(buggy) - distSum(fixed)
        XCTAssertGreaterThan(distGap, 50.0,
                             "Pausa não deve creditar distância fantasma (bridge) nos splits")

        // (3) O corrigido bate com a distância real corrida (≈1788 m) menos o trecho pré-âncora
        //     descartado (primeiros ~20 m até o 1º movimento). Sem fantasma nenhum.
        let realRunningMeters = 2.0 * 149.0 * 6.0 // 2 pernas × 149 passos × 6 m
        XCTAssertEqual(distSum(fixed), realRunningMeters - SplitCalculator.startMovementMeters,
                       accuracy: 40.0,
                       "Soma dos splits deve refletir a distância corrida, sem a distância da pausa")
    }

    // MARK: - Blackout real (sem pausa) AINDA recebe bridge

    func testGenuineBlackoutStillBridges() {
        // Mesmo gap de 30 s + deriva, mas SEM intervalo de pausa: é blackout de GPS correndo —
        // a distância deve ser creditada (não regredir o tratamento de buraco legítimo).
        let firstLeg = continuousTrack(count: 150)
        let resumeLatIndex = 149.0 + 18.0 / 6.0
        var track = firstLeg
        track.append(fix(latIndex: resumeLatIndex, at: 298.0 + 30.0))
        for i in 1..<150 {
            track.append(fix(latIndex: resumeLatIndex + Double(i), at: 328.0 + Double(i) * 2.0))
        }

        let noPause = SplitCalculator.kmSplits(from: track, pauses: [])
        let asPause = SplitCalculator.kmSplits(from: track, pauses: [
            SplitCalculator.PauseInterval(start: base.addingTimeInterval(298), end: base.addingTimeInterval(328))
        ])
        // Tratado como blackout (sem pausa) credita mais distância que tratado como pausa.
        XCTAssertGreaterThan(distSum(noPause), distSum(asPause) + 40.0)
    }

    // MARK: - Sem pausas: comportamento inalterado em trajeto limpo

    func testCleanTrackFullKilometersAreExact() {
        // ~2200 m contínuos ⇒ 2 km cheios de exatamente 1000 m + parcial.
        let track = continuousTrack(count: 368) // 367*6 ≈ 2202 m
        let splits = SplitCalculator.kmSplits(from: track, pauses: [])
        let fullKms = splits.filter { $0.distanceMeters >= 999.5 }
        XCTAssertEqual(fullKms.count, 2)
        for s in fullKms {
            XCTAssertEqual(s.distanceMeters, 1000, accuracy: 0.001)
        }
        // Soma ≈ distância corrida menos o trecho pré-âncora.
        XCTAssertEqual(distSum(splits), 367.0 * 6.0 - SplitCalculator.startMovementMeters, accuracy: 40.0)
    }

    // MARK: - Pausa em fronteira de km não infla o km

    func testPauseAtKilometerBoundaryKeepsFullKmExact() {
        // ~1000 m, pausa, ~1000 m. Os km cheios continuam 1000 m e a duração de cada km cheio
        // fica perto do tempo de movimento real (~333 s), sem os 30 s da pausa embutidos.
        let firstLeg = continuousTrack(count: 168) // 167*6 ≈ 1002 m
        let resumeLatIndex = 167.0 + 18.0 / 6.0
        var track = firstLeg
        track.append(fix(latIndex: resumeLatIndex, at: 334.0 + 30.0))
        for i in 1..<168 {
            track.append(fix(latIndex: resumeLatIndex + Double(i), at: 364.0 + Double(i) * 2.0))
        }
        let pauses = [SplitCalculator.PauseInterval(start: base.addingTimeInterval(334),
                                                    end: base.addingTimeInterval(364))]
        let splits = SplitCalculator.kmSplits(from: track, pauses: pauses)
        let fullKms = splits.filter { $0.distanceMeters >= 999.5 }
        XCTAssertGreaterThanOrEqual(fullKms.count, 1)
        for s in fullKms {
            XCTAssertEqual(s.distanceMeters, 1000, accuracy: 0.001)
            // Nenhum km cheio deve carregar os 30 s da pausa (a 3 m/s, 1 km ≈ 333 s).
            XCTAssertLessThan(s.durationSeconds, 360, "km cheio não deve embutir o tempo de pausa")
        }
    }
}
