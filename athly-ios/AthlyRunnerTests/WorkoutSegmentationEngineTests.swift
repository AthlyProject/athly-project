import XCTest
import CoreLocation
@testable import AthlyRunner

final class WorkoutSegmentationEngineTests: XCTestCase {
    private let base = Date(timeIntervalSince1970: 1_700_000_000)
    private let metersPerDegreeLatitude = 111_320.0

    func testReconstructsPrescribedSetFromRoute() throws {
        let prescription = try decodePrescription("""
        {
          "schemaVersion": 1,
          "sport": "running",
          "segments": [
            {"id":"warm","kind":"warmup","label":"Aquecimento","end":{"by":"distanceM","value":200}},
            {"id":"set","kind":"set","repetitions":2,"children":[
              {"id":"work","kind":"work","end":{"by":"distanceM","value":200}},
              {"id":"rec","kind":"recovery","end":{"by":"distanceM","value":100}}
            ]},
            {"id":"cool","kind":"cooldown","label":"Desaceleramento","end":{"by":"distanceM","value":200}}
          ]
        }
        """)
        let route = linearRoute(distanceMeters: 1_200, metersPerFix: 5, secondsPerFix: 2)

        let result = WorkoutSegmentationEngine.reconstruct(
            prescription: prescription,
            startDate: base,
            endDate: route.last!.timestamp,
            route: route,
            pauses: []
        )

        XCTAssertEqual(result.origin, .prescribedRoute)
        XCTAssertEqual(result.confidence, .high)
        XCTAssertNil(result.fallbackReason)
        XCTAssertEqual(result.segments.count, 6)
        XCTAssertEqual(result.segments.map(\.kind), [.warmup, .work, .recovery, .work, .recovery, .cooldown])
        XCTAssertEqual(result.segments[1].setIndex, 1)
        XCTAssertEqual(result.segments[3].setIndex, 2)
        XCTAssertEqual(result.segments.reduce(0) { $0 + $1.distanceMeters }, 1_000, accuracy: 15)
    }

    func testDurationCutsDiscountExplicitPause() throws {
        let prescription = try decodePrescription("""
        {
          "schemaVersion": 1,
          "sport": "running",
          "segments": [
            {"id":"warm","kind":"warmup","end":{"by":"durationSec","value":60}},
            {"id":"work","kind":"work","end":{"by":"durationSec","value":60}}
          ]
        }
        """)
        let route = linearRoute(distanceMeters: 500, metersPerFix: 5, secondsPerFix: 2)
        let pause = SplitCalculator.PauseInterval(
            start: base.addingTimeInterval(30),
            end: base.addingTimeInterval(50)
        )

        let result = WorkoutSegmentationEngine.reconstruct(
            prescription: prescription,
            startDate: base,
            endDate: route.last!.timestamp,
            route: route,
            pauses: [pause]
        )

        XCTAssertEqual(result.segments.count, 2)
        XCTAssertEqual(result.segments[0].durationSeconds, 60, accuracy: 1)
        XCTAssertEqual(result.segments[0].endDate.timeIntervalSince(base), 80, accuracy: 2)
        XCTAssertEqual(result.segments[1].durationSeconds, 60, accuracy: 1)
    }

    func testDistancePrescriptionWithoutRouteDoesNotInventBlocks() throws {
        let prescription = try decodePrescription("""
        {
          "schemaVersion": 1,
          "sport": "running",
          "segments": [
            {"id":"work","kind":"work","end":{"by":"distanceM","value":1000}}
          ]
        }
        """)

        let result = WorkoutSegmentationEngine.reconstruct(
            prescription: prescription,
            startDate: base,
            endDate: base.addingTimeInterval(600),
            route: [],
            pauses: []
        )

        XCTAssertFalse(result.hasSegments)
        XCTAssertEqual(result.origin, .unavailable)
        XCTAssertEqual(result.confidence, .unavailable)
        XCTAssertTrue(result.fallbackReason?.contains("não está disponível") == true)
    }

    func testTimeOnlyPrescriptionWithoutRouteUsesActiveTimeWithLowConfidence() throws {
        let prescription = try decodePrescription("""
        {
          "schemaVersion": 1,
          "sport": "running",
          "segments": [
            {"id":"warm","kind":"warmup","end":{"by":"durationSec","value":60}},
            {"id":"work","kind":"work","end":{"by":"durationSec","value":60}}
          ]
        }
        """)
        let pause = SplitCalculator.PauseInterval(
            start: base.addingTimeInterval(30),
            end: base.addingTimeInterval(60)
        )

        let result = WorkoutSegmentationEngine.reconstruct(
            prescription: prescription,
            startDate: base,
            endDate: base.addingTimeInterval(180),
            route: [],
            pauses: [pause]
        )

        XCTAssertEqual(result.origin, .prescribedTime)
        XCTAssertEqual(result.confidence, .low)
        XCTAssertEqual(result.segments.count, 2)
        XCTAssertEqual(result.segments[0].endDate.timeIntervalSince(base), 90, accuracy: 0.1)
        XCTAssertEqual(result.segments[1].endDate.timeIntervalSince(base), 150, accuracy: 0.1)
        XCTAssertTrue(result.segments.allSatisfy { $0.distanceMeters == 0 })
    }

    func testPartialActivityStopsAtRealRouteEnd() throws {
        let prescription = try decodePrescription("""
        {
          "schemaVersion": 1,
          "sport": "running",
          "segments": [
            {"id":"first","kind":"work","end":{"by":"distanceM","value":500}},
            {"id":"second","kind":"work","end":{"by":"distanceM","value":500}},
            {"id":"cool","kind":"cooldown","end":{"by":"distanceM","value":200}}
          ]
        }
        """)
        let route = linearRoute(distanceMeters: 650, metersPerFix: 5, secondsPerFix: 2)

        let result = WorkoutSegmentationEngine.reconstruct(
            prescription: prescription,
            startDate: base,
            endDate: route.last!.timestamp,
            route: route,
            pauses: []
        )

        XCTAssertEqual(result.confidence, .low)
        XCTAssertEqual(result.segments.count, 2)
        XCTAssertEqual(result.segments[0].distanceMeters, 500, accuracy: 10)
        XCTAssertLessThan(result.segments[1].distanceMeters, 200)
        XCTAssertEqual(result.segments.last?.endDate, route.last?.timestamp)
        XCTAssertTrue(result.fallbackReason?.contains("2 de 3") == true)
    }

    private func decodePrescription(_ json: String) throws -> WorkoutSegments {
        try JSONDecoder().decode(WorkoutSegments.self, from: Data(json.utf8))
    }

    private func linearRoute(
        distanceMeters: Int,
        metersPerFix: Int,
        secondsPerFix: TimeInterval
    ) -> [CLLocation] {
        let count = distanceMeters / metersPerFix
        return (0...count).map { index in
            let meters = Double(index * metersPerFix)
            return CLLocation(
                coordinate: CLLocationCoordinate2D(
                    latitude: -25.42 + meters / metersPerDegreeLatitude,
                    longitude: -49.35
                ),
                altitude: 100,
                horizontalAccuracy: 5,
                verticalAccuracy: 5,
                course: 0,
                speed: Double(metersPerFix) / secondsPerFix,
                timestamp: base.addingTimeInterval(Double(index) * secondsPerFix)
            )
        }
    }
}
