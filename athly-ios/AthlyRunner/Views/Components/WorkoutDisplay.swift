import SwiftUI
import CoreTransferable
import UniformTypeIdentifiers

// Permite arrastar um treino (drag-and-drop de reagendamento no Plano). Reaproveita o
// Codable já existente do modelo para transportar o item entre os dias.
extension WorkoutModel: Transferable {
    static var transferRepresentation: some TransferRepresentation {
        CodableRepresentation(contentType: .json)
    }
}

// Helpers de exibição derivados do WorkoutModel — compartilhados entre Dashboard e Plano.
extension WorkoutModel {
    /// Soma das durações (minutos) dos blocos planejados, quando disponível.
    var totalDurationMinutes: Int? {
        let sum = blocks.compactMap { $0.duration }.reduce(0, +)
        return sum > 0 ? Int(sum.rounded()) : nil
    }

    /// Soma das distâncias (km) dos blocos planejados, quando disponível.
    var totalDistanceKm: Double? {
        let sum = blocks.compactMap { $0.distance }.reduce(0, +)
        return sum > 0 ? sum : nil
    }

    /// Cor de destaque derivada da intensidade — usada em thumbs e labels de tipo.
    var accentColor: Color {
        guard let intensity else { return AthlyTheme.Color.primary }
        switch Int(intensity) {
        case ...3:  return AthlyTheme.Color.success
        case 4...6: return AthlyTheme.Color.primary
        default:    return AthlyTheme.Color.error
        }
    }
}

// Render the saved prescription; never recompute historical workouts from today's profile.
extension SegmentTarget {
    var heartRateTargetText: String? {
        guard let zone = hrZone else { return nil }
        var value = "Z\(zone)"
        if let min = hrMinBpm, let max = hrMaxBpm {
            value += " (\(min)–\(max) bpm)"
        }
        if hrIsEstimated == true { value += " · " + String(localized: "Estimada") }
        return value
    }

    var effortTargetText: String? {
        var parts: [String] = []
        if let heartRateTargetText { parts.append(heartRateTargetText) }
        if let rpe { parts.append("RPE \(rpe)/10") }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}
