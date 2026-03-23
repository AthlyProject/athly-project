import Foundation

@MainActor
final class RunStore: ObservableObject {
    @Published private(set) var sessions: [RunSession] = []

    private static let fileName = "run_sessions.json"

    init() {
        load()
    }

    // MARK: - Public API

    func add(_ session: RunSession) {
        sessions.insert(session, at: 0)
        save()
    }

    func update(_ session: RunSession) {
        if let index = sessions.firstIndex(where: { $0.id == session.id }) {
            sessions[index] = session
            save()
        }
    }

    func delete(_ session: RunSession) {
        sessions.removeAll { $0.id == session.id }
        save()
    }

    /// Sessions sorted by startDate descending (most recent first).
    var sortedSessions: [RunSession] {
        sessions.sorted { $0.startDate > $1.startDate }
    }

    // MARK: - Persistence

    private static var fileURL: URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return docs.appendingPathComponent(fileName)
    }

    private func save() {
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(sessions)
            try data.write(to: Self.fileURL, options: .atomic)
        } catch {
            print("[RunStore] Failed to save: \(error)")
        }
    }

    private func load() {
        let url = Self.fileURL
        guard FileManager.default.fileExists(atPath: url.path) else { return }
        do {
            let data = try Data(contentsOf: url)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            sessions = try decoder.decode([RunSession].self, from: data)
        } catch {
            print("[RunStore] Failed to load: \(error)")
        }
    }
}
