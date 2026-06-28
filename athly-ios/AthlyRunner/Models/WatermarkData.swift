import Foundation
import CoreLocation

/// Estilos de marca d'água disponíveis para o usuário escolher na câmera.
enum WatermarkStyle: String, CaseIterable, Identifiable {
    case heroBar         // Barra Hero no rodapé
    case glassCard       // Card de vidro no canto
    case bigNumber       // Número gigante editorial
    case routeSignature  // Assinatura de rota (traço GPS)

    var id: String { rawValue }

    /// Rótulo curto exibido no seletor de estilos.
    var displayName: String {
        switch self {
        case .heroBar: return "Barra"
        case .glassCard: return "Card"
        case .bigNumber: return "Número"
        case .routeSignature: return "Rota"
        }
    }

    /// Ícone do seletor (SF Symbol).
    var iconName: String {
        switch self {
        case .heroBar: return "rectangle.bottomthird.inset.filled"
        case .glassCard: return "rectangle.inset.filled"
        case .bigNumber: return "textformat.size.larger"
        case .routeSignature: return "point.topleft.down.curvedto.point.bottomright.up"
        }
    }
}

/// Dados de um treino prontos para renderizar numa marca d'água.
///
/// Fonte-agnóstico: tanto uma corrida recém-finalizada (`RunResult`) quanto uma do
/// histórico (`HealthKitRunItem`) produzem este mesmo struct, para a marca d'água não
/// depender de qual tela a abriu. Confinado à `@MainActor` (criado e consumido nas views
/// e no `WatermarkRenderer`), por isso não precisa ser `Sendable`.
struct WatermarkData {
    let date: Date
    let distanceMeters: Double
    let durationSeconds: Double
    let paceSecondsPerKm: Double
    let elevationGainMeters: Double?
    let caloriesBurned: Double?
    let avgHR: Double?
    /// Traçado GPS da corrida (vazio em treino indoor/esteira ou histórico sem rota).
    let routeCoordinates: [CLLocationCoordinate2D]

    /// Há rota suficiente para desenhar o traço (template "Assinatura de Rota").
    var hasRoute: Bool { routeCoordinates.count >= 2 }

    // MARK: - Formatação (mesma lógica de RunSession / RunSummaryView)

    var formattedDistance: String {
        String(format: "%.2f", distanceMeters / 1000.0)
    }

    var formattedDuration: String {
        let total = Int(durationSeconds)
        let h = total / 3600
        let m = (total % 3600) / 60
        let s = total % 60
        if h > 0 { return String(format: "%d:%02d:%02d", h, m, s) }
        return String(format: "%02d:%02d", m, s)
    }

    var formattedPace: String {
        guard paceSecondsPerKm > 0, paceSecondsPerKm.isFinite, paceSecondsPerKm < 3600 else { return "--:--" }
        let total = Int(paceSecondsPerKm.rounded())
        return String(format: "%d:%02d", total / 60, total % 60)
    }

    /// Calorias arredondadas, ou `nil` quando não há valor útil.
    var formattedCalories: String? {
        guard let caloriesBurned, caloriesBurned > 0 else { return nil }
        return String(format: "%.0f", caloriesBurned)
    }

    /// Elevação ganha arredondada, ou `nil` quando não há valor útil.
    var formattedElevation: String? {
        guard let elevationGainMeters, elevationGainMeters > 0 else { return nil }
        return String(format: "%.0f", elevationGainMeters)
    }

    /// Data abreviada (sem hora) para a assinatura — ex.: "27 de jun. de 2026".
    var formattedDate: String {
        date.formatted(date: .abbreviated, time: .omitted)
    }
}

// MARK: - Factories

extension WatermarkData {
    /// A partir de uma corrida recém-finalizada (tela de resumo).
    init(from result: RunResult) {
        self.init(
            date: result.startDate,
            distanceMeters: result.distanceMeters,
            durationSeconds: result.durationSeconds,
            paceSecondsPerKm: result.averagePaceSecondsPerKm,
            elevationGainMeters: result.elevationGainMeters,
            caloriesBurned: result.caloriesBurned,
            avgHR: nil,
            routeCoordinates: result.locations.map { $0.coordinate }
        )
    }

    /// A partir de uma corrida do histórico (Apple Health). A rota e a FC média vêm
    /// resolvidas pela `HealthKitRunDetailView` (match local ou HealthKit).
    init(from item: HealthKitRunItem, coordinates: [CLLocationCoordinate2D], avgHR: Double?) {
        self.init(
            date: item.startDate,
            distanceMeters: item.distanceMeters,
            durationSeconds: item.durationSeconds,
            paceSecondsPerKm: item.averagePaceSecondsPerKm,
            elevationGainMeters: item.elevationGainMeters,
            caloriesBurned: item.activeEnergyBurned,
            avgHR: avgHR,
            routeCoordinates: coordinates
        )
    }
}
