import Foundation
import CoreLocation

/// Gera um relatório de texto (.txt) completo de uma corrida finalizada para auditoria do
/// cálculo de pace/splits. A ideia é despejar tanto os valores JÁ computados pelo app (resumo,
/// pace médio, splits) quanto os dados CRUS de GPS (lat/lon/alt/tempo por fixe), para que o
/// mesmo cálculo possa ser refeito de fora e comparado com o que o app mostra.
///
/// O bloco "VERIFICAÇÃO DE PACE" expõe de propósito a diferença entre as duas bases de tempo:
/// - pace médio = duração TOTAL / distância (inclui parado inicial, pausas e buracos de GPS);
/// - splits     = só o tempo EM MOVIMENTO (parado/pausa/buraco descontados — ver SplitCalculator).
enum RunReportGenerator {

    static func text(for result: RunResult) -> String {
        var out: [String] = []

        out.append("========================================")
        out.append("   ATHLY — RELATÓRIO DE CORRIDA (I.A)")
        out.append("========================================")
        out.append("Gerado em: \(iso(Date()))")
        out.append("Início:    \(iso(result.startDate))")
        out.append("Fim:       \(iso(result.endDate))")
        out.append("")

        // ---------- RESUMO ----------
        let distanceKm = result.distanceMeters / 1000.0
        out.append("---------- RESUMO ----------")
        out.append(String(format: "Distância:        %.2f km  (%.1f m)", distanceKm, result.distanceMeters))
        out.append("Duração:          \(clock(result.durationSeconds))    (\(sec(result.durationSeconds)) s)   [base do pace médio]")
        out.append("Pace médio:       \(pace(result.averagePaceSecondsPerKm))   (\(sec(result.averagePaceSecondsPerKm)) s/km)")
        out.append(String(format: "Elevação (ganho): %.0f m", result.elevationGainMeters))
        out.append(String(format: "Calorias:         %.0f kcal", result.caloriesBurned))
        out.append("Nº de splits:     \(result.splits.count)")
        out.append("Nº de fixes GPS:  \(result.locations.count)")
        out.append("")

        // ---------- VERIFICAÇÃO DE PACE ----------
        let splitDist = result.splits.reduce(0) { $0 + $1.distanceMeters }
        let splitDur = result.splits.reduce(0) { $0 + $1.durationSeconds }
        let delta = result.durationSeconds - splitDur
        let movingPace = splitDist > 0 ? splitDur / (splitDist / 1000.0) : 0

        out.append("---------- VERIFICAÇÃO DE PACE ----------")
        out.append("Fórmula do app:  pace_médio = duração_total / distância")
        out.append(String(format: "               = %.1f s / %.3f km = %.1f s/km = %@",
                          result.durationSeconds, distanceKm,
                          result.averagePaceSecondsPerKm, pace(result.averagePaceSecondsPerKm)))
        out.append("")
        out.append(String(format: "Soma das distâncias dos splits: %.1f m", splitDist))
        out.append("Soma das durações dos splits:   \(sec(splitDur)) s  (\(clock(splitDur)))")
        out.append(String(format: "Δ duração (total − splits):     %.1f s", delta))
        out.append("   → tempo que os splits descontam: parado inicial + pausas + buracos de GPS.")
        out.append("   → o pace médio usa a duração TOTAL; os splits usam só o tempo em movimento.")
        out.append("Pace 'em movimento' (base splits): \(pace(movingPace))   (\(sec(movingPace)) s/km)")
        out.append("")

        // ---------- SPLITS ----------
        out.append("---------- SPLITS ----------")
        out.append("Km | Dist(m) | Dur(s) | Dur   | Pace    | Elev(m)")
        for s in result.splits {
            let partial = s.distanceMeters < 999.0 ? "  [parcial]" : ""
            out.append(String(format: "%2d | %7.1f | %6.1f | %5@ | %@%@",
                              s.kilometer, s.distanceMeters, s.durationSeconds,
                              clock(s.durationSeconds), pace(s.paceSecondsPerKm),
                              elevSigned(s.elevationDelta) + partial))
        }
        out.append("")

        // ---------- AMOSTRAS GPS (cru, sem filtro) ----------
        out.append("---------- AMOSTRAS GPS (cru, sem filtro de salto) ----------")
        out.append("Colunas: idx | t+s | lat | lon | alt(m) | hAcc(m) | speed(m/s) | seg(m) | cum(m)")
        let locs = result.locations.sorted { $0.timestamp < $1.timestamp }
        let t0 = locs.first?.timestamp
        var cum = 0.0
        for (i, loc) in locs.enumerated() {
            let rel = t0.map { loc.timestamp.timeIntervalSince($0) } ?? 0
            let seg = i > 0 ? loc.distance(from: locs[i - 1]) : 0
            cum += seg
            out.append(String(format: "%d | %.1f | %.6f | %.6f | %.1f | %.1f | %.2f | %.1f | %.1f",
                              i, rel, loc.coordinate.latitude, loc.coordinate.longitude,
                              loc.altitude, loc.horizontalAccuracy, loc.speed, seg, cum))
        }
        out.append("")
        out.append("=== FIM ===")
        return out.joined(separator: "\n")
    }

    /// Escreve o relatório em um .txt temporário e devolve a URL (para ShareLink).
    static func fileURL(for result: RunResult) -> URL? {
        let stampFormatter = DateFormatter()
        stampFormatter.dateFormat = "yyyyMMdd-HHmmss"
        let stamp = stampFormatter.string(from: result.startDate)
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("athly-run-report-\(stamp).txt")
        do {
            try text(for: result).write(to: url, atomically: true, encoding: .utf8)
            return url
        } catch {
            return nil
        }
    }

    // MARK: - Formatação

    private static func clock(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds >= 0 else { return "--:--" }
        let total = Int(seconds.rounded())
        let h = total / 3600, m = (total % 3600) / 60, s = total % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s)
    }

    private static func pace(_ secondsPerKm: Double) -> String {
        guard secondsPerKm > 0, secondsPerKm.isFinite, secondsPerKm < 3600 else { return "--:-- /km" }
        let total = Int(secondsPerKm.rounded())
        return String(format: "%d:%02d /km", total / 60, total % 60)
    }

    private static func sec(_ seconds: Double) -> String {
        String(format: "%.1f", seconds)
    }

    private static func elevSigned(_ delta: Double) -> String {
        String(format: "%+.1f", delta)
    }

    private static func iso(_ date: Date) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f.string(from: date)
    }
}
