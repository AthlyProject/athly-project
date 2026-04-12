import ActivityKit
import SwiftUI
import WidgetKit

// MARK: - Lock Screen / Notification View

struct AthlyLockScreenView: View {
    let context: ActivityViewContext<AthlyRunnerAttributes>

    var body: some View {
        VStack(spacing: 10) {
            // Header: logo + workout title
            HStack(spacing: 8) {
                Image("AthlyLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 26, height: 26)
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))

                Text(context.attributes.workoutTitle.isEmpty ? "Corrida em andamento" : context.attributes.workoutTitle)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.9))
                    .lineLimit(1)

                Spacer()

                // Running indicator dot
                HStack(spacing: 4) {
                    Circle()
                        .fill(Color(red: 0.2, green: 1.0, blue: 0.6))
                        .frame(width: 6, height: 6)
                    Text("AO VIVO")
                        .font(.system(size: 9, weight: .bold, design: .rounded))
                        .foregroundStyle(Color(red: 0.2, green: 1.0, blue: 0.6))
                }
            }

            // Metrics row
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
                Color(red: 0.07, green: 0.07, blue: 0.12)
                LinearGradient(
                    colors: [
                        Color(red: 0.2, green: 1.0, blue: 0.6).opacity(0.07),
                        Color(red: 0.4, green: 0.3, blue: 1.0).opacity(0.05)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color(red: 0.2, green: 1.0, blue: 0.6).opacity(0.2), lineWidth: 1)
        )
    }

    private func metricCell(value: String, label: String, icon: String) -> some View {
        VStack(spacing: 3) {
            Image(systemName: icon)
                .font(.system(size: 11))
                .foregroundStyle(Color(red: 0.2, green: 1.0, blue: 0.6).opacity(0.8))

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
            Image(systemName: "figure.run")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color(red: 0.2, green: 1.0, blue: 0.6))
            Text(context.state.formattedTime)
                .font(.system(size: 13, weight: .bold, design: .monospaced))
                .foregroundStyle(.white)
            Text("·")
                .foregroundStyle(.white.opacity(0.4))
            Text("\(context.state.formattedDistance) km")
                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                .foregroundStyle(.white.opacity(0.8))
        }
    }
}

struct AthlyDynamicIslandExpanded: View {
    let context: ActivityViewContext<AthlyRunnerAttributes>

    var body: some View {
        VStack(spacing: 6) {
            HStack {
                Image("AthlyLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 22, height: 22)
                    .clipShape(RoundedRectangle(cornerRadius: 5))
                Text(context.attributes.workoutTitle.isEmpty ? "Corrida" : context.attributes.workoutTitle)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Spacer()
            }

            HStack(spacing: 0) {
                miniMetric(value: context.state.formattedTime, label: "TEMPO")
                miniMetric(value: "\(context.state.formattedDistance)", label: "KM")
                miniMetric(value: context.state.formattedPace, label: "/KM")
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
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
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AthlyRunnerAttributes.self) { context in
            AthlyLockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Image("AthlyLogo")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 20, height: 20)
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                        Text(context.state.formattedTime)
                            .font(.system(size: 14, weight: .bold, design: .monospaced))
                            .foregroundStyle(.white)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.formattedDistance) km")
                        .font(.system(size: 14, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Color(red: 0.2, green: 1.0, blue: 0.6))
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Image(systemName: "speedometer")
                            .font(.system(size: 11))
                            .foregroundStyle(Color(red: 0.2, green: 1.0, blue: 0.6).opacity(0.7))
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
                Image(systemName: "figure.run")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color(red: 0.2, green: 1.0, blue: 0.6))
            } compactTrailing: {
                Text(context.state.formattedTime)
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundStyle(.white)
            } minimal: {
                Image(systemName: "figure.run")
                    .font(.system(size: 11))
                    .foregroundStyle(Color(red: 0.2, green: 1.0, blue: 0.6))
            }
        }
    }
}
