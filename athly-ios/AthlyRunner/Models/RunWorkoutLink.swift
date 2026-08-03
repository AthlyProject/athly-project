import Foundation

/// On-device mapping between an HKWorkout.uuid and a prescribed Workout.id.
/// Simple Codable value type persisted as JSON — no SwiftData so we stay iOS 16.1 compatible.
struct RunWorkoutLink: Codable, Equatable, Sendable {
    let healthKitUUID: String
    var athlyWorkoutId: String
    var linkedAt: Date
    var workoutSegmentation: WorkoutSegmentationResult?

    init(
        healthKitUUID: String,
        athlyWorkoutId: String,
        linkedAt: Date = Date(),
        workoutSegmentation: WorkoutSegmentationResult? = nil
    ) {
        self.healthKitUUID = healthKitUUID
        self.athlyWorkoutId = athlyWorkoutId
        self.linkedAt = linkedAt
        self.workoutSegmentation = workoutSegmentation
    }
}
