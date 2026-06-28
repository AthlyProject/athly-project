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

    @EnvironmentObject private var runStore: RunStore

    @State private var coordinates: [CLLocationCoordinate2D] = []
    @State private var splitRows: [SplitRow] = []
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

                    statsGrid

                    if !splitRows.isEmpty {
                        splitsSection
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
                pauseIntervals: pauses
            )
            reportURL = RunReportGenerator.fileURL(for: result)
        } else if let detail = await healthKitService.fetchRunDetail(workoutUUID: item.id) {
            coordinates = detail.coordinates.map {
                CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude)
            }
            splitRows = detail.splits.map { SplitRow(km: $0.kilometer, pace: $0.paceSecondsPerKm) }
            avgHR = detail.avgHR
        }

        isLoadingDetail = false
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

    private var statsGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
            statCard(icon: "ruler", value: "\(item.formattedDistance) km", label: "Distancia")
            statCard(icon: "clock", value: item.formattedDuration, label: "Duracao")
            statCard(icon: "speedometer", value: "\(item.formattedPace) /km", label: "Pace medio")
            statCard(icon: "flame", value: String(format: "%.0f kcal", item.activeEnergyBurned), label: "Calorias")
            if let avgHR, avgHR > 0 {
                statCard(icon: "heart", value: "\(Int(avgHR)) bpm", label: "FC media")
            }
            if !splitRows.isEmpty {
                statCard(icon: "number", value: "\(splitRows.count)", label: "Splits")
            }
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

    private var splitsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Splits")
                .font(AthlyTheme.Typography.semibold(17))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .padding(.horizontal, 16)

            VStack(spacing: 0) {
                ForEach(Array(splitRows.enumerated()), id: \.element.id) { index, split in
                    HStack {
                        Text("Km \(split.km)")
                            .font(AthlyTheme.Typography.medium(16))
                            .foregroundStyle(AthlyTheme.Color.textPrimary)
                        Spacer()
                        Text(formattedPace(split.pace))
                            .font(.custom("SpaceGrotesk-SemiBold", size: 16).monospacedDigit())
                            .foregroundStyle(AthlyTheme.Color.primary)
                        Text("/km")
                            .font(AthlyTheme.Typography.body(12))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)

                    if index < splitRows.count - 1 {
                        Divider()
                            .background(AthlyTheme.Color.borderDark)
                            .padding(.horizontal, 16)
                    }
                }
            }
            .background(AthlyTheme.Color.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous)
                    .stroke(AthlyTheme.Gradient.gradientBorder, lineWidth: 1)
            )
            .padding(.horizontal, 16)
        }
    }

    private func formattedPace(_ secondsPerKm: Double) -> String {
        guard secondsPerKm > 0, secondsPerKm.isFinite else { return "--:--" }
        let minutes = Int(secondsPerKm) / 60
        let seconds = Int(secondsPerKm) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}
