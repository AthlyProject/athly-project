import Foundation
import CoreLocation
import CryptoKit
import FITSwiftSDK

struct WorkoutImportService: Sendable {
    static let maximumFileSize = 50 * 1_024 * 1_024

    func importActivities(from url: URL) throws -> [ImportedWorkout] {
        let hasAccess = url.startAccessingSecurityScopedResource()
        defer {
            if hasAccess { url.stopAccessingSecurityScopedResource() }
        }

        let values = try url.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey])
        guard values.isRegularFile != false else {
            throw WorkoutImportError.invalidFile("o item selecionado não é um arquivo")
        }
        if let size = values.fileSize, size > Self.maximumFileSize {
            throw WorkoutImportError.fileTooLarge
        }

        let data = try Data(contentsOf: url, options: [.mappedIfSafe])
        guard data.count <= Self.maximumFileSize else { throw WorkoutImportError.fileTooLarge }

        let fileName = url.lastPathComponent
        let ext = url.pathExtension.lowercased()
        let activities: [ImportedWorkout]

        switch ext {
        case "fit":
            activities = try FITWorkoutParser.parse(data: data, fileName: fileName)
        case "tcx":
            activities = try XMLWorkoutParser.parse(data: data, expected: .tcx, fileName: fileName)
        case "gpx":
            activities = try XMLWorkoutParser.parse(data: data, expected: .gpx, fileName: fileName)
        default:
            throw WorkoutImportError.unsupportedFormat
        }

        guard !activities.isEmpty else { throw WorkoutImportError.noActivities }
        return activities
    }
}

enum WorkoutImportFingerprint {
    static func make(
        startDate: Date,
        durationSeconds: Double,
        distanceMeters: Double,
        route: [CLLocation]
    ) -> String {
        let roundedStart = Int(startDate.timeIntervalSince1970 / 5) * 5
        let roundedDuration = Int(durationSeconds / 5) * 5
        let roundedDistance = Int(distanceMeters / 10) * 10
        let first = route.first.map { String(format: "%.4f,%.4f", $0.coordinate.latitude, $0.coordinate.longitude) } ?? "-"
        let last = route.last.map { String(format: "%.4f,%.4f", $0.coordinate.latitude, $0.coordinate.longitude) } ?? "-"
        let canonical = "\(roundedStart)|\(roundedDuration)|\(roundedDistance)|\(first)|\(last)"
        return SHA256.hash(data: Data(canonical.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

// MARK: - FIT

private enum FITWorkoutParser {
    static func parse(data: Data, fileName: String) throws -> [ImportedWorkout] {
        let integrityStream = FITSwiftSDK.InputStream(data: data)
        let integrityDecoder = Decoder(stream: integrityStream)
        guard (try? integrityDecoder.isFIT()) == true else {
            throw WorkoutImportError.invalidFile("cabeçalho FIT inválido")
        }
        guard (try? integrityDecoder.checkIntegrity()) == true else {
            throw WorkoutImportError.invalidFile("CRC FIT inválido ou arquivo truncado")
        }

        let stream = FITSwiftSDK.InputStream(data: data)
        let decoder = Decoder(stream: stream)
        let listener = FitListener()
        decoder.addMesgListener(listener)
        do {
            try decoder.read()
        } catch {
            throw WorkoutImportError.invalidFile("FIT corrompido (\(error.localizedDescription))")
        }

        let messages = listener.fitMessages
        guard !messages.sessionMesgs.isEmpty else { throw WorkoutImportError.noActivities }

        var encounteredIncompatibleActivity = false
        let imported = try messages.sessionMesgs.enumerated().compactMap { sessionIndex, session -> ImportedWorkout? in
            let sport = session.getSport()
            if let sport, sport != .running && sport != .generic && sport != .invalid {
                encounteredIncompatibleActivity = true
                return nil
            }

            let sessionStart = session.getStartTime()?.date
            let sessionEnd = session.getTimestamp()?.date
            let allRecords = messages.recordMesgs.compactMap { record -> FITRecord? in
                guard let timestamp = record.getTimestamp()?.date else { return nil }
                return FITRecord(
                    timestamp: timestamp,
                    latitude: record.getPositionLat().map(semicirclesToDegrees),
                    longitude: record.getPositionLong().map(semicirclesToDegrees),
                    altitude: record.getEnhancedAltitude() ?? record.getAltitude(),
                    heartRate: record.getHeartRate().map(Double.init)
                )
            }
            let records = allRecords.filter { record in
                guard let sessionStart else { return true }
                let upper = sessionEnd ?? .distantFuture
                return record.timestamp >= sessionStart.addingTimeInterval(-1)
                    && record.timestamp <= upper.addingTimeInterval(1)
            }
            guard let startDate = sessionStart ?? records.first?.timestamp else {
                throw WorkoutImportError.invalidFile("atividade FIT sem horário inicial")
            }

            let activeDuration = session.getTotalTimerTime()
                ?? session.getTotalElapsedTime()
                ?? sessionEnd?.timeIntervalSince(startDate)
                ?? records.last?.timestamp.timeIntervalSince(startDate)
                ?? 0
            let totalDuration = session.getTotalElapsedTime()
                ?? sessionEnd?.timeIntervalSince(startDate)
                ?? activeDuration
            let endDate = sessionEnd ?? startDate.addingTimeInterval(max(activeDuration, totalDuration))
            guard endDate > startDate, activeDuration > 0 else {
                throw WorkoutImportError.invalidFile("atividade FIT sem duração")
            }

            let route = records.compactMap { record -> CLLocation? in
                guard let lat = record.latitude, let lon = record.longitude,
                      (-90...90).contains(lat), (-180...180).contains(lon) else { return nil }
                return CLLocation(
                    coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lon),
                    altitude: record.altitude ?? 0,
                    horizontalAccuracy: -1,
                    verticalAccuracy: -1,
                    timestamp: record.timestamp
                )
            }
            let heartRate = records.compactMap { record in
                record.heartRate.map { ActivityHeartRateSample(timestamp: record.timestamp, beatsPerMinute: $0) }
            }
            let laps = messages.lapMesgs
                .filter { lap in
                    guard let lapStart = lap.getStartTime()?.date else { return false }
                    return lapStart >= startDate.addingTimeInterval(-1) && lapStart < endDate.addingTimeInterval(1)
                }
                .enumerated()
                .compactMap { index, lap -> ActivityLap? in
                    guard let lapStart = lap.getStartTime()?.date else { return nil }
                    let duration = lap.getTotalTimerTime() ?? lap.getTotalElapsedTime() ?? 0
                    let lapEnd = lap.getTimestamp()?.date ?? lapStart.addingTimeInterval(duration)
                    guard lapEnd > lapStart else { return nil }
                    return ActivityLap(
                        index: index + 1,
                        startDate: lapStart,
                        endDate: lapEnd,
                        distanceMeters: lap.getTotalDistance() ?? 0,
                        durationSeconds: duration,
                        averageHeartRate: lap.getAvgHeartRate().map(Double.init),
                        maximumHeartRate: lap.getMaxHeartRate().map(Double.init)
                    )
                }
            let pauseIntervals = pauseIntervalsFromFIT(
                events: messages.eventMesgs,
                startDate: startDate,
                endDate: endDate
            )
            let distance = session.getTotalDistance() ?? derivedDistance(route)
            guard distance > 0 else {
                throw WorkoutImportError.invalidFile("atividade FIT sem distância")
            }

            var warnings: [String] = []
            if route.count < 2 { warnings.append("O arquivo não contém uma rota GPS utilizável.") }
            let subSport = session.getSubSport()
            let indoor = subSport == .treadmill || subSport == .indoorRunning
            let elevation = Double(session.getTotalAscent() ?? 0)
            let fingerprint = WorkoutImportFingerprint.make(
                startDate: startDate,
                durationSeconds: activeDuration,
                distanceMeters: distance,
                route: route
            )

            return ImportedWorkout(
                format: .fit,
                fingerprint: fingerprint,
                originalFileName: fileName,
                activityName: messages.sessionMesgs.count > 1 ? "Atividade \(sessionIndex + 1)" : nil,
                sportType: "running",
                startDate: startDate,
                endDate: endDate,
                activeDurationSeconds: activeDuration,
                totalDurationSeconds: max(totalDuration, activeDuration),
                distanceMeters: distance,
                caloriesBurned: Double(session.getTotalCalories() ?? 0),
                elevationGainMeters: elevation > 0 ? elevation : derivedElevationGain(route),
                isIndoor: indoor,
                route: route,
                heartRateSamples: heartRate,
                laps: laps,
                pauseIntervals: pauseIntervals,
                warnings: warnings
            )
        }
        if imported.isEmpty && encounteredIncompatibleActivity {
            throw WorkoutImportError.incompatibleActivity
        }
        return imported
    }

    private struct FITRecord {
        let timestamp: Date
        let latitude: Double?
        let longitude: Double?
        let altitude: Double?
        let heartRate: Double?
    }

    private static func semicirclesToDegrees(_ value: Int32) -> Double {
        Double(value) * 180.0 / 2_147_483_648.0
    }

    private static func pauseIntervalsFromFIT(
        events: [EventMesg],
        startDate: Date,
        endDate: Date
    ) -> [SplitCalculator.PauseInterval] {
        let timerEvents = events
            .filter { $0.getEvent() == .timer && $0.getTimestamp() != nil }
            .sorted { $0.getTimestamp()!.date < $1.getTimestamp()!.date }
        var pauseStart: Date?
        var intervals: [SplitCalculator.PauseInterval] = []
        for event in timerEvents {
            guard let date = event.getTimestamp()?.date else { continue }
            switch event.getEventType() {
            case .stop, .stopAll, .stopDisable, .stopDisableAll:
                if date > startDate, pauseStart == nil { pauseStart = date }
            case .start:
                if let opened = pauseStart, date > opened {
                    intervals.append(.init(start: opened, end: min(date, endDate)))
                    pauseStart = nil
                }
            default:
                break
            }
        }
        if let pauseStart, endDate > pauseStart {
            intervals.append(.init(start: pauseStart, end: endDate))
        }
        return intervals
    }
}

// MARK: - TCX / GPX

private enum XMLWorkoutParser {
    static func parse(data: Data, expected: WorkoutImportFormat, fileName: String) throws -> [ImportedWorkout] {
        guard expected == .tcx || expected == .gpx else { throw WorkoutImportError.unsupportedFormat }
        guard let prefix = String(data: data.prefix(4_096), encoding: .utf8)?.lowercased() else {
            throw WorkoutImportError.invalidFile("XML inválido")
        }
        if expected == .tcx, !prefix.contains("trainingcenterdatabase") {
            throw WorkoutImportError.invalidFile("o conteúdo não é TCX")
        }
        if expected == .gpx, !prefix.contains("<gpx") {
            throw WorkoutImportError.invalidFile("o conteúdo não é GPX")
        }

        let delegate = XMLWorkoutDelegate(format: expected, fileName: fileName)
        let parser = XMLParser(data: data)
        parser.shouldProcessNamespaces = false
        parser.shouldResolveExternalEntities = false
        parser.delegate = delegate
        guard parser.parse() else {
            throw WorkoutImportError.invalidFile(parser.parserError?.localizedDescription ?? "XML malformado")
        }
        if let error = delegate.validationError { throw error }
        return try delegate.buildActivities()
    }
}

private final class XMLWorkoutDelegate: NSObject, XMLParserDelegate {
    private let format: WorkoutImportFormat
    private let fileName: String
    private var stack: [String] = []
    private var text = ""
    private var current: XMLActivityBuilder?
    private var currentPoint: XMLPointBuilder?
    private var currentLap: XMLLapBuilder?
    private var activities: [XMLActivityBuilder] = []
    fileprivate var validationError: WorkoutImportError?

    init(format: WorkoutImportFormat, fileName: String) {
        self.format = format
        self.fileName = fileName
    }

    func parser(
        _ parser: XMLParser,
        didStartElement elementName: String,
        namespaceURI: String?,
        qualifiedName qName: String?,
        attributes attributeDict: [String: String] = [:]
    ) {
        let name = localName(elementName)
        stack.append(name)
        text = ""

        if format == .tcx, name == "activity" {
            finishCurrentActivity()
            current = XMLActivityBuilder(format: .tcx, sport: attributeValue(attributeDict, named: "sport"))
        } else if format == .gpx, name == "trk" {
            finishCurrentActivity()
            current = XMLActivityBuilder(format: .gpx, sport: nil)
        } else if name == "lap", format == .tcx {
            currentLap = XMLLapBuilder(startDate: parseDate(attributeValue(attributeDict, named: "starttime")))
        } else if name == "trackpoint", format == .tcx {
            currentPoint = XMLPointBuilder()
        } else if name == "trkpt", format == .gpx {
            currentPoint = XMLPointBuilder(
                latitude: Double(attributeValue(attributeDict, named: "lat") ?? ""),
                longitude: Double(attributeValue(attributeDict, named: "lon") ?? "")
            )
        } else if name == "trkseg", format == .gpx,
                  let last = current?.points.last?.timestamp {
            current?.segmentBreaks.append(last)
        }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        text += string
    }

    func parser(
        _ parser: XMLParser,
        didEndElement elementName: String,
        namespaceURI: String?,
        qualifiedName qName: String?
    ) {
        let name = localName(elementName)
        let value = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let parents = Set(stack.dropLast())

        if let point = currentPoint {
            switch name {
            case "time": point.timestamp = parseDate(value)
            case "latitudedegrees": point.latitude = Double(value)
            case "longitudedegrees": point.longitude = Double(value)
            case "altitudemeters", "ele": point.altitude = Double(value)
            case "distancemeters": point.distanceMeters = Double(value)
            case "value" where parents.contains("heartratebpm"):
                point.heartRate = Double(value)
            case "hr":
                point.heartRate = Double(value)
            default: break
            }
        }

        if let lap = currentLap {
            switch name {
            case "totaltimeseconds": lap.durationSeconds = Double(value)
            case "distancemeters" where !parents.contains("trackpoint"):
                lap.distanceMeters = Double(value)
            case "calories": lap.calories = Double(value)
            case "averageheartratebpm": break
            case "maximumheartratebpm": break
            case "value" where parents.contains("averageheartratebpm"):
                lap.averageHeartRate = Double(value)
            case "value" where parents.contains("maximumheartratebpm"):
                lap.maximumHeartRate = Double(value)
            default: break
            }
        }

        switch name {
        case "id" where format == .tcx && parents.contains("activity"):
            if current?.startDate == nil { current?.startDate = parseDate(value) }
        case "name" where format == .gpx:
            if current?.name == nil { current?.name = value }
        case "type" where format == .gpx:
            current?.sport = value
        case "trackpoint", "trkpt":
            if let point = currentPoint { current?.points.append(point) }
            currentPoint = nil
        case "lap" where format == .tcx:
            if let lap = currentLap { current?.laps.append(lap) }
            currentLap = nil
        case "activity" where format == .tcx, "trk" where format == .gpx:
            finishCurrentActivity()
        default:
            break
        }

        if !stack.isEmpty { stack.removeLast() }
        text = ""
    }

    func parser(_ parser: XMLParser, parseErrorOccurred parseError: Error) {
        validationError = .invalidFile(parseError.localizedDescription)
    }

    fileprivate func buildActivities() throws -> [ImportedWorkout] {
        finishCurrentActivity()
        let compatibleActivities = activities.filter { !$0.isExplicitlyIncompatible }
        if compatibleActivities.isEmpty && !activities.isEmpty {
            throw WorkoutImportError.incompatibleActivity
        }
        let built = try compatibleActivities.enumerated().map { index, builder in
            try builder.build(
                fileName: fileName,
                activityIndex: index,
                activityCount: compatibleActivities.count
            )
        }
        guard !built.isEmpty else { throw WorkoutImportError.noActivities }
        return built
    }

    private func finishCurrentActivity() {
        if let current { activities.append(current) }
        current = nil
    }

    private func localName(_ name: String) -> String {
        (name.split(separator: ":").last.map(String.init) ?? name).lowercased()
    }

    private func attributeValue(_ attributes: [String: String], named name: String) -> String? {
        attributes.first { localName($0.key) == name.lowercased() }?.value
    }

    private func parseDate(_ value: String?) -> Date? {
        guard let value, !value.isEmpty else { return nil }
        return WorkoutImportDateParser.parse(value)
    }
}

private final class XMLActivityBuilder {
    let format: WorkoutImportFormat
    var name: String?
    var sport: String?
    var startDate: Date?
    var points: [XMLPointBuilder] = []
    var laps: [XMLLapBuilder] = []
    var segmentBreaks: [Date] = []

    init(format: WorkoutImportFormat, sport: String?) {
        self.format = format
        self.sport = sport
    }

    var isExplicitlyIncompatible: Bool {
        guard let declaredSport = sport?.lowercased(),
              !declaredSport.contains("run"),
              declaredSport != "other",
              declaredSport != "trail running" else { return false }
        return ["cycling", "biking", "bike", "walking", "hiking", "swimming"]
            .contains(where: declaredSport.contains)
    }

    func build(fileName: String, activityIndex: Int, activityCount: Int) throws -> ImportedWorkout {
        let sortedPoints = points.compactMap { point -> XMLPointBuilder? in
            guard point.timestamp != nil else { return nil }
            return point
        }.sorted { $0.timestamp! < $1.timestamp! }

        let declaredSport = sport?.lowercased()
        if isExplicitlyIncompatible {
            throw WorkoutImportError.incompatibleActivity
        }

        let lapStart = laps.compactMap(\.startDate).min()
        guard let start = startDate ?? lapStart ?? sortedPoints.first?.timestamp else {
            throw WorkoutImportError.invalidFile("atividade sem horário inicial")
        }
        let lapDuration = laps.compactMap(\.durationSeconds).reduce(0, +)
        let pointEnd = sortedPoints.last?.timestamp
        let latestLapEnd = laps.compactMap { lap -> Date? in
            guard let lapStart = lap.startDate,
                  let duration = lap.durationSeconds,
                  duration > 0 else { return nil }
            return lapStart.addingTimeInterval(duration)
        }.max()
        let end = [pointEnd, latestLapEnd].compactMap { $0 }.max()
            ?? (lapDuration > 0 ? start.addingTimeInterval(lapDuration) : nil)
        guard let end, end > start else {
            throw WorkoutImportError.invalidFile("atividade sem duração")
        }

        let route = sortedPoints.compactMap { point -> CLLocation? in
            guard let lat = point.latitude, let lon = point.longitude,
                  (-90...90).contains(lat), (-180...180).contains(lon) else { return nil }
            return CLLocation(
                coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lon),
                altitude: point.altitude ?? 0,
                horizontalAccuracy: -1,
                verticalAccuracy: -1,
                timestamp: point.timestamp!
            )
        }
        if format == .gpx, route.count < 2 {
            throw WorkoutImportError.invalidFile("GPX sem rota e timestamps utilizáveis")
        }

        let declaredDistance = laps.compactMap(\.distanceMeters).reduce(0, +)
        let pointDistance = sortedPoints.compactMap(\.distanceMeters).max() ?? 0
        let distance = declaredDistance > 0 ? declaredDistance : (pointDistance > 0 ? pointDistance : derivedDistance(route))
        guard distance > 0 else { throw WorkoutImportError.invalidFile("atividade sem distância") }

        let activeDuration = lapDuration > 0 ? lapDuration : end.timeIntervalSince(start)
        let totalDuration = end.timeIntervalSince(start)
        let heartRate: [ActivityHeartRateSample] = sortedPoints.compactMap { point -> ActivityHeartRateSample? in
            guard let timestamp = point.timestamp, let bpm = point.heartRate, bpm > 0 else { return nil }
            return ActivityHeartRateSample(timestamp: timestamp, beatsPerMinute: bpm)
        }
        let builtLaps = laps.enumerated().compactMap { index, lap -> ActivityLap? in
            guard let lapStart = lap.startDate else { return nil }
            let duration = lap.durationSeconds ?? 0
            let lapEnd = lapStart.addingTimeInterval(duration)
            guard duration > 0 else { return nil }
            return ActivityLap(
                index: index + 1,
                startDate: lapStart,
                endDate: lapEnd,
                distanceMeters: lap.distanceMeters ?? 0,
                durationSeconds: duration,
                averageHeartRate: lap.averageHeartRate,
                maximumHeartRate: lap.maximumHeartRate
            )
        }
        var pauses: [SplitCalculator.PauseInterval] = []
        if builtLaps.count > 1 {
            for index in 1..<builtLaps.count {
                let previousEnd = builtLaps[index - 1].endDate
                let nextStart = builtLaps[index].startDate
                if nextStart.timeIntervalSince(previousEnd) > 1 {
                    pauses.append(.init(start: previousEnd, end: nextStart))
                }
            }
        }
        if format == .gpx {
            for segmentEnd in segmentBreaks {
                if let nextStart = sortedPoints
                    .compactMap(\.timestamp)
                    .first(where: { $0 > segmentEnd }),
                   nextStart.timeIntervalSince(segmentEnd) > 1 {
                    pauses.append(.init(start: segmentEnd, end: nextStart))
                }
            }
        }

        let isIndoor = declaredSport?.contains("treadmill") == true || declaredSport?.contains("indoor") == true
        var warnings: [String] = []
        if format == .gpx && declaredSport == nil {
            warnings.append("O GPX não informa a modalidade; ele será importado como corrida.")
        }
        if route.count < 2 { warnings.append("O arquivo não contém uma rota GPS utilizável.") }
        let fingerprint = WorkoutImportFingerprint.make(
            startDate: start,
            durationSeconds: activeDuration,
            distanceMeters: distance,
            route: route
        )

        return ImportedWorkout(
            format: format,
            fingerprint: fingerprint,
            originalFileName: fileName,
            activityName: name ?? (activityCount > 1 ? "Atividade \(activityIndex + 1)" : nil),
            sportType: declaredSport,
            startDate: start,
            endDate: end,
            activeDurationSeconds: activeDuration,
            totalDurationSeconds: max(totalDuration, activeDuration),
            distanceMeters: distance,
            caloriesBurned: laps.compactMap(\.calories).reduce(0, +),
            elevationGainMeters: derivedElevationGain(route),
            isIndoor: isIndoor,
            route: route,
            heartRateSamples: heartRate,
            laps: builtLaps,
            pauseIntervals: pauses,
            warnings: warnings
        )
    }
}

private final class XMLPointBuilder {
    var timestamp: Date?
    var latitude: Double?
    var longitude: Double?
    var altitude: Double?
    var distanceMeters: Double?
    var heartRate: Double?

    init(latitude: Double? = nil, longitude: Double? = nil) {
        self.latitude = latitude
        self.longitude = longitude
    }
}

private final class XMLLapBuilder {
    let startDate: Date?
    var durationSeconds: Double?
    var distanceMeters: Double?
    var calories: Double?
    var averageHeartRate: Double?
    var maximumHeartRate: Double?

    init(startDate: Date?) { self.startDate = startDate }
}

private enum WorkoutImportDateParser {
    static func parse(_ string: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: string) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: string)
    }
}

private func derivedDistance(_ route: [CLLocation]) -> Double {
    guard route.count >= 2 else { return 0 }
    return zip(route, route.dropFirst()).reduce(0) { partial, pair in
        let distance = pair.1.distance(from: pair.0)
        guard distance.isFinite, distance >= 0, distance <= 1_000 else { return partial }
        return partial + distance
    }
}

private func derivedElevationGain(_ route: [CLLocation]) -> Double {
    guard route.count >= 2 else { return 0 }
    return zip(route, route.dropFirst()).reduce(0) { partial, pair in
        let gain = pair.1.altitude - pair.0.altitude
        return gain > 0 && gain < 100 ? partial + gain : partial
    }
}
