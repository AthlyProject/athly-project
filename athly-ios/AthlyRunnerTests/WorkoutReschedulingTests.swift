import XCTest
@testable import AthlyRunner

@MainActor
final class WorkoutReschedulingTests: XCTestCase {
    private func workout(_ id: String = "source", date: String = "2026-09-30", status: String = "scheduled", sport: String = "running") throws -> WorkoutModel {
        let json = #"{"id":"\#(id)","date":"\#(date)","status":"\#(status)","sportType":"\#(sport)","title":"Easy run","blocks":[],"trainingPlanId":"plan-1","weeklyGoalId":"week-1"}"#
        return try JSONDecoder().decode(WorkoutModel.self, from: Data(json.utf8))
    }

    private func day(_ value: String) -> Date {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: value)!
    }

    func testMovesBackwardAndForwardOnlyWithinOriginalWeek() throws {
        let source = try workout()
        for date in ["2026-09-28", "2026-09-29", "2026-10-04"] {
            XCTAssertEqual(WorkoutRescheduleDecision.evaluate(workoutID: source.id, day: day(date), workouts: [source]), .allowed)
        }
        for date in ["2026-09-27", "2026-10-05"] {
            XCTAssertEqual(WorkoutRescheduleDecision.evaluate(workoutID: source.id, day: day(date), workouts: [source]), .differentWeek)
        }
        XCTAssertEqual(WorkoutRescheduleDecision.evaluate(workoutID: source.id, day: day(source.date), workouts: [source]), .sameDay)
    }

    func testRestIsAvailableButEveryWorkoutStatusOccupiesDestination() throws {
        let source = try workout()
        let rest = try workout("rest", date: "2026-09-28", sport: "other")
        XCTAssertEqual(WorkoutRescheduleDecision.evaluate(workoutID: source.id, day: day(rest.date), workouts: [source, rest]), .allowed)
        for status in ["scheduled", "done", "partial", "skipped"] {
            let occupied = try workout("occupied", date: rest.date, status: status)
            XCTAssertEqual(WorkoutRescheduleDecision.evaluate(workoutID: source.id, day: day(rest.date), workouts: [source, occupied]), .occupied)
        }
    }

    func testDateOnlyMovesKeepCalendarDayInDifferentTimeZones() throws {
        let original = NSTimeZone.default
        defer { NSTimeZone.default = original }
        for name in ["America/Sao_Paulo", "Europe/Berlin", "Pacific/Auckland"] {
            NSTimeZone.default = try XCTUnwrap(TimeZone(identifier: name))
            let source = try workout(date: "2026-09-29")
            XCTAssertEqual(WorkoutRescheduleDecision.evaluate(workoutID: source.id, day: day("2026-09-28"), workouts: [source]), .allowed, name)
            XCTAssertEqual(WorkoutRescheduleDecision.evaluate(workoutID: source.id, day: day("2026-09-27"), workouts: [source]), .differentWeek, name)
        }
    }

    func testValidatesCurrentStateRatherThanStaleDraggedPayload() throws {
        let current = try workout(status: "done")
        XCTAssertEqual(WorkoutRescheduleDecision.evaluate(workoutID: current.id, day: day("2026-09-28"), workouts: [current]), .unavailable)
        XCTAssertEqual(WorkoutRescheduleDecision.evaluate(workoutID: "unknown", day: day("2026-09-28"), workouts: [current]), .unavailable)
    }

    func testSuccessfulMoveUpdatesCacheAndNotificationsAndRejectsDuplicateWhilePending() async throws {
        let source = try workout(), updated = try workout(date: "2026-09-28")
        var finish: CheckedContinuation<WorkoutModel, Never>?
        var count = 0
        var notifications: [WorkoutModel] = []
        let vm = TrainingPlanViewModel(rescheduleDependencies: PlanRescheduleDependencies(request: { id, date in
            count += 1
            XCTAssertEqual(id, source.id)
            XCTAssertEqual(date, updated.date)
            return await withCheckedContinuation { finish = $0 }
        }, notify: { notifications = $0 }))
        vm.allWorkouts = [source]
        let call = Task { await vm.rescheduleWorkout(source, toDay: updated.date) }
        while finish == nil { await Task.yield() }
        XCTAssertTrue(vm.isRescheduling)
        await vm.rescheduleWorkout(source, toDay: "2026-10-01")
        finish?.resume(returning: updated)
        await call.value
        XCTAssertEqual(count, 1)
        XCTAssertFalse(vm.isRescheduling)
        XCTAssertEqual(vm.allWorkouts.first?.date, updated.date)
        XCTAssertEqual(notifications.first?.date, updated.date)
        XCTAssertEqual(TrainingPlanCache.shared.load()?.allWorkouts.first?.date, updated.date)
        TrainingPlanCache.shared.clear()
    }

    func testRejectedMovePreservesPositionAndReportsError() async throws {
        let source = try workout()
        let vm = TrainingPlanViewModel(rescheduleDependencies: PlanRescheduleDependencies(request: { _, _ in
            throw APIError.serverError(409, "Destination occupied")
        }, notify: { _ in XCTFail("Should not reschedule notifications") }))
        vm.allWorkouts = [source]
        await vm.rescheduleWorkout(source, toDay: "2026-09-28")
        XCTAssertFalse(vm.isRescheduling)
        XCTAssertEqual(vm.allWorkouts.first?.date, source.date)
        XCTAssertNotNil(vm.errorMessage)
    }
}
