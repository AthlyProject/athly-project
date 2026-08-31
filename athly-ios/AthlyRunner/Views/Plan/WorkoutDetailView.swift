import SwiftUI

struct WorkoutDetailView: View {
    let workout: WorkoutModel
    var onComplete: (() -> Void)? = nil
    /// Inicia a corrida deste treino (janela de 2 dias). Quando nil, o botão "Iniciar" não aparece.
    var onStart: ((WorkoutModel) -> Void)? = nil
    /// Pula o treino agendado. Quando nil, o botão "Pular" não aparece.
    var onSkip: (() -> Void)? = nil

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AthlyTheme.Spacing.md) {
                headerSection
                if let desc = workout.description, !desc.isEmpty {
                    descriptionSection(desc)
                }
                if let ws = workout.segments, !ws.segments.isEmpty {
                    segmentsSection(ws)
                } else if !workout.blocks.isEmpty {
                    blocksSection
                } else {
                    noBlocksCard
                }
                if (workout.status == .done || workout.status == .partial),
                   let distM = workout.actualDistanceMeters,
                   let durSec = workout.actualDurationSeconds {
                    runSummarySection(distanceM: distM, durationSec: durSec)
                }
                if workout.canStartNow, let onStart {
                    Button {
                        onStart(workout)
                    } label: {
                        HStack {
                            Image(systemName: "figure.run")
                            Text("Iniciar treino")
                        }
                    }
                    .buttonStyle(AthlyGradientButtonStyle())
                    .padding(.top, 8)
                }
                if workout.status == .scheduled, let onComplete {
                    if workout.canStartNow {
                        Button {
                            onComplete()
                        } label: {
                            HStack {
                                Image(systemName: "checkmark.circle.fill")
                                Text("Concluir treino")
                            }
                        }
                        .buttonStyle(AthlySecondaryButtonStyle())
                    } else {
                        Button {
                            onComplete()
                        } label: {
                            HStack {
                                Image(systemName: "checkmark.circle.fill")
                                Text("Concluir treino")
                            }
                        }
                        .buttonStyle(AthlyGradientButtonStyle())
                        .padding(.top, 8)
                    }
                }
                if workout.status == .scheduled, let onSkip {
                    Button {
                        onSkip()
                    } label: {
                        HStack {
                            Image(systemName: "forward.fill")
                            Text("Pular treino")
                        }
                    }
                    .buttonStyle(AthlyGhostButtonStyle())
                    .padding(.top, 8)
                }
                if workout.sportType == .running,
                   (workout.status == .done || workout.status == .partial),
                   let onComplete {
                    Button {
                        onComplete()
                    } label: {
                        HStack {
                            Image(systemName: "doc.badge.plus")
                            Text("Adicionar dados da corrida")
                        }
                    }
                    .buttonStyle(AthlySecondaryButtonStyle())
                    .padding(.top, 8)
                }
            }
            .padding(AthlyTheme.Spacing.sm)
        }
        .athlyTabBarContentClearance()
        .background(AthlyTheme.Color.backgroundDark)
        .navigationTitle(workout.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            if workout.isGoalAttempt == true {
                HStack(spacing: 6) {
                    Text("🎯")
                    Text("Treino-alvo")
                        .font(AthlyTheme.Typography.label())
                        .textCase(.uppercase)
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(AthlyTheme.Color.primary.opacity(0.18))
                .overlay(Capsule().stroke(AthlyTheme.Color.primary, lineWidth: 1))
                .clipShape(Capsule())
            }
            HStack {
                SportBadgeView(sport: workout.sportType)
                Spacer()
                StatusBadgeView(status: workout.status)
            }
            Text(workout.parsedDate.formatted(date: .long, time: .omitted))
                .font(AthlyTheme.Typography.body(15))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
            if let intensity = workout.intensity {
                HStack(spacing: 8) {
                    Image(systemName: "star.fill")
                        .font(.system(size: 8))
                        .foregroundStyle(AthlyTheme.Color.warning)
                    Text("Intensidade")
                        .font(AthlyTheme.Typography.body(13))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                    HStack(spacing: 3) {
                        ForEach(1...10, id: \.self) { i in
                            RoundedRectangle(cornerRadius: 2)
                                .fill(i <= Int(intensity) ? AthlyTheme.Color.warning : Color.white.opacity(0.08))
                                .frame(width: 16, height: 5)
                        }
                    }
                    Text("\(Int(intensity))/10")
                        .font(AthlyTheme.Typography.mono(9))
                        .foregroundStyle(AthlyTheme.Color.warning)
                }
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyCard()
    }

    private func descriptionSection(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Descrição")
                .font(AthlyTheme.Typography.label())
                .textCase(.uppercase)
                .foregroundStyle(AthlyTheme.Color.textTertiary)
            Text(text)
                .font(AthlyTheme.Typography.body(14))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(AthlyTheme.Spacing.sm)
        .athlyCard()
    }

    private func runSummarySection(distanceM: Double, durationSec: Double) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Sessão concluída")
                .font(AthlyTheme.Typography.label())
                .textCase(.uppercase)
                .foregroundStyle(AthlyTheme.Color.success)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                runStatCell(value: String(format: "%.1f km", distanceM / 1000), key: "Distância", valueColor: AthlyTheme.Color.primary)
                runStatCell(value: formatRunDuration(durationSec), key: "Duração")
                if distanceM > 0 {
                    runStatCell(value: formatPaceStat(durationSec: durationSec, distanceM: distanceM), key: "Pace /km")
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(AthlyTheme.Spacing.sm)
        .background(AthlyTheme.Color.success.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous)
                .stroke(AthlyTheme.Color.success.opacity(0.22), lineWidth: 1)
        )
    }

    private func runStatCell(value: String, key: String, valueColor: Color = AthlyTheme.Color.textPrimary) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(AthlyTheme.Typography.mono(15))
                .foregroundStyle(valueColor)
            Text(key)
                .font(AthlyTheme.Typography.label())
                .textCase(.uppercase)
                .foregroundStyle(AthlyTheme.Color.textTertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(Color.white.opacity(0.03))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(AthlyTheme.Color.borderDark, lineWidth: 1)
        )
    }

    private func formatRunDuration(_ sec: Double) -> String {
        let s = Int(sec)
        if s >= 3600 {
            return String(format: "%d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
        }
        return String(format: "%d:%02d", s / 60, s % 60)
    }

    private func formatPaceStat(durationSec: Double, distanceM: Double) -> String {
        let secPerKm = durationSec / (distanceM / 1000)
        let min = Int(secPerKm) / 60
        let sec = Int(secPerKm) % 60
        return String(format: "%d:%02d", min, sec)
    }

    private func segmentsSection(_ ws: WorkoutSegments) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Estrutura do treino")
                .font(AthlyTheme.Typography.semibold(15))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .padding(.horizontal, 4)

            ForEach(ws.segments) { seg in
                SegmentNodeView(segment: seg)
            }
        }
    }

    private var blocksSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Blocos do treino")
                .font(AthlyTheme.Typography.semibold(15))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .padding(.horizontal, 4)

            ForEach(Array(workout.blocks.enumerated()), id: \.offset) { index, block in
                BlockCardView(block: block, index: index + 1)
            }
        }
    }

    private var noBlocksCard: some View {
        VStack(spacing: 12) {
            Image(systemName: "list.bullet.rectangle")
                .font(.system(size: 36))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
            Text("Nenhum bloco definido para este treino")
                .font(AthlyTheme.Typography.body(15))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(24)
        .athlyCard()
    }
}

// MARK: - Segment Tree Renderer

private struct SegmentNodeView: View {
    let segment: Segment
    @State private var expanded = true

    var body: some View {
        if segment.kind == .set {
            setView
        } else {
            leafView
        }
    }

    // MARK: Set node

    private var setView: some View {
        VStack(alignment: .leading, spacing: 6) {
            Button { expanded.toggle() } label: {
                HStack(spacing: 8) {
                    Text("\(segment.repetitions ?? 1)×")
                        .font(.custom("SpaceGrotesk-Bold", size: 18))
                        .foregroundStyle(AthlyTheme.Color.primary)
                    Text(segment.label ?? "Série")
                        .font(AthlyTheme.Typography.semibold(15))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                    Spacer()
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                }
                .padding(AthlyTheme.Spacing.sm)
                .background(AthlyTheme.Color.surfaceCard)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(AthlyTheme.Color.primary.opacity(0.3), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)

            if expanded, let children = segment.children, !children.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(children) { child in
                        SegmentNodeView(segment: child)
                    }
                }
                .padding(.leading, 16)
            }
        }
    }

    // MARK: Leaf node

    private var leafView: some View {
        HStack(alignment: .top, spacing: 0) {
            RoundedRectangle(cornerRadius: 2)
                .fill(kindColor)
                .frame(width: 4)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(segment.label ?? kindLabel)
                        .font(AthlyTheme.Typography.semibold(14))
                        .foregroundStyle(kindColor)
                    Spacer()
                    if let end = segment.end {
                        Text(formatEnd(end))
                            .font(.custom("SpaceGrotesk-Bold", size: 14).monospacedDigit())
                            .foregroundStyle(kindColor)
                    }
                }

                if let text = segment.cue ?? segment.notes, !text.isEmpty {
                    Text(text)
                        .font(AthlyTheme.Typography.body(13))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }

                targetRow
            }
            .padding(AthlyTheme.Spacing.sm)
        }
        .background(AthlyTheme.Color.surfaceCard)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    @ViewBuilder
    private var targetRow: some View {
        if let t = segment.target {
            if let min = t.paceSecPerKmMin, let max = t.paceSecPerKmMax {
                Label("Ritmo \(formatPace(min))–\(formatPace(max))/km", systemImage: "speedometer")
                    .font(AthlyTheme.Typography.body(12))
                    .foregroundStyle(AthlyTheme.Color.textTertiary)
            } else if let min = t.paceSecPerKmMin {
                Label("Ritmo ≥ \(formatPace(min))/km", systemImage: "speedometer")
                    .font(AthlyTheme.Typography.body(12))
                    .foregroundStyle(AthlyTheme.Color.textTertiary)
            }
            if let zone = t.hrZone {
                Label("Zona \(zone)", systemImage: "heart.fill")
                    .font(AthlyTheme.Typography.body(12))
                    .foregroundStyle(AthlyTheme.Color.textTertiary)
            }
            if let exercise = t.exercise {
                Label(exercise, systemImage: "dumbbell")
                    .font(AthlyTheme.Typography.body(12))
                    .foregroundStyle(AthlyTheme.Color.textTertiary)
            }
        }
    }

    private var kindColor: Color {
        switch segment.kind {
        case .warmup:   return AthlyTheme.Color.success
        case .work:     return AthlyTheme.Color.error
        case .recovery: return AthlyTheme.Color.primary
        case .cooldown: return AthlyTheme.Color.secondary
        case .rest:     return AthlyTheme.Color.textTertiary
        default:        return AthlyTheme.Color.secondary
        }
    }

    private var kindLabel: String {
        switch segment.kind {
        case .warmup:   return "Aquecimento"
        case .work:     return "Tiro"
        case .recovery: return "Recuperação"
        case .cooldown: return "Desaquecimento"
        case .rest:     return "Descanso"
        default:        return "Bloco"
        }
    }

    private func formatEnd(_ end: SegmentEndCondition) -> String {
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

    private func formatPace(_ sec: Int) -> String {
        String(format: "%d:%02d", sec / 60, sec % 60)
    }
}

// MARK: - Block Card

private struct BlockCardView: View {
    let block: WorkoutBlock
    let index: Int

    private var blockTitle: String {
        switch block.type.lowercased() {
        case "warmup", "aquecimento": return "Aquecimento"
        case "cooldown", "desaquecimento": return "Desaquecimento"
        case "rest", "descanso": return "Descanso"
        case "run", "corrida": return "Corrida"
        default: return block.type.capitalized
        }
    }

    private var blockIcon: String {
        switch block.type.lowercased() {
        case "warmup", "aquecimento": return "flame.fill"
        case "cooldown", "desaquecimento": return "snowflake"
        case "rest", "descanso": return "bed.double.fill"
        case "run", "corrida": return "figure.run"
        default: return "circle.fill"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: blockIcon)
                    .font(.system(size: 18))
                    .foregroundStyle(AthlyTheme.Color.primary)
                Text("\(index). \(blockTitle)")
                    .font(AthlyTheme.Typography.semibold(15))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
            }

            HStack(spacing: 16) {
                if let d = block.duration {
                    Label(formatDuration(d), systemImage: "clock")
                        .font(AthlyTheme.Typography.body(13))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }
                if let dist = block.distance {
                    Label(formatDistance(dist), systemImage: "location")
                        .font(AthlyTheme.Typography.body(13))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }
                if let pace = block.targetPace, !pace.isEmpty {
                    Label("Ritmo \(pace)/km", systemImage: "speedometer")
                        .font(AthlyTheme.Typography.body(13))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }
            }

            if let instructions = block.instructions, !instructions.isEmpty {
                Text(instructions)
                    .font(AthlyTheme.Typography.body(14))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(AthlyTheme.Spacing.sm)
        .athlyCard()
    }

    private func formatDuration(_ value: Double) -> String {
        if value < 60 {
            return "\(Int(value)) min"
        }
        let min = Int(value) / 60
        let sec = Int(value) % 60
        return sec > 0 ? "\(min)min \(sec)s" : "\(min) min"
    }

    private func formatDistance(_ km: Double) -> String {
        if km < 1 {
            return "\(Int(km * 1000)) m"
        }
        return String(format: "%.2f km", km)
    }
}
