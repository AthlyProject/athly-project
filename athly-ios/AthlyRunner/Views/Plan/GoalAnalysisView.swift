import SwiftUI

/// Análise da meta antes do plano: veredito, números, texto e as alternativas na mesma data.
/// No onboarding, "Continuar" gera a primeira semana; na troca de meta, confirma a meta nova.
struct GoalAnalysisView: View {
    @ObservedObject var viewModel: GoalAnalysisViewModel
    let onFinish: (GoalAnalysisViewModel.Outcome) -> Void
    /// Troca de meta: volta para editar o rascunho.
    var onBack: (() -> Void)?

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark.ignoresSafeArea()
            RadialGradient(
                colors: [AthlyTheme.Color.primary.opacity(0.18), .clear],
                center: .top, startRadius: 0, endRadius: 360
            )
            .ignoresSafeArea()

            switch viewModel.phase {
            case .loading:
                loadingState
            case .failed(let message):
                failedState(message)
            case .loaded(let analysis):
                content(analysis)
            }
        }
        .task {
            guard case .loading = viewModel.phase else { return }
            await viewModel.load()
            // Meta sem prova datada (fitness, ultra): no onboarding não há o que analisar.
            if viewModel.mode == .onboarding, let analysis = viewModel.analysis, !analysis.isApplicable,
               let outcome = await viewModel.confirm() {
                onFinish(outcome)
            }
        }
    }

    // MARK: - States

    private var loadingState: some View {
        VStack(spacing: 14) {
            ProgressView().tint(AthlyTheme.Color.primary).scaleEffect(1.2)
            Text("Analisando suas corridas…")
                .font(AthlyTheme.Typography.medium(14))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
        }
    }

    private func failedState(_ message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 34, weight: .light))
                .foregroundStyle(AthlyTheme.Color.warning)
            Text("Não foi possível analisar a meta agora.")
                .font(AthlyTheme.Typography.semibold(15))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Text(message)
                .font(AthlyTheme.Typography.body(12))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .multilineTextAlignment(.center)
            Button("Tentar novamente") { Task { await viewModel.load() } }
                .buttonStyle(AthlyGradientButtonStyle())
            if viewModel.isChange {
                Button("Voltar") { onBack?() }
                    .buttonStyle(.plain)
                    .font(AthlyTheme.Typography.semibold(12))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
            } else {
                Button("Continuar sem análise") {
                    Task { onFinish(await viewModel.continueWithoutAnalysis()) }
                }
                .buttonStyle(.plain)
                .font(AthlyTheme.Typography.semibold(12))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
            }
        }
        .padding(AthlyTheme.Spacing.md)
    }

    // MARK: - Content

    private func content(_ analysis: GoalAnalysis) -> some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header(analysis)
                    verdictBlock(analysis)
                    stats(analysis)
                    if analysis.lowConfidence == true && analysis.hasHistory == true {
                        Text("Estimativa preliminar — fica mais precisa conforme você registra corridas.")
                            .font(AthlyTheme.Typography.body(11))
                            .italic()
                            .foregroundStyle(AthlyTheme.Color.textTertiary)
                    }
                    options(analysis)
                }
                .padding(.horizontal, AthlyTheme.Spacing.sm)
                .padding(.top, 24)
                .padding(.bottom, 16)
            }
            footer
        }
    }

    private func header(_ analysis: GoalAnalysis) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("ANÁLISE DA SUA META")
                    .font(AthlyTheme.Typography.body(11))
                    .fontWeight(.bold)
                    .tracking(2)
                    .foregroundStyle(AthlyTheme.Color.textTertiary)
                Spacer()
                if viewModel.isChange, let onBack {
                    Button(action: onBack) {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            Text(analysis.goal.summary)
                .font(AthlyTheme.Typography.heading(22))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            if let date = GoalFormatting.friendlyDate(analysis.goal.eventDate) {
                Text(eventLine(date: date, weeks: analysis.numbers?.weeksAvailable))
                    .font(AthlyTheme.Typography.body(12))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
            }
        }
    }

    private func eventLine(date: String, weeks: Double?) -> String {
        guard let weeks else { return String(localized: "Prova em \(date)") }
        return String(localized: "Prova em \(date) · \(Int(weeks)) semanas")
    }

    private func verdictBlock(_ analysis: GoalAnalysis) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if let verdict = analysis.verdict {
                let info = GoalFormatting.verdict(verdict)
                HStack(spacing: 6) {
                    Image(systemName: info.icon)
                    Text(info.label)
                }
                .font(AthlyTheme.Typography.semibold(12))
                .foregroundStyle(info.color)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(info.color.opacity(0.15))
                .clipShape(Capsule())
            }
            Text(analysis.title)
                .font(AthlyTheme.Typography.semibold(17))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Text(analysis.message)
                .font(AthlyTheme.Typography.body(13))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(AthlyTheme.Spacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .athlyInsightCard()
    }

    @ViewBuilder
    private func stats(_ analysis: GoalAnalysis) -> some View {
        if let n = analysis.numbers, let target = n.targetTimeSec {
            DetectedRunStatsRow {
                DetectedRunStatCell(value: n.timeTodaySec.map(GoalFormatting.time) ?? "—", key: "Hoje")
                DetectedRunStatDivider()
                DetectedRunStatCell(value: GoalFormatting.time(target), key: "Meta")
                DetectedRunStatDivider()
                DetectedRunStatCell(value: n.timeAtEventSec.map(GoalFormatting.time) ?? "—", key: "Na prova")
            }
        } else if let n = analysis.numbers, let required = n.requiredLongestKm {
            DetectedRunStatsRow {
                DetectedRunStatCell(value: n.longestKm.map(kilometers) ?? "—", unit: "km", key: "Maior corrida")
                DetectedRunStatDivider()
                DetectedRunStatCell(value: kilometers(required), unit: "km", key: "Referência")
                DetectedRunStatDivider()
                DetectedRunStatCell(value: n.weeksAvailable.map { "\(Int($0))" } ?? "—", key: "Semanas")
            }
        }
    }

    private func kilometers(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...1)))
    }

    @ViewBuilder
    private func options(_ analysis: GoalAnalysis) -> some View {
        if !analysis.options.isEmpty || viewModel.isChange {
            VStack(alignment: .leading, spacing: 9) {
                Text(analysis.options.isEmpty ? LocalizedStringKey("SUA META NOVA") : LocalizedStringKey("O QUE VOCÊ PREFERE?"))
                    .font(AthlyTheme.Typography.body(11))
                    .fontWeight(.bold)
                    .tracking(2)
                    .foregroundStyle(AthlyTheme.Color.textTertiary)
                    .padding(.top, 4)

                GoalOptionCard(
                    systemImage: "flag.checkered",
                    tint: AthlyTheme.Color.primary,
                    title: viewModel.isChange ? String(localized: "Usar a meta que escolhi") : String(localized: "Manter minha meta"),
                    subtitle: analysis.goal.summary,
                    isSelected: viewModel.selectedAlternativeID == nil
                ) { viewModel.selectedAlternativeID = nil }

                ForEach(analysis.options) { alternative in
                    GoalOptionCard(
                        systemImage: icon(for: alternative),
                        tint: AthlyTheme.Color.success,
                        title: alternative.summary,
                        subtitle: subtitle(for: alternative),
                        isSelected: viewModel.selectedAlternativeID == alternative.id
                    ) { viewModel.selectedAlternativeID = alternative.id }
                }
            }
        }
    }

    private func icon(for alternative: GoalAnalysis.Alternative) -> String {
        switch alternative.axis {
        case "time": return "stopwatch"
        case "distance": return "point.topleft.down.curvedto.point.bottomright.up"
        default: return "arrow.triangle.2.circlepath"
        }
    }

    private func subtitle(for alternative: GoalAnalysis.Alternative) -> String {
        if alternative.source == "projection" {
            return String(localized: "Mesma prova, no tempo que a projeção do seu condicionamento indica.")
        }
        switch alternative.axis {
        case "time": return String(localized: "Mesma prova, num tempo que seus treinos já sustentam.")
        case "distance": return String(localized: "Prova menor, para completar com a resistência que você já tem.")
        default: return String(localized: "Prova menor, no tempo que você corre hoje.")
        }
    }

    // MARK: - Footer

    private var footer: some View {
        VStack(spacing: 10) {
            if let error = viewModel.errorMessage {
                Text(error)
                    .font(AthlyTheme.Typography.body(12))
                    .foregroundStyle(AthlyTheme.Color.error)
                    .multilineTextAlignment(.center)
            }
            Button {
                Task {
                    if let outcome = await viewModel.confirm() { onFinish(outcome) }
                }
            } label: {
                HStack(spacing: 7) {
                    if viewModel.isConfirming {
                        ProgressView().tint(.white).scaleEffect(0.85)
                    }
                    Text(viewModel.isChange ? LocalizedStringKey("Confirmar nova meta") : LocalizedStringKey("Continuar"))
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(AthlyGradientButtonStyle())
            .disabled(viewModel.isConfirming)
        }
        .padding(.horizontal, AthlyTheme.Spacing.sm)
        .padding(.top, 12)
        .padding(.bottom, 14)
        .background(AthlyTheme.Color.backgroundDark)
    }
}

/// Cartão de opção com textos vindos do servidor (por isso `String`, não `LocalizedStringKey`).
private struct GoalOptionCard: View {
    let systemImage: String
    let tint: Color
    let title: String
    let subtitle: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(tint)
                    .frame(width: 44, height: 44)
                    .background(AthlyTheme.Color.backgroundAlt)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(AthlyTheme.Color.borderMid, lineWidth: 1)
                    )
                VStack(alignment: .leading, spacing: 2) {
                    Text(verbatim: title)
                        .font(AthlyTheme.Typography.semibold(13))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                    Text(verbatim: subtitle)
                        .font(AthlyTheme.Typography.body(10))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                DetectedRunCheckCircle(isSelected: isSelected, size: 20)
            }
            .padding(12)
            .background(isSelected ? AthlyTheme.Color.primarySoft : AthlyTheme.Color.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                    .stroke(isSelected ? AthlyTheme.Color.primary : AthlyTheme.Color.borderDark, lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
    }
}
