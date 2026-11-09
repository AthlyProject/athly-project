import XCTest
@testable import AthlyRunner

final class WorkoutSpeechFormatterTests: XCTestCase {
    func testBoundariesUseAppLanguageInsteadOfStoredPlanLabel() {
        let cases: [(WorkoutSpeechLanguage, String)] = [
            (.portuguese, "Tiro 3 de 6, 400 metros"),
            (.english, "Interval 3 of 6, 400 meters"),
            (.german, "Intervall 3 von 6, 400 Meter"),
        ]
        for (language, expected) in cases {
            XCTAssertEqual(WorkoutSpeechFormatter(language: language).boundary(for: segment(.work, .distanceM, 400, index: 3, total: 6)), expected)
        }
    }

    func testEveryBlockKindHasTranslation() {
        let kinds: [SegmentKind] = [.warmup, .work, .recovery, .cooldown, .rest, .set, .unknown]
        let cases: [(WorkoutSpeechLanguage, [String])] = [
            (.portuguese, ["Aquecimento", "Tiro", "Recuperação", "Desaceleramento", "Descanso", "Próximo bloco", "Próximo bloco"]),
            (.english, ["Warm-up", "Interval", "Recovery", "Cool-down", "Rest", "Next block", "Next block"]),
            (.german, ["Aufwärmen", "Intervall", "Erholung", "Abwärmen", "Pause", "Nächster Abschnitt", "Nächster Abschnitt"]),
        ]
        for (language, labels) in cases {
            let formatter = WorkoutSpeechFormatter(language: language)
            for (kind, label) in zip(kinds, labels) {
                XCTAssertTrue(formatter.boundary(for: segment(kind, .durationSec, 30)).hasPrefix(label + ", "))
            }
        }
    }

    func testSpokenUnitsAndPluralizationInAllLanguages() {
        let cases: [(WorkoutSpeechLanguage, [String])] = [
            (.portuguese, ["1 metro", "400 metros", "1 quilômetro", "1,25 quilômetros", "1 segundo", "30 segundos", "1 minuto", "2 minutos", "1 minuto e 30 segundos", "1 minuto e 1 segundo", "1 repetição", "2 repetições"]),
            (.english, ["1 meter", "400 meters", "1 kilometer", "1.25 kilometers", "1 second", "30 seconds", "1 minute", "2 minutes", "1 minute and 30 seconds", "1 minute and 1 second", "1 repetition", "2 repetitions"]),
            (.german, ["1 Meter", "400 Meter", "1 Kilometer", "1,25 Kilometer", "1 Sekunde", "30 Sekunden", "1 Minute", "2 Minuten", "1 Minute und 30 Sekunden", "1 Minute und 1 Sekunde", "1 Wiederholung", "2 Wiederholungen"]),
        ]
        for (language, expected) in cases {
            let formatter = WorkoutSpeechFormatter(language: language)
            let actual = [1.0, 400, 1000, 1250].map { formatter.distance(meters: $0) }
                + [1, 30, 60, 120, 90, 61].map { formatter.duration(seconds: $0) }
                + [1.0, 2].map { formatter.boundary(for: segment(.work, .reps, $0)).components(separatedBy: ", ").last! }
            XCTAssertEqual(actual, expected, language.rawValue)
        }
    }

    func testSetCompletionAndBothTargetAlerts() throws {
        let cases: [(WorkoutSpeechLanguage, String, String, String)] = [
            (.portuguese, "Série concluída", "Ponto de retorno alcançado, 1,25 quilômetros.", "Ponto de retorno alcançado, 1 minuto e 30 segundos."),
            (.english, "Set completed", "Turnaround point reached, 1.25 kilometers.", "Turnaround point reached, 1 minute and 30 seconds."),
            (.german, "Serie abgeschlossen", "Umkehrpunkt erreicht, 1,25 Kilometer.", "Umkehrpunkt erreicht, 1 Minute und 30 Sekunden."),
        ]
        for (language, completion, distance, time) in cases {
            let formatter = WorkoutSpeechFormatter(language: language)
            XCTAssertEqual(formatter.setComplete, completion)
            XCTAssertEqual(formatter.targetReached(try XCTUnwrap(RunTargetAlert(kind: .distance, value: 1.25))), distance)
            XCTAssertEqual(formatter.targetReached(try XCTUnwrap(RunTargetAlert(kind: .time, value: 1.5))), time)
        }
    }

    func testLanguageResolutionAndVoiceFallback() {
        XCTAssertEqual(WorkoutSpeechLanguage(identifier: "en-GB"), .english)
        XCTAssertEqual(WorkoutSpeechLanguage(identifier: "de_AT"), .german)
        XCTAssertEqual(WorkoutSpeechLanguage(identifier: "pt-PT"), .portuguese)
        XCTAssertEqual(WorkoutSpeechLanguage(identifier: "fr"), .portuguese)
        for language in WorkoutSpeechLanguage.allCases {
            let alternate: String
            switch language {
            case .portuguese: alternate = "pt-PT"
            case .english: alternate = "en-GB"
            case .german: alternate = "de-AT"
            }
            let exact = (identifier: "preferred", language: language.voiceLanguage)
            let fallback = (identifier: "alternate", language: alternate)
            XCTAssertEqual(language.voiceIdentifier(in: [fallback, exact]), "preferred")
            XCTAssertEqual(language.voiceIdentifier(in: [fallback]), "alternate")
            XCTAssertNil(language.voiceIdentifier(in: [("unrelated", "fr-FR")]))
            XCTAssertNil(language.voiceIdentifier(in: []))
        }
    }

    private func segment(_ kind: SegmentKind, _ by: SegmentEndBy, _ value: Double, index: Int? = nil, total: Int? = nil) -> ActiveSegment {
        ActiveSegment(id: UUID(), sourceSegmentId: "test", kind: kind, setIndex: index, setTotal: total,
                      end: SegmentEndCondition(by: by, value: value), target: nil, label: "Rótulo antigo em português")
    }
}
