@preconcurrency import ActivityKit
import Foundation
import OSLog

private let liveActivityLogger = Logger(subsystem: "com.athly.runner", category: "LiveActivity")

enum LiveActivityStartResult {
    case started
    case disabledBySystem
    case unsupportedOS
    case simulator
    case failed(Error)
}

/// Gerencia o ciclo de vida da Live Activity de corrida (iOS 16.1+).
@MainActor
final class LiveActivityManager {
    static let shared = LiveActivityManager()

    private var liveActivity: Activity<AthlyRunnerAttributes>?

    private init() {}

    // MARK: - Start

    @discardableResult
    func startActivity(workoutTitle: String) async -> LiveActivityStartResult {
        #if targetEnvironment(simulator)
        return .simulator
        #else
        guard #available(iOS 16.1, *) else { return .unsupportedOS }
        liveActivityLogger.info("Start requested for workoutTitle='\(workoutTitle, privacy: .public)'")
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            liveActivityLogger.error("Live Activities disabled at system/app level.")
            return .disabledBySystem
        }

        let attributes = AthlyRunnerAttributes(workoutTitle: workoutTitle)
        let initialState = AthlyRunnerAttributes.ContentState(
            elapsedSeconds: 0,
            distanceMeters: 0,
            paceSecondsPerKm: 0
        )

        liveActivityLogger.info("Existing activities before cleanup: \(Activity<AthlyRunnerAttributes>.activities.count, privacy: .public)")
        await endAllActivities()

        do {
            let activity = try requestActivity(
                attributes: attributes,
                initialState: initialState
            )
            liveActivity = activity
            liveActivityLogger.info("Live Activity started with id='\(activity.id, privacy: .public)'. Active count now: \(Activity<AthlyRunnerAttributes>.activities.count, privacy: .public)")
            return .started
        } catch {
            liveActivityLogger.error("Could not start activity: \(String(describing: error), privacy: .public)")
            return .failed(error)
        }
        #endif
    }

    // MARK: - Update

    func updateActivity(elapsedSeconds: Int, distanceMeters: Double, paceSecondsPerKm: Double) {
        #if targetEnvironment(simulator)
        return
        #else
        guard #available(iOS 16.1, *) else { return }
        let updatedState = AthlyRunnerAttributes.ContentState(
            elapsedSeconds: elapsedSeconds,
            distanceMeters: distanceMeters,
            paceSecondsPerKm: paceSecondsPerKm
        )

        Task { @MainActor in
            await performUpdate(with: updatedState)
        }
        #endif
    }

    // MARK: - End

    func endActivity() {
        #if targetEnvironment(simulator)
        return
        #else
        guard #available(iOS 16.1, *) else { return }
        Task { @MainActor in
            await performEnd()
        }
        #endif
    }

    @available(iOS 16.1, *)
    private func currentActivity() -> Activity<AthlyRunnerAttributes>? {
        if let liveActivity {
            return liveActivity
        }

        let fallbackActivity = Activity<AthlyRunnerAttributes>.activities.first
        if let fallbackActivity {
            liveActivity = fallbackActivity
            liveActivityLogger.debug("Falling back to first active activity id='\(fallbackActivity.id, privacy: .public)'")
        }
        return fallbackActivity
    }

    @available(iOS 16.1, *)
    private func requestActivity(
        attributes: AthlyRunnerAttributes,
        initialState: AthlyRunnerAttributes.ContentState
    ) throws -> Activity<AthlyRunnerAttributes> {
        if #available(iOS 16.2, *) {
            let content = ActivityContent(state: initialState, staleDate: nil)
            return try Activity<AthlyRunnerAttributes>.request(
                attributes: attributes,
                content: content,
                pushType: nil
            )
        }

        return try Activity<AthlyRunnerAttributes>.request(
            attributes: attributes,
            contentState: initialState,
            pushType: nil
        )
    }

    @available(iOS 16.1, *)
    private func performUpdate(with state: AthlyRunnerAttributes.ContentState) async {
        guard let activity = currentActivity() else {
            liveActivityLogger.error("Update skipped because no active activity was resolved.")
            return
        }

        liveActivityLogger.debug(
            "Updating activity id='\(activity.id, privacy: .public)' elapsed=\(state.elapsedSeconds, privacy: .public) distance=\(state.distanceMeters, privacy: .public) pace=\(state.paceSecondsPerKm, privacy: .public)"
        )

        if #available(iOS 16.2, *) {
            let content = ActivityContent(state: state, staleDate: nil)
            await activity.update(content)
        } else {
            await activity.update(using: state)
        }
    }

    @available(iOS 16.1, *)
    private func performEnd() async {
        guard let activity = currentActivity() else {
            liveActivityLogger.error("End skipped because no active activity was resolved.")
            return
        }

        liveActivityLogger.info("Ending activity id='\(activity.id, privacy: .public)'")

        if #available(iOS 16.2, *) {
            await activity.end(nil, dismissalPolicy: .immediate)
        } else {
            await activity.end(using: nil, dismissalPolicy: .immediate)
        }
        liveActivity = nil
    }

    @available(iOS 16.1, *)
    private func endAllActivities() async {
        liveActivityLogger.debug("Ending all existing activities. Count=\(Activity<AthlyRunnerAttributes>.activities.count, privacy: .public)")
        for activity in Activity<AthlyRunnerAttributes>.activities {
            if #available(iOS 16.2, *) {
                await activity.end(nil, dismissalPolicy: .immediate)
            } else {
                await activity.end(using: nil, dismissalPolicy: .immediate)
            }
        }
        liveActivity = nil
    }
}
