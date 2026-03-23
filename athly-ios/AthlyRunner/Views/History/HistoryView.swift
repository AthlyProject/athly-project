import SwiftUI

struct HistoryView: View {
    @EnvironmentObject private var runStore: RunStore

    private var runs: [RunSession] { runStore.sortedSessions }

    var body: some View {
        NavigationStack {
            ZStack {
                AthlyTheme.Color.backgroundDark
                    .ignoresSafeArea()

                Group {
                    if runs.isEmpty {
                        VStack(spacing: 12) {
                            Image(systemName: "figure.run")
                                .font(.system(size: 48))
                                .foregroundStyle(AthlyTheme.Color.textTertiary)
                            Text("Sem corridas")
                                .font(AthlyTheme.Typography.semibold(17))
                                .foregroundStyle(AthlyTheme.Color.textPrimary)
                            Text("Suas corridas aparecerao aqui apos registra-las.")
                                .font(AthlyTheme.Typography.body(15))
                                .foregroundStyle(AthlyTheme.Color.textSecondary)
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
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
