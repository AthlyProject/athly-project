import SwiftUI
import MapKit

struct RunTrackingView: View {
    @ObservedObject var viewModel: RunViewModel
    @State private var showStopConfirmation = false

    var body: some View {
        ZStack {
            // Map
            RunMapView(
                coordinates: viewModel.tracker.routeCoordinates,
                isTracking: viewModel.isRunning
            )
            .ignoresSafeArea(edges: .top)

            // Metrics overlay
            VStack {
                Spacer()
                metricsPanel
                controlsPanel
            }
        }
        .navigationBarHidden(true)
        .confirmationDialog(
            "Finalizar corrida?",
            isPresented: $showStopConfirmation,
            titleVisibility: .visible
        ) {
            Button("Finalizar e salvar") {
                viewModel.finishRun()
            }
            Button("Descartar", role: .destructive) {
                viewModel.discardRun()
            }
            Button("Continuar correndo", role: .cancel) {
                if viewModel.isPaused {
                    viewModel.resumeRun()
                }
            }
        }
    }

    private var metricsPanel: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                metricItem(
                    value: viewModel.tracker.formattedDuration,
                    label: "TEMPO",
                    large: true
                )
            }
            .padding(.top, 20)

            HStack(spacing: 0) {
                metricItem(value: viewModel.tracker.formattedDistance, label: "KM")

                Divider()
                    .frame(height: 50)
                    .background(AthlyTheme.Color.borderDark)

                metricItem(value: viewModel.tracker.formattedPace, label: "PACE /KM")

                Divider()
                    .frame(height: 50)
                    .background(AthlyTheme.Color.borderDark)

                metricItem(
                    value: String(format: "%.0f", viewModel.tracker.elevationGain),
                    label: "ELEV (M)"
                )
            }
            .padding(.vertical, 12)
        }
        .background(
            ZStack {
                AthlyTheme.Color.surfaceCard
                LinearGradient(
                    colors: [AthlyTheme.Color.primary.opacity(0.1), AthlyTheme.Color.secondary.opacity(0.04)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(AthlyTheme.Gradient.gradientBorder, lineWidth: 1)
        )
        .shadow(color: AthlyTheme.Color.primary.opacity(0.3), radius: 14, y: 4)
        .padding(.horizontal, 16)
    }

    private func metricItem(value: String, label: String, large: Bool = false) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.custom("SpaceGrotesk-Bold", size: large ? 48 : 28).monospacedDigit())
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .minimumScaleFactor(0.7)

            Text(label)
                .font(AthlyTheme.Typography.label())
                .textCase(.uppercase)
                .foregroundStyle(AthlyTheme.Color.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }

    private var controlsPanel: some View {
        HStack(spacing: 40) {
            if viewModel.isPaused {
                // Stop button
                Button {
                    showStopConfirmation = true
                } label: {
                    ZStack {
                        Circle()
                            .fill(AthlyTheme.Color.error)
                            .frame(width: 64, height: 64)

                        Image(systemName: "stop.fill")
                            .font(.title2)
                            .foregroundStyle(.white)
                    }
                }

                // Resume button
                Button {
                    viewModel.resumeRun()
                } label: {
                    ZStack {
                        Circle()
                            .fill(AthlyTheme.Gradient.neon)
                            .frame(width: 80, height: 80)
                            .shadow(color: AthlyTheme.Color.primaryNeon.opacity(0.4), radius: 12, y: 6)

                        Image(systemName: "play.fill")
                            .font(.title)
                            .foregroundStyle(.white)
                    }
                }
            } else {
                // Pause button
                Button {
                    viewModel.pauseRun()
                } label: {
                    ZStack {
                        Circle()
                            .fill(AthlyTheme.Color.warning)
                            .frame(width: 80, height: 80)
                            .shadow(color: AthlyTheme.Color.warning.opacity(0.4), radius: 12, y: 6)

                        Image(systemName: "pause.fill")
                            .font(.title)
                            .foregroundStyle(.white)
                    }
                }
            }
        }
        .padding(.vertical, 24)
        .padding(.bottom, 16)
    }
}

// MARK: - RunTracker convenience computed properties

extension RunTracker {
    var formattedDuration: String {
        let hours = Int(elapsedTime) / 3600
        let minutes = (Int(elapsedTime) % 3600) / 60
        let seconds = Int(elapsedTime) % 60
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        }
        return String(format: "%02d:%02d", minutes, seconds)
    }

    var formattedDistance: String {
        String(format: "%.2f", distanceMeters / 1000.0)
    }

    var formattedPace: String {
        guard currentPaceSecondsPerKm > 0, currentPaceSecondsPerKm.isFinite,
              currentPaceSecondsPerKm < 3600 else {
            return "--:--"
        }
        let minutes = Int(currentPaceSecondsPerKm) / 60
        let seconds = Int(currentPaceSecondsPerKm) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}
