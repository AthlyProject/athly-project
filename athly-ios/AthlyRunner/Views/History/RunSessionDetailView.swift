import SwiftUI
import MapKit

struct RunSessionDetailView: View {
    let session: RunSession

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

                    Spacer(minLength: AthlyTheme.Spacing.lg)
                }
            }
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
}
