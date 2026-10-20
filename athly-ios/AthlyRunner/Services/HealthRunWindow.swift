import Foundation

/// Leitura das corridas para o planner: todas as das últimas 9 semanas, no mínimo as 20 mais
/// recentes e no máximo 60. O motor de viabilidade do backend mede o volume de 6 semanas (meia)
/// a 8 (maratona); só as 20 mais recentes cobriam ~5 semanas de quem corre 4 vezes por semana, e
/// quem cumpriu o plano inteiro saía com "resistência não demonstrada".
enum HealthRunWindow {
    static let days = 63
    static let minimumRuns = 20
    static let maximumRuns = 60
    private static let pageSize = 20
    /// Com o Health inteiro lido, o backend considera um ano de histórico (o mesmo de antes).
    private static let fullHistoryDays = 365

    struct Read {
        /// Da mais recente para a mais antiga.
        let runs: [HealthKitRunItem]
        /// Todas as corridas que começaram a partir desta data estão em `runs`.
        let readFrom: Date
    }

    /// `page` devolve até `limit` corridas terminadas antes do cursor, da mais recente para a mais antiga.
    static func read(
        now: Date = Date(),
        page: @Sendable (_ limit: Int, _ beforeEndDate: Date?) async throws -> [HealthKitRunItem]
    ) async throws -> Read {
        let since = now.addingTimeInterval(-Double(days) * 86_400)
        var all: [HealthKitRunItem] = []
        var exhausted = false
        var cursor: Date?
        repeat {
            let batch = try await page(pageSize, cursor)
            all += batch
            guard batch.count == pageSize, let oldest = batch.last else {
                exhausted = true
                break
            }
            cursor = oldest.endDate
        } while all.count < maximumRuns && (all.count < minimumRuns || (all.last?.startDate ?? since) >= since)

        let inWindow = all.filter { $0.startDate >= since }
        let chosen = inWindow.count >= minimumRuns ? inWindow : Array(all.prefix(minimumRuns))
        let runs = Array(chosen.prefix(maximumRuns))
        // A leitura passou do início da janela: tudo dentro dela foi lido.
        let reachedWindowStart = exhausted || (all.last.map { $0.startDate < since } ?? true)
        let readFrom: Date
        if exhausted && runs.count == all.count {
            readFrom = now.addingTimeInterval(-Double(fullHistoryDays) * 86_400)
        } else if reachedWindowStart && runs.count == inWindow.count && inWindow.count >= minimumRuns {
            readFrom = since
        } else {
            // Parou no teto ou ficou só com as 20 mais recentes: completo a partir da mais antiga.
            readFrom = runs.last?.startDate ?? since
        }
        return Read(runs: runs, readFrom: readFrom)
    }
}
