import XCTest
@testable import AthlyRunner

/// Cobre a leitura dos recordes exibidos no Perfil: o melhor tempo tem que sair do trecho
/// contínuo mais rápido da corrida (janela deslizante sobre os splits), e não do tempo total.
final class PersonalRecordCalculatorTests: XCTestCase {

    private let base = Date(timeIntervalSince1970: 1_700_000_000)

    private func session(
        splitsSeconds: [Double],
        startedAt: TimeInterval = 0,
        distanceKm: Double? = nil
    ) -> RunSession {
        let session = RunSession()
        session.startDate = base.addingTimeInterval(startedAt)
        session.splits = splitsSeconds.enumerated().map { index, seconds in
            Split(kilometer: index + 1, durationSeconds: seconds)
        }
        let km = distanceKm ?? Double(splitsSeconds.count)
        session.distanceMeters = km * 1000
        session.durationSeconds = splitsSeconds.reduce(0, +)
        session.averagePaceSecondsPerKm = km > 0 ? session.durationSeconds / km : 0
        return session
    }

    func testUsesFastestContiguousWindowInsteadOfTotalTime() {
        // 7 km: os 5 km finais (5×300 s) são mais rápidos que a corrida inteira.
        let run = session(splitsSeconds: [400, 400, 300, 300, 300, 300, 300])
        let records = PersonalRecordCalculator.records(from: [run])

        let fiveK = try? XCTUnwrap(records.first { $0.id == "5k" })
        XCTAssertEqual(fiveK?.durationSeconds ?? 0, 1500, accuracy: 0.001)
        XCTAssertEqual(fiveK?.isEstimated, false)
    }

    func testInterpolatesPartialSplitAtWindowEdge() {
        // 5 km a 300 s/km + 1 km parcial: a janela de 5 km pode começar no meio do primeiro split.
        let run = session(splitsSeconds: [360, 300, 300, 300, 300, 300])
        let records = PersonalRecordCalculator.records(from: [run])

        // Melhor janela: metade do km 1 (180 s) + km 2..6 não existe, então é km 2..6 = 1500 s.
        XCTAssertEqual(records.first { $0.id == "5k" }?.durationSeconds ?? 0, 1500, accuracy: 0.001)
    }

    func testKeepsBestTimeAcrossSessions() {
        let slow = session(splitsSeconds: [320, 320, 320, 320, 320], startedAt: 0)
        let fast = session(splitsSeconds: [300, 300, 300, 300, 300], startedAt: 86_400)
        let records = PersonalRecordCalculator.records(from: [slow, fast])

        XCTAssertEqual(records.first { $0.id == "5k" }?.durationSeconds ?? 0, 1500, accuracy: 0.001)
        XCTAssertEqual(records.first { $0.id == "5k" }?.date, fast.startDate)
    }

    func testFallsBackToAveragePaceWhenSessionHasNoSplits() {
        let run = session(splitsSeconds: [])
        run.distanceMeters = 12_000
        run.durationSeconds = 3_600
        run.averagePaceSecondsPerKm = 300

        let records = PersonalRecordCalculator.records(from: [run])
        let tenK = records.first { $0.id == "10k" }

        XCTAssertEqual(tenK?.durationSeconds ?? 0, 3_000, accuracy: 0.001)
        XCTAssertEqual(tenK?.isEstimated, true)
    }

    func testIgnoresDistancesTheAthleteNeverCovered() {
        let run = session(splitsSeconds: [300, 300, 300, 300, 300])
        let records = PersonalRecordCalculator.records(from: [run])

        XCTAssertNotNil(records.first { $0.id == "5k" })
        XCTAssertNil(records.first { $0.id == "10k" })
        XCTAssertNil(records.first { $0.id == "21k" })
    }
}
