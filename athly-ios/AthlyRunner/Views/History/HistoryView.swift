import SwiftUI
import SwiftData

struct HistoryView: View {
    @Query(sort: \RunSession.startDate, order: .reverse)
    private var runs: [RunSession]

    var body: some View {
        NavigationStack {
            ZStack {
                AthlyTheme.Color.backgroundDark
                    .ignoresSafeArea()

                Group {
                    if runs.isEmpty {
                        ContentUnavailableView(
                            "Sem corridas",
                            systemImage: "figure.run",
                            description: Text("Suas corridas aparecerao aqui apos registra-las.")
                        )
                    } else {
                        List(runs) { run in
                            runRow(run)
                                .listRowBackground(AthlyTheme.Color.surfaceDark)
                                .listRowSeparatorTint(AthlyTheme.Color.borderDark)
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                    }
                }
            }
            .navigationTitle("Historico")
        }
    }

    private func runRow(_ run: RunSession) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "figure.run")
                    .foregroundStyle(AthlyTheme.Color.primary)

                Text("Corrida")
                    .font(AthlyTheme.Typography.semibold(17))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)

                Spacer()

                Text(run.startDate.formatted(date: .abbreviated, time: .shortened))
                    .font(AthlyTheme.Typography.body(12))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
            }

            HStack(spacing: 20) {
                Label(run.formattedDistance + " km", systemImage: "ruler")
                Label(run.formattedDuration, systemImage: "clock")
                Label(run.formattedPace + " /km", systemImage: "speedometer")
            }
            .font(AthlyTheme.Typography.body(12))
            .foregroundStyle(AthlyTheme.Color.textSecondary)

            HStack(spacing: 8) {
                if run.synced {
                    Label("Sincronizado", systemImage: "checkmark.icloud")
                        .font(AthlyTheme.Typography.body(11))
                        .foregroundStyle(AthlyTheme.Color.success)
                } else {
                    Label("Local", systemImage: "iphone")
                        .font(AthlyTheme.Typography.body(11))
                        .foregroundStyle(AthlyTheme.Color.warning)
                }
            }
        }
        .padding(.vertical, 4)
    }
}
