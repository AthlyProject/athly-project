import SwiftUI
import SwiftData

struct ProfileView: View {
    @EnvironmentObject var authViewModel: AuthViewModel

    @Query(sort: \RunSession.startDate, order: .reverse)
    private var allRuns: [RunSession]

    var body: some View {
        NavigationStack {
            ZStack {
                AthlyTheme.Color.backgroundDark
                    .ignoresSafeArea()

                List {
                    // Stats section
                    Section("Estatisticas gerais") {
                        statsRow(icon: "figure.run", label: "Total de corridas", value: "\(allRuns.count)")
                        statsRow(icon: "ruler", label: "Distancia total", value: String(format: "%.1f km", totalDistance))
                        statsRow(icon: "clock", label: "Tempo total", value: formatDuration(totalTime))
                        statsRow(icon: "speedometer", label: "Pace medio", value: formatPace(averagePace))
                        statsRow(icon: "mountain.2", label: "Elevacao total", value: String(format: "%.0f m", totalElevation))
                    }
                    .listRowBackground(AthlyTheme.Color.surfaceDark)

                    // Account
                    Section("Conta") {
                        Button("Sair", role: .destructive) {
                            authViewModel.logout()
                        }
                        .foregroundStyle(AthlyTheme.Color.error)
                    }
                    .listRowBackground(AthlyTheme.Color.surfaceDark)

                    // App info
                    Section("Sobre") {
                        HStack {
                            Text("Versao")
                                .font(AthlyTheme.Typography.body())
                                .foregroundStyle(AthlyTheme.Color.textPrimary)
                            Spacer()
                            Text("1.0.0")
                                .font(AthlyTheme.Typography.medium(16))
                                .foregroundStyle(AthlyTheme.Color.textSecondary)
                        }
                    }
                    .listRowBackground(AthlyTheme.Color.surfaceDark)
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Perfil")
        }
    }

    private func statsRow(icon: String, label: String, value: String) -> some View {
        HStack {
            Image(systemName: icon)
                .foregroundStyle(AthlyTheme.Color.primary)
                .frame(width: 28)

            Text(label)
                .font(AthlyTheme.Typography.body())
                .foregroundStyle(AthlyTheme.Color.textPrimary)

            Spacer()

            Text(value)
                .font(AthlyTheme.Typography.medium(16))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
        }
    }

    private var totalDistance: Double {
        allRuns.reduce(0) { $0 + $1.distanceKm }
    }

    private var totalTime: Double {
        allRuns.reduce(0) { $0 + $1.durationSeconds }
    }

    private var totalElevation: Double {
        allRuns.reduce(0) { $0 + $1.elevationGainMeters }
    }

    private var averagePace: Double {
        guard totalDistance > 0 else { return 0 }
        return totalTime / totalDistance
    }

    private func formatDuration(_ seconds: Double) -> String {
        let h = Int(seconds) / 3600
        let m = (Int(seconds) % 3600) / 60
        if h > 0 { return String(format: "%dh %dmin", h, m) }
        return String(format: "%dmin", m)
    }

    private func formatPace(_ pace: Double) -> String {
        guard pace > 0, pace.isFinite else { return "--:--" }
        return String(format: "%d:%02d /km", Int(pace) / 60, Int(pace) % 60)
    }
}
