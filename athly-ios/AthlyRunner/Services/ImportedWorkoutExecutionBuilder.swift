import Foundation

enum ImportedWorkoutExecutionBuilder {
    static func build(
        workout: ImportedWorkout,
        athlyWorkoutId: String,
        healthKitUUID: String?,
        healthSummary: HealthKitRunItem? = nil,
        segmentation: WorkoutSegmentationResult? = nil
    ) -> DetailedSessionPayload {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let segments: [SegmentPayload]
        let source: String
        if let segmentation, segmentation.hasSegments {
            switch segmentation.origin {
            case .athlyTracker, .thirdPartyLaps:
                source = "events"
            case .prescribedRoute, .prescribedTime:
                source = segmentation.confidence == .low ? "prescribed_low_confidence" : "prescribed"
            case .unavailable:
                source = "synthetic"
            }
            segments = segmentation.segments.enumerated().map { position, record in
                let identity = WorkoutSegmentationEngine.backendIdentity(
                    for: record,
                    at: position,
                    in: segmentation.segments
                )
                return payload(
                    label: identity.label,
                    index: identity.index,
                    start: record.startDate,
                    end: record.endDate,
                    distance: record.distanceMeters,
                    duration: record.durationSeconds,
                    heartRateSamples: workout.heartRateSamples
                )
            }
        } else {
            let ranges: [(index: Int, start: Date, end: Date, distance: Double, duration: Double)]
            if !workout.laps.isEmpty {
                ranges = workout.laps.map {
                    ($0.index, $0.startDate, $0.endDate, $0.distanceMeters, $0.durationSeconds)
                }
                source = "events"
            } else {
                let splits = SplitCalculator.kmSplits(
                    from: workout.route,
                    pauses: workout.pauseIntervals
                )
                if !splits.isEmpty {
                    ranges = splits.map {
                        ($0.kilometer, $0.startDate, $0.endDate, $0.distanceMeters, $0.durationSeconds)
                    }
                    source = "route"
                } else {
                    ranges = [(1, workout.startDate, workout.endDate, workout.distanceMeters, workout.activeDurationSeconds)]
                    source = "synthetic"
                }
            }
            segments = ranges.map { range in
                payload(
                    label: .easy,
                    index: range.index,
                    start: range.start,
                    end: range.end,
                    distance: range.distance,
                    duration: range.duration,
                    heartRateSamples: workout.heartRateSamples
                )
            }
        }

        let summaryDistance = healthSummary?.distanceMeters ?? workout.distanceMeters
        let summaryDuration = healthSummary?.durationSeconds ?? workout.activeDurationSeconds
        let summaryPace = healthSummary?.averagePaceSecondsPerKm ?? workout.averagePaceSecondsPerKm
        let summaryEnergy = healthSummary.map(\.activeEnergyBurned).flatMap { $0 > 0 ? $0 : nil }
            ?? (workout.caloriesBurned > 0 ? workout.caloriesBurned : nil)
        let summaryElevation = healthSummary?.elevationGainMeters
            ?? (workout.elevationGainMeters > 0 ? workout.elevationGainMeters : nil)

        return DetailedSessionPayload(
            startDate: iso.string(from: healthSummary?.startDate ?? workout.startDate),
            appleHealthWorkoutUUID: healthKitUUID,
            athlyWorkoutId: athlyWorkoutId,
            distanceMeters: summaryDistance,
            durationSeconds: summaryDuration,
            averagePaceSecondsPerKm: summaryPace,
            avgHR: workout.averageHeartRate,
            maxHR: workout.maximumHeartRate,
            activeEnergyBurned: summaryEnergy,
            elevationGainMeters: summaryElevation,
            segments: segments,
            splitsSource: source
        )
    }

    private static func payload(
        label: SegmentLabel,
        index: Int?,
        start: Date,
        end: Date,
        distance: Double,
        duration: Double,
        heartRateSamples: [ActivityHeartRateSample]
    ) -> SegmentPayload {
            let heartRate = heartRateSamples
                .filter { $0.timestamp >= start && $0.timestamp <= end }
                .map(\.beatsPerMinute)
            let averageHR = heartRate.isEmpty ? nil : heartRate.reduce(0, +) / Double(heartRate.count)
            return SegmentPayload(
                label: label,
                index: index,
                distanceKm: distance / 1_000,
                durationSeconds: duration,
                avgPaceSecondsPerKm: distance > 0 ? duration / (distance / 1_000) : nil,
                avgHR: averageHR,
                peakHR: heartRate.max(),
                endHR: heartRate.last
            )
    }
}
