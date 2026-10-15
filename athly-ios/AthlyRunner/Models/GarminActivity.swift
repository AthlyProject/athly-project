import CoreLocation
import Foundation

/// Corrida gravada pelo campo de dados da Athly no Garmin e enviada pelo próprio relógio, esperando
/// o atleta decidir (vincular a um treino, salvar como corrida livre ou ignorar) — o mesmo pop-up
/// de uma corrida detectada no Apple Health. Espelha `ConnectIqActivitySummaryModel` do backend.
struct GarminActivitySummary: Decodable, Identifiable, Sendable, Equatable {
    let id: String
    /// Datas ISO 8601 com milissegundos (o decoder padrão do app não aceita frações de segundo).
    let startedAt: String
    let endedAt: String
    let utcOffsetSec: Int
    let distanceMeters: Double
    /// Tempo com o cronômetro rodando (sem pausas).
    let timerSeconds: Double
    let avgHeartRate: Int?
    let maxHeartRate: Int?
}

/// Detalhe com a rota, as voltas (passos do treino) e as pausas. Espelha `ConnectIqActivityDetailModel`.
struct GarminActivityDetail: Decodable, Sendable {
    struct Lap: Decodable, Sendable, Equatable {
        let index: Int
        let startedAt: String
        let endedAt: String
        let distanceMeters: Double
        let timerSeconds: Double
        let avgHeartRate: Int?
        let maxHeartRate: Int?
        /// `Activity.WorkoutIntensity` do passo; `nil` numa volta sem treino.
        let intensity: Int?
    }

    struct Pause: Decodable, Sendable, Equatable {
        let startedAt: String
        let endedAt: String
    }

    let id: String
    let startedAt: String
    let endedAt: String
    let utcOffsetSec: Int
    let distanceMeters: Double
    let timerSeconds: Double
    let avgHeartRate: Int?
    let maxHeartRate: Int?
    let laps: [Lap]
    let pauses: [Pause]
    /// `[segundos desde o início, latitude, longitude, FC em bpm (0 = sem FC)]`.
    let points: [[Double]]
}

struct ResolveGarminActivityRequest: Encodable, Sendable {
    let resolution: GarminActivityResolution
    let workoutId: String?
}

enum GarminActivityResolution: String, Encodable, Sendable {
    case linked
    case freeRun = "free_run"
    case dismissed
}

enum GarminActivityConversionError: Error, Equatable {
    case invalidDates
}

extension GarminActivityDetail {
    private static func date(_ iso: String) -> Date? {
        try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(iso)
    }

    /// Normaliza para o mesmo modelo de um FIT importado: daí em diante a corrida segue o caminho já
    /// existente de conclusão (`WorkoutCompletionSelection.imported`), que reconstrói os segmentos,
    /// salva no Apple Health e anexa a rota ao registro que o Garmin Connect já tenha criado lá.
    func importedWorkout() throws -> ImportedWorkout {
        guard let start = Self.date(startedAt), let end = Self.date(endedAt), end > start else {
            throw GarminActivityConversionError.invalidDates
        }

        var route: [CLLocation] = []
        var heartRates: [ActivityHeartRateSample] = []
        route.reserveCapacity(points.count)
        for point in points where point.count >= 3 {
            let timestamp = start.addingTimeInterval(point[0])
            let coordinate = CLLocationCoordinate2D(latitude: point[1], longitude: point[2])
            guard CLLocationCoordinate2DIsValid(coordinate) else { continue }
            route.append(CLLocation(
                coordinate: coordinate,
                altitude: 0,
                horizontalAccuracy: 10,
                verticalAccuracy: -1,
                timestamp: timestamp
            ))
            if point.count >= 4, point[3] > 0 {
                heartRates.append(ActivityHeartRateSample(timestamp: timestamp, beatsPerMinute: point[3]))
            }
        }

        let activityLaps: [ActivityLap] = laps.compactMap { lap in
            guard let lapStart = Self.date(lap.startedAt), let lapEnd = Self.date(lap.endedAt) else { return nil }
            return ActivityLap(
                index: lap.index,
                startDate: lapStart,
                endDate: lapEnd,
                distanceMeters: lap.distanceMeters,
                durationSeconds: lap.timerSeconds,
                averageHeartRate: lap.avgHeartRate.map(Double.init),
                maximumHeartRate: lap.maxHeartRate.map(Double.init)
            )
        }
        let pauseIntervals: [SplitCalculator.PauseInterval] = pauses.compactMap { pause in
            guard let pauseStart = Self.date(pause.startedAt), let pauseEnd = Self.date(pause.endedAt),
                  pauseEnd > pauseStart else { return nil }
            return SplitCalculator.PauseInterval(start: pauseStart, end: pauseEnd)
        }

        return ImportedWorkout(
            format: .connectIQ,
            fingerprint: WorkoutImportFingerprint.make(
                startDate: start,
                durationSeconds: timerSeconds,
                distanceMeters: distanceMeters,
                route: route
            ),
            originalFileName: "garmin-\(id)",
            activityName: String(localized: "Corrida no Garmin"),
            sportType: "running",
            startDate: start,
            endDate: end,
            activeDurationSeconds: timerSeconds,
            totalDurationSeconds: end.timeIntervalSince(start),
            distanceMeters: distanceMeters,
            isIndoor: route.isEmpty,
            route: route,
            heartRateSamples: heartRates,
            laps: activityLaps,
            pauseIntervals: pauseIntervals
        )
    }
}

extension ImportedWorkout {
    /// Resumo no formato que o pop-up de corrida detectada já sabe mostrar.
    func detectedRunSummary(id: String, averageHeartRate: Int?, maximumHeartRate: Int?) -> HealthKitRunItem {
        HealthKitRunItem(
            id: id,
            startDate: startDate,
            endDate: endDate,
            durationSeconds: activeDurationSeconds,
            distanceMeters: distanceMeters,
            averagePaceSecondsPerKm: averagePaceSecondsPerKm,
            activeEnergyBurned: caloriesBurned,
            elevationGainMeters: nil,
            avgHR: averageHeartRate.map(Double.init) ?? self.averageHeartRate,
            maxHR: maximumHeartRate.map(Double.init) ?? self.maximumHeartRate
        )
    }

    /// Rota e parciais para o mapa do pop-up (o equivalente ao `fetchRunDetail` do Apple Health).
    var routeDetail: RunRouteDetail {
        RunRouteDetail(
            coordinates: route.map { RunCoordinate(latitude: $0.coordinate.latitude, longitude: $0.coordinate.longitude) },
            splits: hasRoute ? SplitCalculator.kmSplits(from: route, pauses: pauseIntervals) : [],
            segmentRecords: [],
            avgHR: averageHeartRate,
            maxHR: maximumHeartRate
        )
    }
}
