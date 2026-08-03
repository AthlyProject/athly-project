import SwiftUI
import CoreLocation

/// Summary de uma corrida do histórico (Apple Health). Mapa da rota + stats + splits por km.
///
/// Fonte da rota/splits, em duas vias:
/// 1. **Match local** no `RunStore` (corrida do Athly já gravada localmente, com `routePoints`) — dá mapa,
///    splits e o botão "I.A Report" (auditoria via `RunReportGenerator`).
/// 2. **HealthKit** (`fetchRunDetail`) — corridas do Apple Watch ou novas do Athly (rota gravada no Health).
/// Sem rota em nenhuma via (Garmin/Nike/esteira) → mostra só os stats.
struct HealthKitRunDetailView: View {
    let item: HealthKitRunItem
    let prescribedWorkout: WorkoutModel?

    init(item: HealthKitRunItem, prescribedWorkout: WorkoutModel? = nil) {
        self.item = item
        self.prescribedWorkout = prescribedWorkout
    }

    @EnvironmentObject private var runStore: RunStore

    @State private var coordinates: [CLLocationCoordinate2D] = []
    @State private var splitRows: [SplitRow] = []
    @State private var segmentRecords: [SegmentRecord] = []
    @State private var segmentationOrigin: WorkoutSegmentationOrigin?
    @State private var segmentationConfidence: WorkoutSegmentationConfidence?
    @State private var segmentationReason: String?
    @State private var avgHR: Double?
    @State private var reportURL: URL?
    @State private var isLoadingDetail = true
    @State private var resolved = false
    /// Apresenta a câmera com marca d'água em tela cheia.
    @State private var showCamera = false

    private let healthKitService = HealthKitService()

    private struct SplitRow: Identifiable {
        let id = UUID()
        let km: Int
        let pace: Double
    }

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: AthlyTheme.Spacing.md) {
                    header

                    if let prescribedWorkout {
                        WorkoutPrescriptionSection(workout: prescribedWorkout)
                    }

                    if !coordinates.isEmpty {
                        SummaryMapView(coordinates: coordinates)
                            .allowsHitTesting(false)
                            .frame(height: 200)
                            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous))
                            .padding(.horizontal, 16)
                    } else if isLoadingDetail {
                        ProgressView()
                            .tint(AthlyTheme.Color.primary)
                            .frame(height: 80)
                    }

                    RunStatsGrid(stats: .healthRun(item: item, splitCount: splitRows.count, avgHR: avgHR))

                    let executedSegments = RunExecutedSegmentsSection.displayableSegments(
                        segmentRecords,
                        origin: segmentationOrigin
                    )
                    if !executedSegments.isEmpty {
                        RunExecutedSegmentsSection(
                            segments: executedSegments,
                            origin: segmentationOrigin,
                            confidence: segmentationConfidence
                        )
                    }

                    if let segmentationReason {
                        WorkoutSegmentationNotice(message: segmentationReason)
                    }

                    if !splitRows.isEmpty {
                        RunSplitsSection(splits: splitRows.map {
                            RunSplitRow(kilometer: $0.km, paceSecondsPerKm: $0.pace)
                        })
                    }

                    if let reportURL {
                        ShareLink(item: reportURL) {
                            HStack {
                                Image(systemName: "doc.text.magnifyingglass")
                                Text("I.A Report")
                            }
                        }
                        .buttonStyle(AthlySecondaryButtonStyle())
                        .padding(.horizontal, 16)
                    }

                    Button {
                        showCamera = true
                    } label: {
                        HStack {
                            Image(systemName: "camera.fill")
                            Text("Foto com marca d'água")
                        }
                    }
                    .buttonStyle(AthlySecondaryButtonStyle())
                    .padding(.horizontal, 16)

                    Spacer(minLength: AthlyTheme.Spacing.lg)
                }
                .padding(.top, 24)
            }
            .athlyTabBarContentClearance()
            .scrollContentBackground(.hidden)
        }
        .navigationTitle("Detalhes")
        .navigationBarTitleDisplayMode(.inline)
        .task { await resolveDetail() }
        .fullScreenCover(isPresented: $showCamera) {
            CameraWatermarkView(data: WatermarkData(from: item, coordinates: coordinates, avgHR: avgHR))
        }
    }

    // MARK: - Resolução da fonte (local > HealthKit)

    private func resolveDetail() async {
        guard !resolved else { return }
        resolved = true

        if let session = bestLocalMatch() {
            let locations = session.routePoints.map { $0.toCLLocation() }
            let pauses = session.pauseIntervals ?? []
            let kmSplits = SplitCalculator.kmSplits(from: locations, pauses: pauses)
            coordinates = locations.map { $0.coordinate }
            splitRows = kmSplits.map { SplitRow(km: $0.kilometer, pace: $0.paceSecondsPerKm) }
            segmentRecords = session.segmentRecords ?? []
            if let localSegmentation = session.workoutSegmentation, localSegmentation.hasSegments {
                apply(localSegmentation)
            }

            let result = RunResult(
                startDate: session.startDate,
                endDate: session.endDate ?? session.startDate,
                distanceMeters: session.distanceMeters,
                durationSeconds: session.durationSeconds,
                averagePaceSecondsPerKm: session.averagePaceSecondsPerKm,
                elevationGainMeters: session.elevationGainMeters,
                caloriesBurned: session.caloriesBurned,
                locations: locations,
                splits: kmSplits.map {
                    SplitData(
                        kilometer: $0.kilometer,
                        distanceMeters: $0.distanceMeters,
                        durationSeconds: $0.durationSeconds,
                        elevationDelta: $0.elevationDelta
                    )
                },
                segmentRecords: segmentRecords,
                pauseIntervals: pauses
            )
            reportURL = RunReportGenerator.fileURL(for: result)

            if let detail = await healthKitService.fetchRunDetail(workoutUUID: item.id) {
                if segmentRecords.isEmpty {
                    segmentRecords = detail.segmentRecords
                }
                avgHR = detail.avgHR
            }
        } else if let detail = await healthKitService.fetchRunDetail(workoutUUID: item.id) {
            coordinates = detail.coordinates.map {
                CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude)
            }
            splitRows = detail.splits.map { SplitRow(km: $0.kilometer, pace: $0.paceSecondsPerKm) }
            segmentRecords = detail.segmentRecords
            avgHR = detail.avgHR
        }

        await resolveWorkoutSegmentation()

        isLoadingDetail = false
    }

    private func resolveWorkoutSegmentation() async {
        guard let prescribedWorkout else { return }

        if let link = RunWorkoutLinkStore.shared.fetchLink(for: item.id),
           link.athlyWorkoutId == prescribedWorkout.id,
           let cached = link.workoutSegmentation {
            apply(cached)
            return
        }

        if !segmentRecords.isEmpty {
            let exact = WorkoutSegmentationResult(
                segments: segmentRecords,
                origin: .athlyTracker,
                confidence: .exact,
                fallbackReason: nil
            )
            apply(exact)
            RunWorkoutLinkStore.shared.storeSegmentation(exact, for: item.id)
            return
        }

        do {
            guard let rawWorkout = try await healthKitService.fetchRawWorkout(uuid: item.id),
                  let detail = try await WorkoutDetailFetcher().buildExecutionDetail(
                    for: rawWorkout,
                    athlyWorkoutId: prescribedWorkout.id,
                    prescribedWorkout: prescribedWorkout
                  ) else {
                apply(.unavailable("Não foi possível abrir os dados brutos desta corrida para reconstruir os blocos."))
                return
            }
            apply(detail.segmentation)
            RunWorkoutLinkStore.shared.storeSegmentation(detail.segmentation, for: item.id)
        } catch {
            apply(.unavailable("Não foi possível reconstruir os blocos desta corrida: \(error.localizedDescription)"))
        }
    }

    private func apply(_ result: WorkoutSegmentationResult) {
        if result.hasSegments {
            segmentRecords = result.segments
        }
        segmentationOrigin = result.origin == .unavailable ? nil : result.origin
        segmentationConfidence = result.confidence == .unavailable ? nil : result.confidence
        segmentationReason = result.fallbackReason
    }

    /// Casa a corrida do histórico com um RunSession local (Athly) por proximidade de horário (±120s).
    private func bestLocalMatch() -> RunSession? {
        runStore.sessions
            .filter { !$0.routePoints.isEmpty && abs($0.startDate.timeIntervalSince(item.startDate)) < 120 }
            .min { abs($0.startDate.timeIntervalSince(item.startDate)) < abs($1.startDate.timeIntervalSince(item.startDate)) }
    }

    // MARK: - Subviews

    private var header: some View {
        VStack(spacing: 8) {
            Image(systemName: "figure.run.circle.fill")
                .font(.system(size: 56))
                .foregroundStyle(AthlyTheme.Color.primary)
            Text("Corrida")
                .font(AthlyTheme.Typography.heading(22))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Text(item.startDate.formatted(date: .abbreviated, time: .shortened))
                .font(AthlyTheme.Typography.body(15))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
        }
    }

}
