import SwiftUI

struct WorkoutDetailView: View {
    let workout: WorkoutModel
    var onComplete: (() -> Void)? = nil

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AthlyTheme.Spacing.md) {
                headerSection
                if let desc = workout.description, !desc.isEmpty {
                    descriptionSection(desc)
                }
                if !workout.blocks.isEmpty {
                    blocksSection
                } else {
                    noBlocksCard
                }
                if workout.status == .scheduled, let onComplete {
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
            .padding(AthlyTheme.Spacing.sm)
            .padding(.bottom, 80)
        }
        .background(AthlyTheme.Color.backgroundDark)
        .navigationTitle(workout.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SportBadgeView(sport: workout.sportType)
                Spacer()
                StatusBadgeView(status: workout.status)
            }
            Text(workout.parsedDate.formatted(date: .long, time: .omitted))
                .font(AthlyTheme.Typography.body(15))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
            if let intensity = workout.intensity {
                HStack(spacing: 6) {
                    Image(systemName: "bolt.fill")
                        .foregroundStyle(AthlyTheme.Color.primary)
                    Text("Intensidade \(Int(intensity))/10")
                        .font(AthlyTheme.Typography.body(14))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyCard()
    }

    private func descriptionSection(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Descrição")
                .font(AthlyTheme.Typography.semibold(15))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Text(text)
                .font(AthlyTheme.Typography.body(15))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(AthlyTheme.Spacing.sm)
        .athlyCard()
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

