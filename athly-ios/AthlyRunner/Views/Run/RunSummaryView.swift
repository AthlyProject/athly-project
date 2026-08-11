import SwiftUI
import MapKit

struct RunSummaryView: View {
    @ObservedObject var viewModel: RunViewModel
    @EnvironmentObject private var runStore: RunStore
    @EnvironmentObject private var planVM: TrainingPlanViewModel
    @Environment(\.scenePhase) private var scenePhase

    /// URL do .txt gerado pelo botão "I.A Report" (relatório para auditoria de pace/splits).
    @State private var reportURL: URL?
    /// Apresenta a câmera com marca d'água em tela cheia.
    @State private var showCamera = false

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
                        RunStatsGrid(stats: .runResult(result))

                        // Blocos do treino (tiros/recuperações) — pace por segmento real,
                        // não diluído no split de km. Só aparece em treino estruturado.
                        let blocks = RunExecutedSegmentsSection.displayableSegments(result.segmentRecords)
                        if !blocks.isEmpty {
                            RunExecutedSegmentsSection(
                                segments: blocks,
                                origin: .athlyTracker,
                                confidence: .exact
                            )
                        }

                        // Splits
                        if !result.splits.isEmpty {
                            RunSplitsSection(splits: result.splits.map { RunSplitRow(split: $0) })
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
                            VStack(spacing: 10) {
                                HStack(spacing: 6) {
                                    Image(systemName: "heart.slash")
                                        .font(.system(size: 14))
                                    Text(error)
                                        .font(AthlyTheme.Typography.body(13))
                                }
                                .foregroundStyle(AthlyTheme.Color.warning)
                                .multilineTextAlignment(.center)

                                if viewModel.healthKitWriteDenied {
                                    Button("Abrir Ajustes") {
                                        openAppSettings()
                                    }
                                    .buttonStyle(AthlySecondaryButtonStyle())
                                }

                                if viewModel.canRetryHealthKitSync {
                                    Button {
                                        Task { await viewModel.retryHealthKitSync(runStore: runStore) }
                                    } label: {
                                        Label("Tentar novamente", systemImage: "arrow.triangle.2.circlepath")
                                    }
                                    .buttonStyle(AthlySecondaryButtonStyle())
                                    .disabled(viewModel.isSaving)
                                }
                            }
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

                        if viewModel.lastRunResult != nil {
                            Button {
                                showCamera = true
                            } label: {
                                HStack {
                                    Image(systemName: "camera.fill")
                                    Text("Foto com marca d'água")
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
                    .padding(.bottom, AthlyTheme.Layout.fullScreenBottomActionPadding)
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
        .onChange(of: scenePhase) { phase in
            if phase == .active {
                viewModel.refreshHealthKitWriteAuthorization()
            }
        }
        .fullScreenCover(isPresented: $showCamera) {
            if let result = viewModel.lastRunResult {
                CameraWatermarkView(data: WatermarkData(from: result))
            }
        }
        .sheet(isPresented: $viewModel.showWorkoutFeedback) {
            if let workout = viewModel.pendingWorkout {
                WorkoutCompletionSheet(
                    workout: workout,
                    initialStep: .feedback,
                    onComplete: { _, _ in
                        let healthKitUUID = viewModel.lastSavedHealthKitUUID
                        let result = viewModel.lastRunResult
                        if let result {
                            await planVM.completeWorkoutWithRunResult(
                                workout,
                                result: result,
                                healthKitUUID: healthKitUUID
                            )
                        } else {
                            await planVM.completeWorkout(workout)
                        }
                        viewModel.pendingWorkout = nil
                        viewModel.showWorkoutFeedback = false
                        if let message = planVM.errorMessage {
                            return .failure(message)
                        }
                        return .success
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

    private func openAppSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }
}

// MARK: - Shared Run Summary Components

struct RunSummaryStat: Identifiable {
    let id: String
    let icon: String
    let value: String
    let label: String
}

extension Array where Element == RunSummaryStat {
    static func runResult(_ result: RunResult) -> [RunSummaryStat] {
        [
            RunSummaryStat(id: "distance", icon: "ruler", value: String(format: "%.2f km", result.distanceMeters / 1000), label: "Distancia"),
            RunSummaryStat(id: "duration", icon: "clock", value: RunSummaryFormatting.duration(result.durationSeconds), label: "Duracao"),
            RunSummaryStat(id: "pace", icon: "speedometer", value: RunSummaryFormatting.paceWithUnit(result.averagePaceSecondsPerKm), label: "Pace medio"),
            RunSummaryStat(id: "elevation", icon: "mountain.2", value: String(format: "%.0f m", result.elevationGainMeters), label: "Elevacao"),
            RunSummaryStat(id: "calories", icon: "flame", value: String(format: "%.0f kcal", result.caloriesBurned), label: "Calorias"),
            RunSummaryStat(id: "splits", icon: "number", value: "\(result.splits.count)", label: "Splits"),
        ]
    }

    static func healthRun(item: HealthKitRunItem, splitCount: Int, avgHR: Double?) -> [RunSummaryStat] {
        var stats: [RunSummaryStat] = [
            RunSummaryStat(id: "distance", icon: "ruler", value: "\(item.formattedDistance) km", label: "Distancia"),
            RunSummaryStat(id: "duration", icon: "clock", value: item.formattedDuration, label: "Duracao"),
            RunSummaryStat(id: "pace", icon: "speedometer", value: "\(item.formattedPace) /km", label: "Pace medio"),
            RunSummaryStat(id: "calories", icon: "flame", value: String(format: "%.0f kcal", item.activeEnergyBurned), label: "Calorias"),
        ]
        if let avgHR, avgHR > 0 {
            stats.append(RunSummaryStat(id: "hr", icon: "heart", value: "\(Int(avgHR)) bpm", label: "FC media"))
        }
        if splitCount > 0 {
            stats.append(RunSummaryStat(id: "splits", icon: "number", value: "\(splitCount)", label: "Splits"))
        }
        return stats
    }
}

struct RunStatsGrid: View {
    let stats: [RunSummaryStat]

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
            ForEach(stats) { stat in
                VStack(spacing: 8) {
                    Image(systemName: stat.icon)
                        .font(.title3)
                        .foregroundStyle(AthlyTheme.Color.primary)

                    Text(stat.value)
                        .font(AthlyTheme.Typography.heading(20))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)

                    Text(stat.label)
                        .font(AthlyTheme.Typography.body(12))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .athlyCard()
            }
        }
        .padding(.horizontal, 16)
    }
}

struct RunSplitRow {
    let kilometer: Int
    let paceSecondsPerKm: Double

    init(kilometer: Int, paceSecondsPerKm: Double) {
        self.kilometer = kilometer
        self.paceSecondsPerKm = paceSecondsPerKm
    }

    init(split: SplitData) {
        self.kilometer = split.kilometer
        self.paceSecondsPerKm = split.paceSecondsPerKm
    }

    init(split: Split) {
        self.kilometer = split.kilometer
        self.paceSecondsPerKm = split.paceSecondsPerKm
    }

    init(split: KmSplit) {
        self.kilometer = split.kilometer
        self.paceSecondsPerKm = split.paceSecondsPerKm
    }
}

struct RunSplitsSection: View {
    let splits: [RunSplitRow]

    var body: some View {
        RunSummaryListSection(title: "Splits") {
            ForEach(Array(splits.enumerated()), id: \.offset) { index, split in
                HStack {
                    Text("Km \(split.kilometer)")
                        .font(AthlyTheme.Typography.medium(16))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)

                    Spacer()

                    Text(RunSummaryFormatting.pace(split.paceSecondsPerKm))
                        .font(.custom("SpaceGrotesk-SemiBold", size: 16).monospacedDigit())
                        .foregroundStyle(AthlyTheme.Color.primary)

                    Text("/km")
                        .font(AthlyTheme.Typography.body(12))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)

                if index < splits.count - 1 {
                    RunSummaryDivider()
                }
            }
        }
    }
}

struct RunExecutedSegmentsSection: View {
    let segments: [SegmentRecord]
    let origin: WorkoutSegmentationOrigin?
    let confidence: WorkoutSegmentationConfidence?

    init(
        segments: [SegmentRecord],
        origin: WorkoutSegmentationOrigin? = nil,
        confidence: WorkoutSegmentationConfidence? = nil
    ) {
        self.segments = segments
        self.origin = origin
        self.confidence = confidence
    }

    var body: some View {
        RunSummaryListSection(title: "Blocos executados") {
            if let origin {
                HStack(spacing: 8) {
                    sourceBadge(origin.displayName, highlighted: origin == .prescribedRoute)
                    if let confidenceLabel = confidence?.displayName {
                        sourceBadge(confidenceLabel, highlighted: confidence == .exact)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)

                RunSummaryDivider()
            }

            ForEach(Array(segments.enumerated()), id: \.offset) { index, segment in
                segmentRow(segment)

                if index < segments.count - 1 {
                    RunSummaryDivider()
                }
            }
        }
    }

    private func sourceBadge(_ text: String, highlighted: Bool) -> some View {
        Text(text)
            .font(AthlyTheme.Typography.medium(10))
            .foregroundStyle(highlighted ? AthlyTheme.Color.primary : AthlyTheme.Color.textSecondary)
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(
                Capsule()
                    .fill((highlighted ? AthlyTheme.Color.primary : AthlyTheme.Color.textSecondary).opacity(0.12))
            )
    }

    static func displayableSegments(
        _ records: [SegmentRecord],
        origin: WorkoutSegmentationOrigin? = nil
    ) -> [SegmentRecord] {
        records.filter {
            $0.kind != .rest
                && ($0.kind != .unknown || origin == .thirdPartyLaps)
                && ($0.distanceMeters > 5 || $0.durationSeconds > 3)
        }
    }

    @ViewBuilder
    private func segmentRow(_ segment: SegmentRecord) -> some View {
        let isWork = segment.kind == .work
        HStack(spacing: 10) {
            Image(systemName: RunSummaryFormatting.icon(for: segment.kind))
                .font(.system(size: 14))
                .foregroundStyle(isWork ? AthlyTheme.Color.primary : AthlyTheme.Color.textSecondary)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(segment.skipped ? "\(segment.label) (pulado)" : segment.label)
                    .font(AthlyTheme.Typography.medium(15))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                Text(RunSummaryFormatting.segmentDetail(segment))
                    .font(AthlyTheme.Typography.body(12))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
            }

            Spacer()

            if segment.distanceMeters >= 100, segment.paceSecondsPerKm > 0 {
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text(RunSummaryFormatting.pace(segment.paceSecondsPerKm))
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
}

struct WorkoutSegmentationNotice: View {
    let message: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "info.circle.fill")
                .foregroundStyle(AthlyTheme.Color.warning)
            Text(message)
                .font(AthlyTheme.Typography.body(12))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(14)
        .athlyCard()
        .padding(.horizontal, 16)
    }
}

struct WorkoutPrescriptionSection: View {
    let workout: WorkoutModel

    var body: some View {
        RunSummaryListSection(title: "Treino prescrito") {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: workout.sportType.sfSymbol)
                        .font(.system(size: 16))
                        .foregroundStyle(AthlyTheme.Color.primary)
                        .frame(width: 20)

                    VStack(alignment: .leading, spacing: 3) {
                        Text(workout.title)
                            .font(AthlyTheme.Typography.semibold(16))
                            .foregroundStyle(AthlyTheme.Color.textPrimary)
                        if let description = workout.description, !description.isEmpty {
                            Text(description)
                                .font(AthlyTheme.Typography.body(12))
                                .foregroundStyle(AthlyTheme.Color.textSecondary)
                                .lineLimit(3)
                        }
                    }

                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, prescribedRows.isEmpty ? 14 : 6)

                if !prescribedRows.isEmpty {
                    RunSummaryDivider()

                    ForEach(Array(prescribedRows.enumerated()), id: \.offset) { index, row in
                        HStack(spacing: 10) {
                            Image(systemName: RunSummaryFormatting.icon(for: row.kind))
                                .font(.system(size: 14))
                                .foregroundStyle(row.kind == .work ? AthlyTheme.Color.primary : AthlyTheme.Color.textSecondary)
                                .frame(width: 20)

                            VStack(alignment: .leading, spacing: 2) {
                                Text(row.title)
                                    .font(AthlyTheme.Typography.medium(14))
                                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                                Text(row.detail)
                                    .font(AthlyTheme.Typography.body(12))
                                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                            }

                            Spacer()
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)

                        if index < prescribedRows.count - 1 {
                            RunSummaryDivider()
                        }
                    }
                }
            }
        }
    }

    private struct PrescribedRow {
        let kind: SegmentKind
        let title: String
        let detail: String
    }

    private var prescribedRows: [PrescribedRow] {
        if let segments = workout.segments, !segments.segments.isEmpty {
            return segments.flatten().map { segment in
                PrescribedRow(
                    kind: segment.kind,
                    title: segment.label,
                    detail: RunSummaryFormatting.prescribedSegmentDetail(segment)
                )
            }
        }

        return workout.blocks.enumerated().map { index, block in
            PrescribedRow(
                kind: RunSummaryFormatting.kind(forLegacyBlockType: block.type),
                title: "\(index + 1). \(RunSummaryFormatting.legacyBlockTitle(block.type))",
                detail: RunSummaryFormatting.legacyBlockDetail(block)
            )
        }
    }
}

struct RunSummaryListSection<Content: View>: View {
    let title: String
    private let content: Content

    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(AthlyTheme.Typography.semibold(17))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .padding(.horizontal, 16)

            VStack(spacing: 0) {
                content
            }
            .background(
                ZStack {
                    AthlyTheme.Color.surfaceCard
                    LinearGradient(
                        colors: [AthlyTheme.Color.primary.opacity(0.08), Color.clear],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
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
}

struct RunSummaryDivider: View {
    var body: some View {
        Divider()
            .background(AthlyTheme.Color.borderDark)
            .padding(.horizontal, 16)
    }
}

enum RunSummaryFormatting {
    static func duration(_ seconds: Double) -> String {
        let h = Int(seconds) / 3600
        let m = (Int(seconds) % 3600) / 60
        let s = Int(seconds) % 60
        if h > 0 { return String(format: "%d:%02d:%02d", h, m, s) }
        return String(format: "%02d:%02d", m, s)
    }

    static func pace(_ secondsPerKm: Double) -> String {
        guard secondsPerKm > 0, secondsPerKm.isFinite, secondsPerKm < 3600 else { return "--:--" }
        let total = Int(secondsPerKm.rounded())
        return String(format: "%d:%02d", total / 60, total % 60)
    }

    static func paceWithUnit(_ secondsPerKm: Double) -> String {
        "\(pace(secondsPerKm)) /km"
    }

    static func icon(for kind: SegmentKind) -> String {
        switch kind {
        case .warmup: return "figure.walk"
        case .work: return "bolt.fill"
        case .recovery: return "wind"
        case .cooldown: return "figure.cooldown"
        default: return "circle"
        }
    }

    static func segmentDetail(_ segment: SegmentRecord) -> String {
        let distance = distanceText(segment.distanceMeters)
        return "\(distance) · \(duration(segment.durationSeconds))"
    }

    static func prescribedSegmentDetail(_ segment: ActiveSegment) -> String {
        var parts = [endCondition(segment.end)]
        if let target = segment.target {
            parts.append(contentsOf: targetDetails(target))
        }
        return parts.joined(separator: " · ")
    }

    static func legacyBlockTitle(_ type: String) -> String {
        switch type.lowercased() {
        case "warmup": return "Aquecimento"
        case "work", "main": return "Principal"
        case "recovery": return "Recuperacao"
        case "cooldown": return "Desaceleramento"
        case "rest": return "Descanso"
        default: return type.capitalized
        }
    }

    static func legacyBlockDetail(_ block: WorkoutBlock) -> String {
        var parts: [String] = []
        if let duration = block.duration {
            parts.append("\(Int(duration)) min")
        }
        if let distance = block.distance {
            parts.append(String(format: "%.1f km", distance))
        }
        if let pace = block.targetPace, !pace.isEmpty {
            parts.append("Ritmo \(pace)/km")
        }
        if let instructions = block.instructions, !instructions.isEmpty {
            parts.append(instructions)
        }
        return parts.isEmpty ? "Sem alvo definido" : parts.joined(separator: " · ")
    }

    static func kind(forLegacyBlockType type: String) -> SegmentKind {
        switch type.lowercased() {
        case "warmup": return .warmup
        case "work", "main": return .work
        case "recovery": return .recovery
        case "cooldown": return .cooldown
        case "rest": return .rest
        default: return .unknown
        }
    }

    private static func distanceText(_ meters: Double) -> String {
        meters >= 1000
            ? String(format: "%.2f km", meters / 1000)
            : String(format: "%.0f m", meters)
    }

    private static func endCondition(_ end: SegmentEndCondition) -> String {
        switch end.by {
        case .distanceM:
            return distanceText(end.value)
        case .durationSec:
            return duration(end.value)
        case .reps:
            return "\(Int(end.value)) reps"
        }
    }

    private static func targetDetails(_ target: SegmentTarget) -> [String] {
        var parts: [String] = []
        if let min = target.paceSecPerKmMin, let max = target.paceSecPerKmMax {
            parts.append("Ritmo \(pace(Double(min)))-\(pace(Double(max)))/km")
        } else if let min = target.paceSecPerKmMin {
            parts.append("Ritmo >= \(pace(Double(min)))/km")
        } else if let max = target.paceSecPerKmMax {
            parts.append("Ritmo <= \(pace(Double(max)))/km")
        }
        if let zone = target.hrZone {
            parts.append("Z\(zone)")
        }
        if let rpe = target.rpe {
            parts.append("RPE \(rpe)")
        }
        return parts
    }
}
