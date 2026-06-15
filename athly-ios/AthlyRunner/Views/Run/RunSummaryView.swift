import SwiftUI
import MapKit

struct RunSummaryView: View {
    @ObservedObject var viewModel: RunViewModel
    @EnvironmentObject private var runStore: RunStore

    /// URL do .txt gerado pelo botão "I.A Report" (relatório para auditoria de pace/splits).
    @State private var reportURL: URL?

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: AthlyTheme.Spacing.md) {
                    // Header
                    VStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 56))
                            .foregroundStyle(AthlyTheme.Color.success)

                        Text("Corrida finalizada!")
                            .font(AthlyTheme.Typography.heading(22))
                            .foregroundStyle(AthlyTheme.Color.textPrimary)

                        if let result = viewModel.lastRunResult {
                            Text(result.startDate.formatted(date: .abbreviated, time: .shortened))
                                .font(AthlyTheme.Typography.body(15))
                                .foregroundStyle(AthlyTheme.Color.textSecondary)
                        }
                    }
                    .padding(.top, 24)

                    if let result = viewModel.lastRunResult {
                        // Route map
                        if !result.locations.isEmpty {
                            summaryMap(locations: result.locations)
                                .frame(height: 200)
                                .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous))
                                .padding(.horizontal, 16)
                        }

                        // Stats grid
                        statsGrid(result: result)

                        // Blocos do treino (tiros/recuperações) — pace por segmento real,
                        // não diluído no split de km. Só aparece em treino estruturado.
                        let blocks = displayableSegments(result.segmentRecords)
                        if !blocks.isEmpty {
                            segmentsSection(segments: blocks)
                        }

                        // Splits
                        if !result.splits.isEmpty {
                            splitsSection(splits: result.splits)
                        }
                    }

                    // Save status + close action
                    VStack(spacing: 12) {
                        if viewModel.isSaving {
                            HStack(spacing: 8) {
                                ProgressView()
                                    .tint(AthlyTheme.Color.primary)
                                Text("Salvando corrida...")
                                    .font(AthlyTheme.Typography.body(15))
                                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                            }
                            .padding(.vertical, 8)
                        } else if let error = viewModel.saveError {
                            HStack(spacing: 6) {
                                Image(systemName: "wifi.slash")
                                    .font(.system(size: 14))
                                Text(error)
                                    .font(AthlyTheme.Typography.body(13))
                            }
                            .foregroundStyle(AthlyTheme.Color.warning)
                            .multilineTextAlignment(.center)
                        }

                        if let reportURL {
                            ShareLink(item: reportURL) {
                                HStack {
                                    Image(systemName: "doc.text.magnifyingglass")
                                    Text("I.A Report")
                                }
                            }
                            .buttonStyle(AthlySecondaryButtonStyle())
                        }

                        Button {
                            viewModel.dismissSummary()
                        } label: {
                            HStack {
                                Image(systemName: viewModel.isSaved ? "checkmark.circle.fill" : "clock")
                                Text(viewModel.isSaved ? "Corrida salva!" : "Salvando...")
                            }
                        }
                        .buttonStyle(AthlyGradientButtonStyle())
                        .disabled(viewModel.isSaving)
                    }
                    .padding(.horizontal, AthlyTheme.Spacing.md)
                    .padding(.bottom, AthlyTheme.Spacing.lg)
                }
            }
            .scrollContentBackground(.hidden)
        }
        .navigationBarBackButtonHidden(true)
        .task {
            await viewModel.saveRun(runStore: runStore)
        }
        .onAppear {
            if let result = viewModel.lastRunResult {
                reportURL = RunReportGenerator.fileURL(for: result)
            }
        }
        .sheet(isPresented: $viewModel.showWorkoutFeedback) {
            if let workout = viewModel.pendingWorkout {
                WorkoutCompletionSheet(
                    workout: workout,
                    initialStep: .feedback,
                    onComplete: { _ in
                        let workoutId = workout.id
                        let healthKitUUID = viewModel.lastSavedHealthKitUUID
                        Task {
                            _ = try? await APIClient.shared.completeWorkout(
                                workoutId: workoutId,
                                appleHealthWorkoutUUID: healthKitUUID
                            )
                        }
                        // Validação sem I.A.: treino de tentativa de objetivo que bateu a meta vira conquista.
                        if let result = viewModel.lastRunResult,
                           WorkoutObjectiveValidator.isObjectiveAchieved(
                               workout: workout,
                               actualDistanceMeters: result.distanceMeters,
                               actualDurationSeconds: result.durationSeconds,
                               actualPaceSecPerKm: result.averagePaceSecondsPerKm
                           ) {
                            AchievementStore.shared.record(workoutId: workout.id)
                        }
                        viewModel.pendingWorkout = nil
                        viewModel.showWorkoutFeedback = false
                    },
                    onDismiss: {
                        viewModel.pendingWorkout = nil
                        viewModel.showWorkoutFeedback = false
                    }
                )
            }
        }
    }

    private func summaryMap(locations: [CLLocation]) -> some View {
        let coords = locations.map { $0.coordinate }
        return SummaryMapView(coordinates: coords)
            .allowsHitTesting(false)
    }

    private func statsGrid(result: RunResult) -> some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 16) {
            statCard(icon: "ruler", value: String(format: "%.2f km", result.distanceMeters / 1000), label: "Distancia")
            statCard(icon: "clock", value: formatDuration(result.durationSeconds), label: "Duracao")
            statCard(icon: "speedometer", value: formatPace(result.averagePaceSecondsPerKm), label: "Pace medio")
            statCard(icon: "mountain.2", value: String(format: "%.0f m", result.elevationGainMeters), label: "Elevacao")
            statCard(icon: "flame", value: String(format: "%.0f kcal", result.caloriesBurned), label: "Calorias")
            statCard(icon: "number", value: "\(result.splits.count)", label: "Splits")
        }
        .padding(.horizontal, 16)
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

    private func splitsSection(splits: [SplitData]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Splits")
                .font(AthlyTheme.Typography.semibold(17))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .padding(.horizontal, 16)

            VStack(spacing: 0) {
                ForEach(Array(splits.enumerated()), id: \.offset) { index, split in
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

                    if index < splits.count - 1 {
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

    // MARK: - Segmentos (tiros/blocos)

    /// Segmentos exibíveis: descarta descanso e blocos sem distância/duração úteis.
    private func displayableSegments(_ records: [SegmentRecord]) -> [SegmentRecord] {
        records.filter { $0.kind != .rest && $0.kind != .unknown && ($0.distanceMeters > 5 || $0.durationSeconds > 3) }
    }

    private func segmentsSection(segments: [SegmentRecord]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Blocos do treino")
                .font(AthlyTheme.Typography.semibold(17))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .padding(.horizontal, 16)

            VStack(spacing: 0) {
                ForEach(Array(segments.enumerated()), id: \.offset) { index, seg in
                    segmentRow(seg)

                    if index < segments.count - 1 {
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

    @ViewBuilder
    private func segmentRow(_ seg: SegmentRecord) -> some View {
        let isWork = seg.kind == .work
        HStack(spacing: 10) {
            Image(systemName: iconForKind(seg.kind))
                .font(.system(size: 14))
                .foregroundStyle(isWork ? AthlyTheme.Color.primary : AthlyTheme.Color.textSecondary)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(seg.skipped ? "\(seg.label) (pulado)" : seg.label)
                    .font(AthlyTheme.Typography.medium(15))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                Text(segmentDetail(seg))
                    .font(AthlyTheme.Typography.body(12))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
            }

            Spacer()

            // Pace só faz sentido para blocos com distância real; recuperações curtas
            // mostram só duração (via segmentDetail), sem um pace enganoso.
            if seg.distanceMeters >= 100, seg.paceSecondsPerKm > 0 {
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text(formatPaceShort(seg.paceSecondsPerKm))
                        .font(.custom("SpaceGrotesk-SemiBold", size: 16).monospacedDigit())
                        .foregroundStyle(isWork ? AthlyTheme.Color.primary : AthlyTheme.Color.textPrimary)
                    Text("/km")
                        .font(AthlyTheme.Typography.body(11))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    private func iconForKind(_ kind: SegmentKind) -> String {
        switch kind {
        case .warmup: return "figure.walk"
        case .work: return "bolt.fill"
        case .recovery: return "wind"
        case .cooldown: return "figure.cooldown"
        default: return "circle"
        }
    }

    /// Linha de detalhe: distância + duração do segmento.
    private func segmentDetail(_ seg: SegmentRecord) -> String {
        let dist = seg.distanceMeters >= 1000
            ? String(format: "%.2f km", seg.distanceMeters / 1000)
            : String(format: "%.0f m", seg.distanceMeters)
        return "\(dist) · \(formatDuration(seg.durationSeconds))"
    }

    private func formatPaceShort(_ pace: Double) -> String {
        guard pace > 0, pace.isFinite, pace < 3600 else { return "--:--" }
        let total = Int(pace.rounded())
        return String(format: "%d:%02d", total / 60, total % 60)
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
        let total = Int(pace.rounded())
        return String(format: "%d:%02d /km", total / 60, total % 60)
    }

    private func regionForCoordinates(_ coords: [CLLocationCoordinate2D]) -> MKCoordinateRegion {
        guard !coords.isEmpty else { return MKCoordinateRegion() }

        var minLat = coords[0].latitude
        var maxLat = coords[0].latitude
        var minLon = coords[0].longitude
        var maxLon = coords[0].longitude

        for coord in coords {
            minLat = min(minLat, coord.latitude)
            maxLat = max(maxLat, coord.latitude)
            minLon = min(minLon, coord.longitude)
            maxLon = max(maxLon, coord.longitude)
        }

        let padding = 1.3
        let span = MKCoordinateSpan(
            latitudeDelta: (maxLat - minLat) * padding + 0.002,
            longitudeDelta: (maxLon - minLon) * padding + 0.002
        )

        return MKCoordinateRegion(
            center: CLLocationCoordinate2D(
                latitude: (minLat + maxLat) / 2,
                longitude: (minLon + maxLon) / 2
            ),
            span: span
        )
    }
}
