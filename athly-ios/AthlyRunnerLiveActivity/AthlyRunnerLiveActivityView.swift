import ActivityKit
import OSLog
import SwiftUI
import WidgetKit

private let widgetLogger = Logger(subsystem: "com.athly.runner.liveactivity", category: "Widget")

private enum AthlyLiveActivityStyle {
    static let accentNeon = Color(red: 191.0 / 255.0, green: 64.0 / 255.0, blue: 1.0)
    static let label = Color.white.opacity(0.58)
    static let background = Color(red: 0.07, green: 0.07, blue: 0.12)
    static let border = accentNeon.opacity(0.28)
}

private struct AthlyWidgetLogo: View {
    let size: CGFloat

    var body: some View {
        Image("AthlyLogo")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: size * 0.24, style: .continuous))
    }
}

private struct AthlyBrandBadge: View {
    var showsSubtitle: Bool

    var body: some View {
        HStack(spacing: 8) {
            AthlyWidgetLogo(size: showsSubtitle ? 26 : 20)

            VStack(alignment: .leading, spacing: 1) {
                Text("Athly")
                    .font(.system(size: showsSubtitle ? 14 : 12, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)

                if showsSubtitle {
                    Text("acompanhando sua corrida")
                        .font(.system(size: 10, weight: .medium, design: .rounded))
                        .foregroundStyle(AthlyLiveActivityStyle.label)
                        .lineLimit(1)
                }
            }
        }
    }
}

// MARK: - Lock Screen / Notification View

struct AthlyLockScreenView: View {
    let context: ActivityViewContext<AthlyRunnerAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 8) {
                AthlyBrandBadge(showsSubtitle: true)

                Spacer()

                HStack(spacing: 4) {
                    Circle()
                        .fill(AthlyLiveActivityStyle.accentNeon)
                        .frame(width: 6, height: 6)
                    Text("AO VIVO")
                        .font(.system(size: 9, weight: .bold, design: .rounded))
                        .foregroundStyle(AthlyLiveActivityStyle.accentNeon)
                }
            }

            if !context.attributes.workoutTitle.isEmpty {
                Text(context.attributes.workoutTitle)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.84))
                    .lineLimit(1)
            }

            HStack(spacing: 0) {
                metricCell(
                    value: context.state.formattedTime,
                    label: "TEMPO",
                    icon: "timer"
                )

                metricDivider

                metricCell(
                    value: "\(context.state.formattedDistance) km",
                    label: "DISTÂNCIA",
                    icon: "ruler"
                )

                metricDivider

                metricCell(
                    value: "\(context.state.formattedPace)/km",
                    label: "PACE",
                    icon: "speedometer"
                )
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            ZStack {
                AthlyLiveActivityStyle.background
                LinearGradient(
                    colors: [
                        AthlyLiveActivityStyle.accentNeon.opacity(0.14),
                        Color(red: 0.22, green: 0.20, blue: 0.48).opacity(0.08)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(AthlyLiveActivityStyle.border, lineWidth: 1)
        )
        .task {
            widgetLogger.info(
                "Lock screen render title='\(context.attributes.workoutTitle, privacy: .public)' elapsed=\(context.state.elapsedSeconds, privacy: .public) distance=\(context.state.distanceMeters, privacy: .public)"
            )
        }
    }

    private func metricCell(value: String, label: String, icon: String) -> some View {
        VStack(spacing: 3) {
            Image(systemName: icon)
                .font(.system(size: 11))
                .foregroundStyle(AthlyLiveActivityStyle.accentNeon.opacity(0.85))

            Text(value)
                .font(.system(size: 18, weight: .bold, design: .monospaced))
                .foregroundStyle(.white)
                .minimumScaleFactor(0.7)
                .lineLimit(1)

            Text(label)
                .font(.system(size: 9, weight: .medium, design: .rounded))
                .foregroundStyle(.white.opacity(0.5))
        }
        .frame(maxWidth: .infinity)
    }

    private var metricDivider: some View {
        Rectangle()
            .fill(Color.white.opacity(0.1))
            .frame(width: 1, height: 44)
    }
}

// MARK: - Dynamic Island Views

struct AthlyDynamicIslandCompact: View {
    let context: ActivityViewContext<AthlyRunnerAttributes>

    var body: some View {
        HStack(spacing: 4) {
            AthlyWidgetLogo(size: 14)
            Text(context.state.formattedTime)
                .font(.system(size: 13, weight: .bold, design: .monospaced))
                .foregroundStyle(.white)
            Text("·")
                .foregroundStyle(.white.opacity(0.4))
            Text("\(context.state.formattedDistance) km")
                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                .foregroundStyle(.white.opacity(0.8))
        }
        .task {
            widgetLogger.info(
                "Dynamic Island compact render elapsed=\(context.state.elapsedSeconds, privacy: .public) distance=\(context.state.distanceMeters, privacy: .public)"
            )
        }
    }
}

struct AthlyDynamicIslandExpanded: View {
    let context: ActivityViewContext<AthlyRunnerAttributes>

    var body: some View {
        VStack(spacing: 6) {
            HStack {
                AthlyBrandBadge(showsSubtitle: false)
                Spacer()
                Text(context.attributes.workoutTitle.isEmpty ? "Corrida" : context.attributes.workoutTitle)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.78))
                    .lineLimit(1)
            }

            HStack(spacing: 0) {
                miniMetric(value: context.state.formattedTime, label: "TEMPO")
                miniMetric(value: "\(context.state.formattedDistance)", label: "KM")
                miniMetric(value: context.state.formattedPace, label: "/KM")
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .task {
            widgetLogger.info(
                "Dynamic Island expanded render title='\(context.attributes.workoutTitle, privacy: .public)' pace=\(context.state.paceSecondsPerKm, privacy: .public)"
            )
        }
    }

    private func miniMetric(value: String, label: String) -> some View {
        VStack(spacing: 1) {
            Text(value)
                .font(.system(size: 16, weight: .bold, design: .monospaced))
                .foregroundStyle(.white)
            Text(label)
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(.white.opacity(0.5))
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Widget Definition

struct AthlyRunnerLiveActivityWidget: Widget {
    init() {
        widgetLogger.info("AthlyRunnerLiveActivityWidget initialized.")
    }

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AthlyRunnerAttributes.self) { context in
            AthlyLockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        AthlyWidgetLogo(size: 20)
                        Text("Athly")
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.formattedDistance) km")
                        .font(.system(size: 14, weight: .semibold, design: .monospaced))
                        .foregroundStyle(AthlyLiveActivityStyle.accentNeon)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Image(systemName: "speedometer")
                            .font(.system(size: 11))
                            .foregroundStyle(AthlyLiveActivityStyle.accentNeon.opacity(0.7))
                        Text("\(context.state.formattedPace)/km")
                            .font(.system(size: 13, weight: .semibold, design: .monospaced))
                            .foregroundStyle(.white.opacity(0.8))
                        Spacer()
                        Text(context.attributes.workoutTitle.isEmpty ? "Corrida" : context.attributes.workoutTitle)
                            .font(.system(size: 12))
                            .foregroundStyle(.white.opacity(0.5))
                            .lineLimit(1)
                    }
                }
            } compactLeading: {
                AthlyWidgetLogo(size: 16)
            } compactTrailing: {
                Text(context.state.formattedTime)
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundStyle(.white)
            } minimal: {
                AthlyWidgetLogo(size: 13)
            }
        }
    }
}
