import SwiftUI

struct RunTrackingView: View {
    @ObservedObject var viewModel: RunViewModel

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
                if viewModel.tracker.currentSegment != nil {
                    segmentBanner
                        .padding(.horizontal, 16)
                        .padding(.bottom, 12)
                }
                metricsGrid
                Spacer()
                controlsPanel
            }
            .padding(.bottom, 16)
        }
        .navigationBarHidden(true)
    }

    // MARK: - Segment banner

    @ViewBuilder
    private var segmentBanner: some View {
        if let seg = viewModel.tracker.currentSegment {
            CurrentSegmentBanner(
                segment: seg,
                progress: viewModel.tracker.segmentProgress,
                next: viewModel.tracker.nextSegment
            ) {
                viewModel.tracker.skipSegment()
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
                // Finish button
                Button {
                    viewModel.finishRun()
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

// MARK: - CurrentSegmentBanner

private struct CurrentSegmentBanner: View {
    let segment: ActiveSegment
    let progress: Double
    let next: ActiveSegment?
    let onSkip: () -> Void

    var body: some View {
        VStack(spacing: 6) {
            // Main row
            HStack(spacing: 12) {
                progressRing
                labelStack
                Spacer()
                skipButton
            }
            .padding(12)
            .background(AthlyTheme.Color.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(kindColor.opacity(0.45), lineWidth: 1)
            )

            // "A seguir" pill
            if let next {
                HStack(spacing: 4) {
                    Text("A seguir:")
                        .font(AthlyTheme.Typography.label())
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                    Text(next.label)
                        .font(AthlyTheme.Typography.label())
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                    Text("·")
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                    Text(endSummary(next.end))
                        .font(AthlyTheme.Typography.label())
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 5)
                .background(AthlyTheme.Color.surfaceCard.opacity(0.6))
                .clipShape(Capsule())
            }
        }
    }

    private var progressRing: some View {
        ZStack {
            Circle()
                .stroke(AthlyTheme.Color.borderDark, lineWidth: 4)
            Circle()
                .trim(from: 0, to: max(0, min(1, progress)))
                .stroke(kindColor, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.linear(duration: 1), value: progress)
        }
        .frame(width: 44, height: 44)
    }

    private var labelStack: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 6) {
                Text(segment.label)
                    .font(AthlyTheme.Typography.semibold(15))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                if let idx = segment.setIndex, let total = segment.setTotal {
                    Text("\(idx)/\(total)")
                        .font(AthlyTheme.Typography.label())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(kindColor.opacity(0.18))
                        .clipShape(Capsule())
                        .foregroundStyle(kindColor)
                }
            }
            Text(remainingText)
                .font(.custom("SpaceGrotesk-Bold", size: 22).monospacedDigit())
                .foregroundStyle(AthlyTheme.Color.textPrimary)
        }
    }

    private var skipButton: some View {
        Button(action: onSkip) {
            Image(systemName: "chevron.right.2")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
                .padding(10)
                .background(AthlyTheme.Color.backgroundDark)
                .clipShape(Circle())
        }
    }

    private var kindColor: Color {
        switch segment.kind {
        case .warmup:   return .orange
        case .work:     return AthlyTheme.Color.primary
        case .recovery: return .blue
        case .cooldown: return .teal
        case .rest:     return .gray
        default:        return AthlyTheme.Color.primary
        }
    }

    private var remainingText: String {
        let done = progress * segment.end.value
        let remaining = max(0, segment.end.value - done)
        return endSummary(SegmentEndCondition(by: segment.end.by, value: remaining))
    }

    private func endSummary(_ end: SegmentEndCondition) -> String {
        switch end.by {
        case .distanceM:
            let m = Int(end.value)
            return m >= 1000 ? String(format: "%.1f km", Double(m) / 1000) : "\(m) m"
        case .durationSec:
            let s = Int(end.value)
            if s >= 3600 { return String(format: "%dh%02d", s / 3600, (s % 3600) / 60) }
            return s >= 60 ? String(format: "%d:%02d", s / 60, s % 60) : "\(s)s"
        case .reps:
            return "\(Int(end.value)) reps"
        }
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
        let total = Int(currentPaceSecondsPerKm.rounded())
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}
