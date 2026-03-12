import SwiftUI
import SwiftData
import MapKit

struct RunSummaryView: View {
    @ObservedObject var viewModel: RunViewModel
    @Environment(\.modelContext) private var modelContext

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

                        // Splits
                        if !result.splits.isEmpty {
                            splitsSection(splits: result.splits)
                        }
                    }

                    // Actions
                    VStack(spacing: 12) {
                        Button {
                            Task {
                                await viewModel.saveRun(modelContext: modelContext)
                            }
                        } label: {
                            HStack {
                                if viewModel.isSaving {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Image(systemName: "square.and.arrow.down")
                                    Text("Salvar corrida")
                                }
                            }
                        }
                        .buttonStyle(AthlyGradientButtonStyle())
                        .disabled(viewModel.isSaving)

                        Button("Descartar", role: .destructive) {
                            viewModel.discardRun()
                        }
                        .foregroundStyle(AthlyTheme.Color.error)
                    }
                    .padding(.horizontal, AthlyTheme.Spacing.md)
                    .padding(.bottom, AthlyTheme.Spacing.lg)
                }
            }
            .scrollContentBackground(.hidden)
        }
        .navigationBarBackButtonHidden(true)
    }

    private func summaryMap(locations: [CLLocation]) -> some View {
        let coords = locations.map { $0.coordinate }

        return Map {
            MapPolyline(coordinates: coords)
                .stroke(AthlyTheme.Color.secondaryNeon, lineWidth: 3)

            if let first = coords.first {
                Annotation("", coordinate: first) {
                    Circle().fill(AthlyTheme.Color.success).frame(width: 10, height: 10)
                }
            }
            if let last = coords.last {
                Annotation("", coordinate: last) {
                    Circle().fill(AthlyTheme.Color.error).frame(width: 10, height: 10)
                }
            }
        }
        .mapStyle(.standard(emphasis: .muted))
        .disabled(true)
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
