import SwiftUI
import MapKit

struct RunSessionDetailView: View {
    let session: RunSession
    let prescribedWorkout: WorkoutModel?

    init(session: RunSession, prescribedWorkout: WorkoutModel? = nil) {
        self.session = session
        self.prescribedWorkout = prescribedWorkout
    }

    @EnvironmentObject private var runStore: RunStore
    @State private var isRetryingHealthKit = false
    @State private var syncMessage: String?

    private let healthKitService = HealthKitService()

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: AthlyTheme.Spacing.md) {
                    // Header
                    VStack(spacing: 8) {
                        Image(systemName: "figure.run.circle.fill")
                            .font(.system(size: 56))
                            .foregroundStyle(AthlyTheme.Color.primary)

                        Text("Corrida")
                            .font(AthlyTheme.Typography.heading(22))
                            .foregroundStyle(AthlyTheme.Color.textPrimary)

                        Text(session.startDate.formatted(date: .abbreviated, time: .shortened))
                            .font(AthlyTheme.Typography.body(15))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                    }
                    .padding(.top, 24)

                    syncStatusBanner

                    if let prescribedWorkout {
                        WorkoutPrescriptionSection(workout: prescribedWorkout)
                    }

                    // Route map
                    if !session.routePoints.isEmpty {
                        let coords = session.routePoints.map { $0.coordinate }
                        SummaryMapView(coordinates: coords)
                            .allowsHitTesting(false)
                            .frame(height: 200)
                            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous))
                            .padding(.horizontal, 16)
                    }

                    // Stats grid
                    statsGrid

                    // Splits
                    if !session.splits.isEmpty {
                        splitsSection
                    }

                    if canRetryHealthKitSync {
                        Button {
                            Task { await retryHealthKitSync() }
                        } label: {
                            HStack {
                                if isRetryingHealthKit {
                                    ProgressView()
                                        .tint(AthlyTheme.Color.textPrimary)
                                } else {
                                    Image(systemName: "arrow.triangle.2.circlepath")
                                }
                                Text(isRetryingHealthKit ? "Sincronizando..." : "Tentar Apple Health")
                            }
                        }
                        .buttonStyle(AthlySecondaryButtonStyle())
                        .disabled(isRetryingHealthKit)
                        .padding(.horizontal, 16)
                    }

                    Spacer(minLength: AthlyTheme.Spacing.lg)
                }
            }
            .athlyTabBarContentClearance()
            .scrollContentBackground(.hidden)
        }
        .navigationTitle("Detalhes")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var statsGrid: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 16) {
            statCard(icon: "ruler", value: String(format: "%.2f km", session.distanceMeters / 1000), label: "Distancia")
            statCard(icon: "clock", value: formatDuration(session.durationSeconds), label: "Duracao")
            statCard(icon: "speedometer", value: formatPace(session.averagePaceSecondsPerKm), label: "Pace medio")
            statCard(icon: "mountain.2", value: String(format: "%.0f m", session.elevationGainMeters), label: "Elevacao")
            statCard(icon: "flame", value: String(format: "%.0f kcal", session.caloriesBurned), label: "Calorias")
            statCard(icon: "number", value: "\(session.splits.count)", label: "Splits")
        }
        .padding(.horizontal, 16)
    }

    private var syncStatusBanner: some View {
        let status = session.healthKitSyncStatus
        let text: String
        let icon: String
        let color: Color

        switch status {
        case .synced:
            text = "Sincronizada com Apple Health"
            icon = "checkmark.circle.fill"
            color = AthlyTheme.Color.success
        case .failed:
            text = session.healthKitSyncError ?? "Falha ao sincronizar com Apple Health"
            icon = "exclamationmark.triangle.fill"
            color = AthlyTheme.Color.warning
        case .unavailable:
            text = "Salva localmente no Athly. Apple Health indisponivel neste dispositivo."
            icon = "iphone"
            color = AthlyTheme.Color.textSecondary
        case .pending:
            text = "Sincronizacao com Apple Health pendente."
            icon = "arrow.triangle.2.circlepath"
            color = AthlyTheme.Color.primary
        case nil:
            text = "Corrida salva localmente no Athly."
            icon = "iphone"
            color = AthlyTheme.Color.textSecondary
        }

        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .foregroundStyle(color)
                Text(syncMessage ?? text)
                    .font(AthlyTheme.Typography.body(13))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                    .multilineTextAlignment(.leading)
                Spacer()
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(AthlyTheme.Color.surfaceCard)
        .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous)
                .stroke(color.opacity(0.35), lineWidth: 1)
        )
        .padding(.horizontal, 16)
    }

    private var canRetryHealthKitSync: Bool {
        session.healthKitSyncStatus != .synced
    }

    private func statCard(icon: String, value: String, label: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(AthlyTheme.Color.primary)

            Text(value)
                .font(AthlyTheme.Typography.heading(20))
                .foregroundStyle(AthlyTheme.Color.textPrimary)

            Text(label)
                .font(AthlyTheme.Typography.body(12))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .athlyCard()
    }

    private var splitsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Splits")
                .font(AthlyTheme.Typography.semibold(17))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .padding(.horizontal, 16)

            VStack(spacing: 0) {
                ForEach(Array(session.splits.enumerated()), id: \.offset) { index, split in
                    HStack {
                        Text("Km \(split.kilometer)")
                            .font(AthlyTheme.Typography.medium(16))
                            .foregroundStyle(AthlyTheme.Color.textPrimary)

                        Spacer()

                        Text(split.formattedPace)
                            .font(.custom("SpaceGrotesk-SemiBold", size: 16).monospacedDigit())
                            .foregroundStyle(AthlyTheme.Color.primary)

                        Text("/km")
                            .font(AthlyTheme.Typography.body(12))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)

                    if index < session.splits.count - 1 {
                        Divider()
                            .background(AthlyTheme.Color.borderDark)
                            .padding(.horizontal, 16)
                    }
                }
            }
            .background(
                ZStack {
                    AthlyTheme.Color.surfaceCard
                    LinearGradient(
                        colors: [AthlyTheme.Color.primary.opacity(0.08), Color.clear],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    )
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous)
                    .stroke(AthlyTheme.Gradient.gradientBorder, lineWidth: 1)
            )
            .padding(.horizontal, 16)
        }
    }

    private func formatDuration(_ seconds: Double) -> String {
        let h = Int(seconds) / 3600
        let m = (Int(seconds) % 3600) / 60
        let s = Int(seconds) % 60
        if h > 0 { return String(format: "%d:%02d:%02d", h, m, s) }
        return String(format: "%02d:%02d", m, s)
    }

    private func formatPace(_ pace: Double) -> String {
        guard pace > 0, pace.isFinite, pace < 3600 else { return "--:--" }
        return String(format: "%d:%02d /km", Int(pace) / 60, Int(pace) % 60)
    }

    private func retryHealthKitSync() async {
        guard !isRetryingHealthKit else { return }
        isRetryingHealthKit = true
        syncMessage = nil
        defer { isRetryingHealthKit = false }

        do {
            try await healthKitService.requestWriteAuthorization()
            let savedWorkout = try await healthKitService.saveWorkout(result: runResult)
            guard let uuid = savedWorkout?.uuid.uuidString else {
                session.healthKitSyncStatus = .failed
                session.healthKitSyncError = "O Apple Health nao retornou o identificador da corrida."
                runStore.update(session)
                syncMessage = session.healthKitSyncError
                return
            }

            session.healthKitWorkoutUUID = uuid
            session.healthKitSyncStatus = .synced
            session.healthKitSyncError = nil
            runStore.update(session)

            if let workoutId = session.athlyWorkoutId {
                RunWorkoutLinkStore.shared.link(healthKitUUID: uuid, athlyWorkoutId: workoutId)
                _ = try? await APIClient.shared.completeWorkout(
                    workoutId: workoutId,
                    appleHealthWorkoutUUID: uuid,
                    actualDistanceMeters: session.distanceMeters,
                    actualDurationSeconds: session.durationSeconds
                )
            }

            syncMessage = "Sincronizada com Apple Health."
        } catch {
            session.healthKitSyncStatus = .failed
            session.healthKitSyncError = error.localizedDescription
            runStore.update(session)
            syncMessage = "Falha ao sincronizar: \(error.localizedDescription)"
        }
    }

    private var runResult: RunResult {
        let locations = session.routePoints.map { $0.toCLLocation() }
        return RunResult(
            startDate: session.startDate,
            endDate: session.endDate ?? session.startDate,
            distanceMeters: session.distanceMeters,
            durationSeconds: session.durationSeconds,
            averagePaceSecondsPerKm: session.averagePaceSecondsPerKm,
            elevationGainMeters: session.elevationGainMeters,
            caloriesBurned: session.caloriesBurned,
            locations: locations,
            splits: session.splits.map {
                SplitData(
                    kilometer: $0.kilometer,
                    distanceMeters: splitDistanceMeters($0),
                    durationSeconds: $0.durationSeconds,
                    elevationDelta: $0.elevationDelta
                )
            },
            segmentRecords: session.segmentRecords ?? [],
            pauseIntervals: session.pauseIntervals ?? []
        )
    }

    private func splitDistanceMeters(_ split: Split) -> Double {
        guard split.paceSecondsPerKm > 0 else { return 0 }
        return split.durationSeconds / split.paceSecondsPerKm * 1000.0
    }
}
