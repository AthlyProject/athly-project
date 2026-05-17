import Foundation
import SwiftUI

@MainActor
final class AdminViewModel: ObservableObject {
    @Published var weeks: [WeeklyGoalResponse] = []
    @Published var selectedWeekId: String?
    @Published var report: AdminWeeklyReportResponse?
    @Published var isLoadingWeeks = false
    @Published var isLoadingReport = false
    @Published var errorMessage: String?

    func loadWeeks() async {
        isLoadingWeeks = true
        errorMessage = nil
        defer { isLoadingWeeks = false }
        do {
            guard let plan = try await APIClient.shared.getMyTrainingPlan() else {
                weeks = []
                return
            }
            let goals = try await APIClient.shared.getWeeklyGoals(trainingPlanId: plan.id)
            weeks = goals.sorted { $0.parsedStartDate > $1.parsedStartDate }
            if selectedWeekId == nil, let first = weeks.first {
                selectedWeekId = first.id
                await loadReport(weekId: first.id)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadReport(weekId: String) async {
        isLoadingReport = true
        errorMessage = nil
        defer { isLoadingReport = false }
        do {
            report = try await APIClient.shared.getAdminWeeklyReport(weeklyGoalId: weekId)
        } catch {
            errorMessage = error.localizedDescription
            report = nil
        }
    }

    var composedReportText: String {
        guard let report else { return "" }
        var out: [String] = []
        out.append("=== ATHLY ADMIN REPORT ===")
        out.append("Semana: \(report.weekStartDate.prefix(10)) – \(report.weekEndDate.prefix(10))")
        if let log = report.promptLog {
            out.append("Modelo: \(log.modelUsed)")
            out.append("Prompt version: \(log.promptVersion)")
            out.append("Generation type: \(log.generationType)")
            out.append("Gerado em: \(log.createdAt)")
        }
        out.append("")
        out.append("--- CORRIDAS DA SEMANA (concluídas/parciais) ---")
        if report.workouts.isEmpty {
            out.append("(nenhuma corrida concluída registrada nesta semana)")
        } else {
            for w in report.workouts {
                let dist = w.actualDistanceMeters.map { String(format: "%.0f m", $0) } ?? "—"
                let dur = w.actualDurationSeconds.map { Self.formatDuration($0) } ?? "—"
                out.append("• \(w.dateScheduled.prefix(10)) | \(w.title) | dist=\(dist) | dur=\(dur) | status=\(w.status)")
                if let d = w.description, !d.isEmpty {
                    out.append("   desc: \(d)")
                }
            }
        }
        out.append("")
        out.append("--- METRICS (analysis salva pela IA) ---")
        if let m = report.metrics {
            out.append("trend: \(m.trend ?? "—")")
            out.append("avgPace: \(m.avgPace ?? "—")")
            out.append("totalDistanceKm: \(m.totalDistanceKm.map { String($0) } ?? "—")")
            out.append("runsAnalyzed: \(m.runsAnalyzed.map { String($0) } ?? "—")")
            out.append("period: \(m.period ?? "—")")
            out.append("avgDistanceKm: \(m.avgDistanceKm.map { String($0) } ?? "—")")
            out.append("avgHeartRate: \(m.avgHeartRate.map { String($0) } ?? "—")")
            out.append("fitnessInsights: \(m.fitnessInsights ?? "—")")
        } else {
            out.append("(sem metrics)")
        }
        out.append("")
        out.append("--- PREVIOUS WEEK ANALYSIS ---")
        if let p = report.previousWeekAnalysis {
            out.append("completionRate: \(p.completionRate.map { String($0) } ?? "—")")
            out.append("totalDistanceKm: \(p.totalDistanceKm.map { String($0) } ?? "—")")
            out.append("avgEffort: \(p.avgEffort.map { String($0) } ?? "—")")
            out.append("avgFatigue: \(p.avgFatigue.map { String($0) } ?? "—")")
            out.append("volumeChange: \(p.volumeChange ?? "—")")
            out.append("adherenceNote: \(p.adherenceNote ?? "—")")
        } else {
            out.append("(sem previousWeekAnalysis)")
        }
        out.append("")
        out.append("--- PROMPT ENVIADO ---")
        out.append(report.promptLog?.promptText ?? "(sem prompt log)")
        out.append("")
        out.append("--- RESPONSE BRUTA DA IA ---")
        out.append(report.promptLog?.rawResponse ?? "(sem response log)")
        out.append("")
        out.append("=== FIM ===")
        return out.joined(separator: "\n")
    }

    func writeReportFile() -> URL? {
        guard let report else { return nil }
        let weekTag = String(report.weekStartDate.prefix(10))
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("athly-report-\(weekTag).txt")
        do {
            try composedReportText.write(to: url, atomically: true, encoding: .utf8)
            return url
        } catch {
            errorMessage = "Falha ao gerar arquivo: \(error.localizedDescription)"
            return nil
        }
    }

    private static func formatDuration(_ seconds: Double) -> String {
        let total = Int(seconds)
        let h = total / 3600
        let m = (total % 3600) / 60
        let s = total % 60
        if h > 0 {
            return String(format: "%d:%02d:%02d", h, m, s)
        }
        return String(format: "%d:%02d", m, s)
    }
}
