import XCTest
@testable import AthlyRunner

/// Leitura das corridas para o planner: janela de 9 semanas, no mínimo 20 e no máximo 60 corridas,
/// e a data a partir da qual todas foram lidas (o backend usa para medir o volume de 6 a 8 semanas).
final class HealthRunWindowTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_792_000_000)
    private let day: TimeInterval = 86_400

    /// Corridas a cada `everyHours` horas, da mais recente para a mais antiga, como o HealthKit.
    private func history(count: Int, everyHours: Double) -> [HealthKitRunItem] {
        (0..<count).map { index in
            let start = now.addingTimeInterval(-Double(index + 1) * everyHours * 3600)
            return HealthKitRunItem(id: "run-\(index)", startDate: start, endDate: start.addingTimeInterval(1800),
                                    durationSeconds: 1800, distanceMeters: 5000, averagePaceSecondsPerKm: 360,
                                    activeEnergyBurned: 300, elevationGainMeters: 0)
        }
    }

    /// Páginas como `fetchRunningWorkoutsPage`: até `limit` corridas terminadas antes do cursor.
    private func read(_ runs: [HealthKitRunItem]) async throws -> HealthRunWindow.Read {
        try await HealthRunWindow.read(now: now) { limit, beforeEndDate in
            Array(runs.filter { beforeEndDate == nil || $0.endDate < beforeEndDate! }.prefix(limit))
        }
    }

    func testReadsTheWholeNineWeekWindowForAFrequentRunner() async throws {
        // 4 corridas por semana durante 15 semanas: as 20 mais recentes cobririam só 5 semanas.
        let result = try await read(history(count: 60, everyHours: 42))
        XCTAssertEqual(result.runs.count, 36) // 63 dias / 1,75 dia
        XCTAssertEqual(result.readFrom, now.addingTimeInterval(-63 * day))
        XCTAssertTrue(result.runs.allSatisfy { $0.startDate >= result.readFrom })
    }

    func testKeepsAtLeastTheTwentyMostRecentRuns() async throws {
        // Uma corrida por semana: só 9 cabem na janela, mas o planner sempre recebeu 20.
        let runs = history(count: 30, everyHours: 168)
        let result = try await read(runs)
        XCTAssertEqual(result.runs.count, 20)
        XCTAssertEqual(result.readFrom, runs[19].startDate)
    }

    func testStopsAtSixtyRuns() async throws {
        // Duas corridas por dia: o teto de 60 chega antes do início da janela.
        let runs = history(count: 150, everyHours: 12)
        let result = try await read(runs)
        XCTAssertEqual(result.runs.count, 60)
        XCTAssertEqual(result.readFrom, runs[59].startDate)
    }

    func testReadingTheWholeHealthCoversAYear() async throws {
        let result = try await read(history(count: 10, everyHours: 72))
        XCTAssertEqual(result.runs.count, 10)
        XCTAssertEqual(result.readFrom, now.addingTimeInterval(-365 * day))
    }
}
