import CoreLocation
import FITSwiftSDK
import XCTest
@testable import AthlyRunner

final class WorkoutImportServiceTests: XCTestCase {
    func testImportsMultipleTCXActivitiesWithRouteHeartRateAndLaps() throws {
        let xml = """
        <?xml version="1.0" encoding="UTF-8"?>
        <TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
          <Activities>
            \(tcxActivity(id: "2026-07-29T10:00:00Z", latitude: -23.5500, longitude: -46.6300))
            <Activity Sport="Biking">
              <Id>2026-07-29T15:00:00Z</Id>
              <Lap StartTime="2026-07-29T15:00:00Z">
                <TotalTimeSeconds>600</TotalTimeSeconds><DistanceMeters>5000</DistanceMeters>
              </Lap>
            </Activity>
            \(tcxActivity(id: "2026-07-30T10:00:00Z", latitude: -23.5600, longitude: -46.6400))
          </Activities>
        </TrainingCenterDatabase>
        """

        let activities = try importFile(contents: Data(xml.utf8), extension: "tcx")

        XCTAssertEqual(activities.count, 2)
        XCTAssertEqual(activities[0].format, .tcx)
        XCTAssertEqual(activities[0].distanceMeters, 1_000, accuracy: 0.1)
        XCTAssertEqual(activities[0].activeDurationSeconds, 360, accuracy: 0.1)
        XCTAssertEqual(activities[0].route.count, 2)
        XCTAssertEqual(activities[0].heartRateSamples.map(\.beatsPerMinute), [145, 151])
        XCTAssertEqual(activities[0].laps.count, 1)
        XCTAssertEqual(activities[0].caloriesBurned, 75, accuracy: 0.1)
        XCTAssertFalse(activities[0].fingerprint.isEmpty)
    }

    func testImportsNamespacedGPXAndDerivesMetrics() throws {
        let xml = """
        <?xml version="1.0" encoding="UTF-8"?>
        <gpx version="1.1" creator="Zepp" xmlns="http://www.topografix.com/GPX/1/1"
             xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
          <trk>
            <name>Corrida Zepp</name>
            <type>running</type>
            <trkseg>
              <trkpt lat="-23.5500" lon="-46.6300">
                <ele>750</ele><time>2026-07-29T10:00:00Z</time>
                <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>142</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>
              </trkpt>
              <trkpt lat="-23.5490" lon="-46.6300">
                <ele>756</ele><time>2026-07-29T10:01:00Z</time>
                <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>148</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>
              </trkpt>
            </trkseg>
          </trk>
        </gpx>
        """

        let activity = try XCTUnwrap(importFile(contents: Data(xml.utf8), extension: "gpx").first)

        XCTAssertEqual(activity.format, .gpx)
        XCTAssertEqual(activity.activityName, "Corrida Zepp")
        XCTAssertEqual(activity.route.count, 2)
        XCTAssertGreaterThan(activity.distanceMeters, 100)
        XCTAssertEqual(activity.activeDurationSeconds, 60, accuracy: 0.1)
        XCTAssertEqual(activity.elevationGainMeters, 6, accuracy: 0.1)
        XCTAssertEqual(activity.heartRateSamples.map(\.beatsPerMinute), [142, 148])
    }

    func testRejectsExplicitCyclingGPX() throws {
        let xml = """
        <gpx version="1.1"><trk><type>cycling</type><trkseg>
          <trkpt lat="-23.55" lon="-46.63"><time>2026-07-29T10:00:00Z</time></trkpt>
          <trkpt lat="-23.54" lon="-46.63"><time>2026-07-29T10:05:00Z</time></trkpt>
        </trkseg></trk></gpx>
        """

        XCTAssertThrowsError(try importFile(contents: Data(xml.utf8), extension: "gpx")) { error in
            guard case WorkoutImportError.incompatibleActivity = error else {
                return XCTFail("Erro inesperado: \(error)")
            }
        }
    }

    func testGPXSegmentBreakBecomesPauseInterval() throws {
        let xml = """
        <gpx version="1.1"><trk><type>running</type>
          <trkseg>
            <trkpt lat="-23.550" lon="-46.630"><time>2026-07-29T10:00:00Z</time></trkpt>
            <trkpt lat="-23.549" lon="-46.630"><time>2026-07-29T10:01:00Z</time></trkpt>
          </trkseg>
          <trkseg>
            <trkpt lat="-23.548" lon="-46.630"><time>2026-07-29T10:03:00Z</time></trkpt>
            <trkpt lat="-23.547" lon="-46.630"><time>2026-07-29T10:04:00Z</time></trkpt>
          </trkseg>
        </trk></gpx>
        """

        let activity = try XCTUnwrap(importFile(contents: Data(xml.utf8), extension: "gpx").first)

        XCTAssertEqual(activity.pauseIntervals.count, 1)
        XCTAssertEqual(activity.pauseIntervals[0].end.timeIntervalSince(activity.pauseIntervals[0].start), 120)
    }

    func testRejectsMalformedFITBeforeParsingMessages() throws {
        XCTAssertThrowsError(try importFile(contents: Data("not-a-fit-file".utf8), extension: "fit")) { error in
            guard case WorkoutImportError.invalidFile = error else {
                return XCTFail("Erro inesperado: \(error)")
            }
        }
    }

    func testImportsValidFITActivity() throws {
        let startDate = ISO8601DateFormatter().date(from: "2026-07-29T10:00:00Z")!
        let start = DateTime(date: startDate)
        let end = DateTime(timestamp: start.timestamp + 300)

        let fileId = FileIdMesg()
        try fileId.setType(.activity)

        let first = RecordMesg()
        try first.setTimestamp(start)
        try first.setPositionLat(semicircles(-23.5500))
        try first.setPositionLong(semicircles(-46.6300))
        try first.setEnhancedAltitude(750)
        try first.setHeartRate(140)

        let last = RecordMesg()
        try last.setTimestamp(end)
        try last.setPositionLat(semicircles(-23.5410))
        try last.setPositionLong(semicircles(-46.6300))
        try last.setEnhancedAltitude(758)
        try last.setHeartRate(152)

        let lap = LapMesg()
        try lap.setMessageIndex(0)
        try lap.setStartTime(start)
        try lap.setTimestamp(end)
        try lap.setTotalTimerTime(300)
        try lap.setTotalElapsedTime(300)
        try lap.setTotalDistance(1_000)

        let session = SessionMesg()
        try session.setMessageIndex(0)
        try session.setStartTime(start)
        try session.setTimestamp(end)
        try session.setSport(.running)
        try session.setSubSport(.generic)
        try session.setTotalTimerTime(300)
        try session.setTotalElapsedTime(300)
        try session.setTotalDistance(1_000)
        try session.setTotalCalories(80)
        try session.setTotalAscent(8)
        try session.setFirstLapIndex(0)
        try session.setNumLaps(1)

        let encoder = FITSwiftSDK.Encoder()
        encoder.write(mesgs: [fileId, first, last, lap, session])
        let activity = try XCTUnwrap(importFile(contents: encoder.close(), extension: "fit").first)

        XCTAssertEqual(activity.format, .fit)
        XCTAssertEqual(activity.distanceMeters, 1_000, accuracy: 0.1)
        XCTAssertEqual(activity.activeDurationSeconds, 300, accuracy: 0.1)
        XCTAssertEqual(activity.route.count, 2)
        XCTAssertEqual(activity.heartRateSamples.map(\.beatsPerMinute), [140, 152])
        XCTAssertEqual(activity.laps.count, 1)
        XCTAssertEqual(activity.caloriesBurned, 80, accuracy: 0.1)
    }

    func testFingerprintIsStableForSmallMetricNoise() {
        let start = Date(timeIntervalSince1970: 1_785_316_800)
        let first = WorkoutImportFingerprint.make(
            startDate: start,
            durationSeconds: 1_800,
            distanceMeters: 5_000,
            route: []
        )
        let second = WorkoutImportFingerprint.make(
            startDate: start.addingTimeInterval(3),
            durationSeconds: 1_804,
            distanceMeters: 5_009,
            route: []
        )

        XCTAssertEqual(first, second)
    }

    private func importFile(contents: Data, extension fileExtension: String) throws -> [ImportedWorkout] {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension(fileExtension)
        try contents.write(to: url, options: .atomic)
        defer { try? FileManager.default.removeItem(at: url) }
        return try WorkoutImportService().importActivities(from: url)
    }

    private func tcxActivity(id: String, latitude: Double, longitude: Double) -> String {
        """
        <Activity Sport="Running">
          <Id>\(id)</Id>
          <Lap StartTime="\(id)">
            <TotalTimeSeconds>360</TotalTimeSeconds>
            <DistanceMeters>1000</DistanceMeters>
            <Calories>75</Calories>
            <AverageHeartRateBpm><Value>148</Value></AverageHeartRateBpm>
            <Track>
              <Trackpoint>
                <Time>\(id)</Time>
                <Position><LatitudeDegrees>\(latitude)</LatitudeDegrees><LongitudeDegrees>\(longitude)</LongitudeDegrees></Position>
                <AltitudeMeters>750</AltitudeMeters><DistanceMeters>0</DistanceMeters>
                <HeartRateBpm><Value>145</Value></HeartRateBpm>
              </Trackpoint>
              <Trackpoint>
                <Time>\(ISO8601DateFormatter().string(from: ISO8601DateFormatter().date(from: id)!.addingTimeInterval(360)))</Time>
                <Position><LatitudeDegrees>\(latitude + 0.009)</LatitudeDegrees><LongitudeDegrees>\(longitude)</LongitudeDegrees></Position>
                <AltitudeMeters>758</AltitudeMeters><DistanceMeters>1000</DistanceMeters>
                <HeartRateBpm><Value>151</Value></HeartRateBpm>
              </Trackpoint>
            </Track>
          </Lap>
        </Activity>
        """
    }

    private func semicircles(_ degrees: Double) -> Int32 {
        Int32((degrees * 2_147_483_648 / 180).rounded())
    }
}
