import SwiftUI

struct RunTrackingView: View {
    @ObservedObject var viewModel: RunViewModel
    @State private var showStopConfirmation = false

    var body: some View {
        ZStack {
            // Background
            AthlyTheme.Color.backgroundDark
                .ignoresSafeArea()

            // Ambient glow
            RadialGradient(
                colors: [AthlyTheme.Color.primary.opacity(0.12), Color.clear],
                center: .init(x: 0.2, y: 0.15),
                startRadius: 0,
                endRadius: 300
            )
            .ignoresSafeArea()

            RadialGradient(
                colors: [AthlyTheme.Color.secondary.opacity(0.08), Color.clear],
                center: .init(x: 0.85, y: 0.85),
                startRadius: 0,
                endRadius: 250
            )
            .ignoresSafeArea()

            // Metrics fullscreen
            VStack(spacing: 0) {
                Spacer()
                mainTimeDisplay
                Spacer()
                metricsGrid
                Spacer()
                controlsPanel
            }
            .padding(.bottom, 16)
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

    // MARK: - Main time display (large centered)

    private var mainTimeDisplay: some View {
        VStack(spacing: 6) {
            Text(viewModel.tracker.formattedDuration)
                .font(.custom("SpaceGrotesk-Bold", size: 72).monospacedDigit())
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .minimumScaleFactor(0.6)

            Text("TEMPO")
                .font(AthlyTheme.Typography.label())
                .foregroundStyle(AthlyTheme.Color.textTertiary)
        }
    }

    // MARK: - Metrics grid

    private var metricsGrid: some View {
        VStack(spacing: 20) {
            HStack(spacing: 0) {
                metricItem(
                    value: viewModel.tracker.formattedDistance,
                    label: "KM",
                    icon: "ruler"
                )

                metricDivider

                metricItem(
                    value: viewModel.tracker.formattedPace,
                    label: "PACE /KM",
                    icon: "speedometer"
                )
            }

            HStack(spacing: 0) {
                metricItem(
                    value: String(format: "%.0f", viewModel.tracker.elevationGain),
                    label: "ELEVACAO (M)",
                    icon: "mountain.2"
                )

                metricDivider

                metricItem(
                    value: String(format: "%.0f", viewModel.tracker.calories),
                    label: "KCAL",
                    icon: "flame"
                )
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .background(
            ZStack {
                AthlyTheme.Color.surfaceCard
                LinearGradient(
                    colors: [AthlyTheme.Color.primary.opacity(0.08), AthlyTheme.Color.secondary.opacity(0.04)],
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
        .shadow(color: AthlyTheme.Color.primary.opacity(0.2), radius: 14, y: 4)
        .padding(.horizontal, 16)
    }

    private func metricItem(value: String, label: String, icon: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(AthlyTheme.Color.primary)

            Text(value)
                .font(.custom("SpaceGrotesk-Bold", size: 32).monospacedDigit())
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .minimumScaleFactor(0.7)

            Text(label)
                .font(AthlyTheme.Typography.label())
                .foregroundStyle(AthlyTheme.Color.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
    }

    private var metricDivider: some View {
        Rectangle()
            .fill(AthlyTheme.Color.borderDark)
            .frame(width: 1, height: 60)
    }

    // MARK: - Controls

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
