import XCTest
@testable import AthlyRunner

final class WorkoutModelDateTests: XCTestCase {

    func testDateOnlyWorkoutMatchesReferenceDay() {
        let workout = makeWorkout(date: "2026-06-30")
        let reference = makeDate(year: 2026, month: 6, day: 30)

        XCTAssertTrue(workout.isOnDay(reference, calendar: calendar))
    }

    func testDateOnlyWorkoutDoesNotMatchDifferentDay() {
        let workout = makeWorkout(date: "2026-06-30")
        let previousDay = makeDate(year: 2026, month: 6, day: 29)
        let nextDay = makeDate(year: 2026, month: 7, day: 1)

        XCTAssertFalse(workout.isOnDay(previousDay, calendar: calendar))
        XCTAssertFalse(workout.isOnDay(nextDay, calendar: calendar))
    }

    func testInternetDateWorkoutMatchesReferenceDay() {
        let workout = makeWorkout(date: "2026-06-30T14:30:00.000Z")
        let reference = makeDate(year: 2026, month: 6, day: 30, hour: 9)

        XCTAssertTrue(workout.isOnDay(reference, calendar: calendar))
    }

    func testWorkoutModelDecodesAppleHealthWorkoutUUID() throws {
        let data = Data("""
        {
          "id": "workout-1",
          "date": "2026-06-30",
          "sportType": "running",
          "title": "Tiros",
          "blocks": [],
          "status": "done",
          "appleHealthWorkoutUUID": "hk-uuid-1"
        }
        """.utf8)

        let workout = try JSONDecoder().decode(WorkoutModel.self, from: data)

        XCTAssertEqual(workout.appleHealthWorkoutUUID, "hk-uuid-1")
    }

    func testRunSessionDecodesWithoutSegmentRecords() throws {
        let data = Data("""
        {
          "id": "2C9B012B-40D1-47DA-9DAB-0F4F4E49E3E9",
          "startDate": "2026-06-30T10:00:00Z",
          "endDate": "2026-06-30T10:30:00Z",
          "distanceMeters": 5000,
          "durationSeconds": 1800,
          "averagePaceSecondsPerKm": 360,
          "elevationGainMeters": 20,
          "caloriesBurned": 300,
          "status": "completed",
          "sportType": "running",
          "routePoints": [],
          "splits": [],
          "backendId": null,
          "synced": false
        }
        """.utf8)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let session = try decoder.decode(RunSession.self, from: data)

        XCTAssertNil(session.segmentRecords)
    }

    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }

    private func makeDate(year: Int, month: Int, day: Int, hour: Int = 12) -> Date {
        DateComponents(
            calendar: calendar,
            timeZone: calendar.timeZone,
            year: year,
            month: month,
            day: day,
            hour: hour
        ).date!
    }

    private func makeWorkout(date: String) -> WorkoutModel {
        WorkoutModel(
            id: UUID().uuidString,
            date: date,
            sportType: .running,
            title: "Corrida leve",
            description: nil,
            blocks: [],
            segments: nil,
            status: .scheduled,
            trainingPlanId: "plan-1",
            weeklyGoalId: "week-1",
            intensity: 3,
            isGoalAttempt: false,
            stravaActivityId: nil,
            appleHealthWorkoutUUID: nil
        )
    }
}
