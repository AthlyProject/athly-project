import SwiftUI

struct HealthKitRunsView: View {
    @StateObject private var viewModel: HealthKitRunsViewModel = {
        #if targetEnvironment(simulator)
        return HealthKitRunsViewModel(healthKitService: MockHealthKitService())
        #else
        return HealthKitRunsViewModel(healthKitService: HealthKitService())
        #endif
    }()

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark
                .ignoresSafeArea()

            RadialGradient(
                colors: [
                    AthlyTheme.Color.primary.opacity(0.14),
                    Color.clear
                ],
                center: .init(x: 0.05, y: 0.0),
                startRadius: 0,
                endRadius: 200
            )
            .ignoresSafeArea()

            RadialGradient(
                colors: [
                    AthlyTheme.Color.secondary.opacity(0.08),
                    Color.clear
                ],
                center: .init(x: 1.0, y: 1.0),
                startRadius: 0,
                endRadius: 160
            )
            .ignoresSafeArea()

            if viewModel.isLoading {
                ProgressView()
                    .tint(AthlyTheme.Color.primary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if viewModel.isHealthUnavailable {
                healthUnavailableContent
            } else if let message = viewModel.errorMessage {
                errorContent(message: message)
            } else if viewModel.isEmptyAfterLoad {
                emptyContent
            } else if !viewModel.runs.isEmpty {
                runsList
            } else {
                ProgressView()
                    .tint(AthlyTheme.Color.primary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle("Corridas do Apple Health")
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.loadWorkouts() }
    }

    private var runsList: some View {
        ScrollView {
            LazyVStack(spacing: AthlyTheme.Spacing.sm) {
                ForEach(viewModel.runs) { run in
                    HealthKitRunCard(item: run)
                }
            }
            .padding(AthlyTheme.Spacing.sm)
        }
        .scrollContentBackground(.hidden)
        .refreshable { await viewModel.loadWorkouts() }
    }

    private var emptyContent: some View {
        ContentUnavailableView(
            "Nenhuma corrida encontrada",
            systemImage: "figure.run",
            description: Text("Nao ha corridas no Apple Health neste dispositivo. No simulador pode nao haver dados.")
        )
    }

    private var healthUnavailableContent: some View {
        VStack(spacing: AthlyTheme.Spacing.md) {
            Image(systemName: "heart.slash")
                .font(.system(size: 48))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
            Text("Apple Health indisponivel")
                .font(AthlyTheme.Typography.heading(18))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Text("O Health nao esta disponivel neste dispositivo (por exemplo, no simulador). Use um iPhone fisico para testar.")
                .font(AthlyTheme.Typography.body(14))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            Button("Tentar novamente") {
                viewModel.retry()
            }
            .buttonStyle(AthlyGradientButtonStyle())
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorContent(message: String) -> some View {
        VStack(spacing: AthlyTheme.Spacing.md) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundStyle(AthlyTheme.Color.warning)
            Text("Erro ao carregar")
                .font(AthlyTheme.Typography.heading(18))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Text(message)
                .font(AthlyTheme.Typography.body(14))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            Button("Tentar novamente") {
                viewModel.retry()
            }
            .buttonStyle(AthlyGradientButtonStyle())
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Card (estilo Fitness + Athly)

struct HealthKitRunCard: View {
    let item: HealthKitRunItem

    private var dateTimeText: String {
        if Calendar.current.isDateInToday(item.startDate) {
            item.startDate.formatted(date: .omitted, time: .shortened)
        } else {
            item.startDate.formatted(date: .abbreviated, time: .shortened)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(dateTimeText)
                        .font(AthlyTheme.Typography.body(13))
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                    HStack(spacing: 6) {
                        Image(systemName: "figure.run")
                            .font(.caption)
                            .foregroundStyle(AthlyTheme.Color.primary)
                        Text("Corrida")
                            .font(AthlyTheme.Typography.semibold(17))
                            .foregroundStyle(AthlyTheme.Color.textPrimary)
                    }
                }
                Spacer()
            }

            HStack(alignment: .top, spacing: 0) {
                mainStat(value: item.formattedDuration, label: "Duracao")
                Rectangle()
                    .fill(AthlyTheme.Color.glassBorder)
                    .frame(width: 1, height: 44)
                mainStat(value: "\(item.formattedDistance) km", label: "Distancia")
                Rectangle()
                    .fill(AthlyTheme.Color.glassBorder)
                    .frame(width: 1, height: 44)
                mainStat(value: "\(item.formattedPace)/km", label: "Pace")
            }
            .padding(.vertical, 4)

            HStack(spacing: 16) {
                Label(
                    String(format: "%.0f kcal", item.activeEnergyBurned),
                    systemImage: "flame"
                )
                .font(AthlyTheme.Typography.body(12))
                .foregroundStyle(AthlyTheme.Color.textSecondary)

                if let elevation = item.elevationGainMeters, elevation > 0 {
                    Label(
                        String(format: "%.0f m", elevation),
                        systemImage: "mountain.2"
                    )
                    .font(AthlyTheme.Typography.body(12))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                }
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyCard()
    }

    private func mainStat(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(AthlyTheme.Typography.semibold(16))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Text(label)
                .font(AthlyTheme.Typography.body(11))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }
}

#Preview {
    NavigationStack {
        HealthKitRunsView()
    }
}
