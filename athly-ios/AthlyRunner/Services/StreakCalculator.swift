import Foundation

/// Cálculo da "sequência" (ofensiva) de treinos concluídos. Lógica **pura** e sobre um input mínimo
/// (data + status), para ser testável isoladamente e portável para o Android.
///
/// Regra: conta treinos prescritos consecutivos concluídos (`.done`/`.partial`), de hoje para trás.
/// **Quebra** ao encontrar um `.skipped` ou um treino **passado** ainda `.scheduled` (não-marcado =
/// não treinou). O treino de **hoje** ainda `.scheduled` (pendente) é **neutro** (não conta nem quebra).
/// Treinos **futuros** são ignorados. O filtro por esporte (ex.: descanso/`.other`) é responsabilidade
/// do chamador.
enum StreakCalculator {
    static func currentStreak(
        entries: [(date: Date, status: WorkoutStatus)],
        now: Date = Date()
    ) -> Int {
        let cal = Calendar.current
        let today = cal.startOfDay(for: now)

        let due = entries
            .map { (date: cal.startOfDay(for: $0.date), status: $0.status) }
            .filter { $0.date <= today }
            .sorted { $0.date > $1.date } // mais recente primeiro

        var streak = 0
        for entry in due {
            let isToday = entry.date == today
            switch entry.status {
            case .done, .partial:
                streak += 1
            case .scheduled:
                if isToday {
                    continue // pendente de hoje: neutro, não conta nem quebra
                }
                return streak // passado não-marcado: quebra
            case .skipped:
                return streak // quebra
            }
        }
        return streak
    }
}
