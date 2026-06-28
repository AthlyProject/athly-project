import XCTest
@testable import AthlyRunner

/// Cobre o filtro de elevação: o método antigo (somar todo delta > 0.5 m por fix sem gate de
/// precisão) inflava o ganho com o salto de aquecimento do GPS (ex.: +92 m em 2 s) e ainda
/// perdia rampas lentas (passos < 0.5 m). O acumulador novo rejeita o lixo e captura a rampa.
final class ElevationAccumulatorTests: XCTestCase {

    func testRejectsWarmupSpikeWithBadVerticalAccuracy() {
        var acc = ElevationAccumulator()
        // Aquecimento: vAcc ruim ⇒ descartado, mesmo com saltos enormes (865 → 957 = +92 m).
        acc.add(altitude: 891, verticalAccuracy: 30)
        acc.add(altitude: 865, verticalAccuracy: 20)
        acc.add(altitude: 957, verticalAccuracy: 20)
        // Subida real, gradual, com boa precisão: 962 → 974 (~12 m).
        for alt in stride(from: 962.0, through: 974.0, by: 1.0) {
            acc.add(altitude: alt, verticalAccuracy: 4)
        }
        XCTAssertLessThan(acc.gain, 20, "O salto de +92 m do aquecimento não pode entrar no ganho")
        XCTAssertGreaterThan(acc.gain, 5, "A subida real de ~12 m deve ser capturada")
    }

    func testIgnoresJitter() {
        var acc = ElevationAccumulator()
        // Oscilação de ±1 m em torno de 100 com boa precisão: abaixo do deadband ⇒ ~zero ganho.
        let pattern = [100.0, 101, 99.5, 100.5, 99, 100.8, 99.2, 100.3, 99.7, 100.1]
        for _ in 0..<5 {
            for alt in pattern { acc.add(altitude: alt, verticalAccuracy: 4) }
        }
        XCTAssertLessThan(acc.gain, 3, "Jitter dentro do deadband não deve acumular ganho")
    }

    func testCapturesGradualClimbBelowOldPerSampleThreshold() {
        var acc = ElevationAccumulator()
        // Rampa de 0.4 m por fix (abaixo do antigo limiar de 0.5 m/amostra, que daria ZERO).
        // 75 passos × 0.4 m = 30 m de subida sustentada.
        var alt = 100.0
        for _ in 0..<75 {
            alt += 0.4
            acc.add(altitude: alt, verticalAccuracy: 4)
        }
        XCTAssertGreaterThan(acc.gain, 25, "Rampa lenta sustentada (~30 m) deve ser capturada")
        XCTAssertLessThan(acc.gain, 32)
    }

    func testResetClearsState() {
        var acc = ElevationAccumulator()
        for alt in stride(from: 100.0, through: 120.0, by: 1.0) {
            acc.add(altitude: alt, verticalAccuracy: 4)
        }
        XCTAssertGreaterThan(acc.gain, 0)
        acc.reset()
        XCTAssertEqual(acc.gain, 0)
        XCTAssertNil(acc.smoothedAltitude)
    }
}
