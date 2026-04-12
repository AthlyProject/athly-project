import ActivityKit
import Foundation

/// Gerencia o ciclo de vida da Live Activity de corrida (iOS 16.2+).
@MainActor
final class LiveActivityManager {
    static let shared = LiveActivityManager()

    // Armazenado como Any? para evitar restrição de @available em stored properties
    private var activityToken: Any?

    private init() {}

    // MARK: - Start

    func startActivity(workoutTitle: String) {
        guard #available(iOS 16.2, *) else { return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        let attributes = AthlyRunnerAttributes(workoutTitle: workoutTitle)
        let initialState = AthlyRunnerAttributes.ContentState(
            elapsedSeconds: 0,
            distanceMeters: 0,
            paceSecondsPerKm: 0
        )

        do {
            let content = ActivityContent(state: initialState, staleDate: nil)
            let activity = try Activity<AthlyRunnerAttributes>.request(
                attributes: attributes,
                content: content,
                pushType: nil
            )
            activityToken = activity
        } catch {
            print("[LiveActivityManager] Could not start activity: \(error.localizedDescription)")
        }
    }

    // MARK: - Update

    func updateActivity(elapsedSeconds: Int, distanceMeters: Double, paceSecondsPerKm: Double) {
        guard #available(iOS 16.2, *) else { return }
        guard let activity = activityToken as? Activity<AthlyRunnerAttributes> else { return }

        let updatedState = AthlyRunnerAttributes.ContentState(
            elapsedSeconds: elapsedSeconds,
            distanceMeters: distanceMeters,
            paceSecondsPerKm: paceSecondsPerKm
        )

        Task {
            let content = ActivityContent(state: updatedState, staleDate: nil)
            await activity.update(content)
        }
    }

    // MARK: - End

    func endActivity() {
        guard #available(iOS 16.2, *) else { return }
        guard let activity = activityToken as? Activity<AthlyRunnerAttributes> else { return }

        Task {
            await activity.end(nil, dismissalPolicy: .immediate)
            self.activityToken = nil
        }
    }
}
