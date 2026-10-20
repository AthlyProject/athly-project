import Foundation

// Corpo que o app envia ao gerar o primeiro plano, montado pelo MockHealthKitService real do
// iOS (compilado junto por `cenarios.sh eval`), para o eval não manter uma cópia dos dados.
// Uso: ATHLY_HEALTH_SCENARIO=gps ./cenarios-health  →  JSON { request, heartRateHealth }

protocol HealthKitRunningWorkoutsProviding: AnyObject, Sendable {}
protocol HeartRateHealthProviding: Sendable {}

struct HealthKitWriteAuthorizationSnapshot: Equatable, Sendable {
    static let fullyAuthorized = HealthKitWriteAuthorizationSnapshot()
}

/// Mesmos campos do HeartRateHealthSnapshot do app (Models/HeartRateZones.swift).
struct HeartRateHealthSnapshot: Sendable {
    let restingHeartRate: Int
    let measuredAt: Date
    let capturedAt: Date
}

/// Corpo de PUT /users/me/heart-rate-health, como o HeartRateHealthRequest do app.
struct HeartRateHealthBody: Encodable {
    let restingHeartRate: Int
    let measuredAt: String
    let capturedAt: String
}

struct Saida: Encodable {
    let request: PlanFromHealthRequest
    let heartRateHealth: HeartRateHealthBody?
}

let service = MockHealthKitService()
let iso = ISO8601DateFormatter()
iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
// Mesma leitura e limites de PlannerHealthSyncService.buildInput no primeiro plano (sem plano ativo).
let read = try await HealthRunWindow.read { limit, beforeEndDate in
    try await service.fetchRunningWorkoutsPage(limit: limit, beforeEndDate: beforeEndDate)
}
let runs = read.runs
let details = runs.isEmpty ? [] : await service.detailedSessions(limit: 5)
let request = PlanFromHealthRequest(
    runs: runs.map { HealthRunPayload(from: $0) },
    detailedSessions: details.isEmpty ? nil : details,
    weekStartDate: nil,
    runsReadFrom: iso.string(from: read.readFrom)
)
let heartRate = try await service.fetchRestingHeartRate().map {
    HeartRateHealthBody(
        restingHeartRate: $0.restingHeartRate,
        measuredAt: iso.string(from: $0.measuredAt),
        capturedAt: iso.string(from: $0.capturedAt)
    )
}
let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys]
FileHandle.standardOutput.write(try encoder.encode(Saida(request: request, heartRateHealth: heartRate)))
