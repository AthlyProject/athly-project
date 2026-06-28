import SwiftUI

/// Tela dedicada do plano de treino: sumário, veredito de viabilidade (vs. objetivo),
/// análise semanal da IA (reaproveita os insights já gerados) e exclusão do plano.
struct TrainingPlanDetailView: View {
    @EnvironmentObject var planVM: TrainingPlanViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showDeleteConfirmation = false

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark.ignoresSafeArea()

            ScrollView {
                VStack(spacing: AthlyTheme.Spacing.sm) {
                    if let plan = planVM.trainingPlanResponse {
                        summaryCard(plan)

                        if let feasibility = planVM.activeGoal?.feasibility {
                            feasibilityCard(feasibility)
                        }

                        weeklyAnalysisSection

                        deleteButton
                    } else {
                        Text("Nenhum plano ativo.")
                            .font(AthlyTheme.Typography.body(15))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                            .padding(.top, 40)
                    }
                }
                .padding(AthlyTheme.Spacing.sm)
            }
            .scrollContentBackground(.hidden)
        }
        .navigationTitle("Plano de Treino")
        .navigationBarTitleDisplayMode(.inline)
        .task { await planVM.loadActiveGoalIfNeeded() }
        .alert("Excluir plano", isPresented: $showDeleteConfirmation) {
            Button("Cancelar", role: .cancel) {}
            Button("Excluir", role: .destructive) {
                Task {
                    let ok = await planVM.deleteTrainingPlan()
                    if ok { dismiss() }
                }
            }
        } message: {
            Text("Isso apaga este plano e todos os treinos e semanas. Guardamos um resumo das últimas semanas para personalizar seu próximo plano. Esta ação não pode ser desfeita.")
        }
    }

    // MARK: - Summary

    private func summaryCard(_ plan: TrainingPlanResponse) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                Text(plan.objective)
                    .font(AthlyTheme.Typography.semibold(18))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer()
                if let status = plan.status {
                    statusBadge(status)
                }
            }

            VStack(spacing: 0) {
                infoRow(label: "Semanas", value: "\(planVM.weeks.count)")
                divider
                infoRow(label: "Início", value: friendlyDate(plan.startDate) ?? "—")
                if let target = plan.targetDate {
                    divider
                    infoRow(label: "Data-alvo", value: friendlyDate(target) ?? "—")
                }
                divider
                infoRow(label: "Esportes", value: plan.sports.map { $0.label }.joined(separator: ", "))
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyInsightCard()
    }

    private func statusBadge(_ status: String) -> some View {
        let (label, color) = statusInfo(status)
        return Text(label)
            .font(AthlyTheme.Typography.semibold(11))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15))
            .clipShape(Capsule())
    }

    // MARK: - Feasibility (vs objetivo)

    private func feasibilityCard(_ f: GoalFeasibility) -> some View {
        let (label, color, icon) = verdictInfo(f.verdict)
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption)
                    .foregroundStyle(color)
                Text("Viabilidade vs. objetivo")
                    .font(AthlyTheme.Typography.semibold(15))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                Spacer()
                Text(label)
                    .font(AthlyTheme.Typography.semibold(11))
                    .foregroundStyle(color)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(color.opacity(0.15))
                    .clipShape(Capsule())
            }

            HStack(spacing: 0) {
                metricChip(label: "Projeção atual", value: formatTime(f.currentProjectedTimeSec))
                divider1
                metricChip(label: "Meta", value: formatTime(f.targetTimeSec))
                divider1
                metricChip(label: "Semanas", value: "\(Int(f.weeksAvailable))")
            }

            if let suggestion = f.suggestion,
               (f.verdict == "ambitious" || f.verdict == "unrealistic") {
                VStack(alignment: .leading, spacing: 4) {
                    if let realistic = suggestion.realisticTimeSec {
                        Text("Tempo realista até a data: \(formatTime(realistic))")
                            .font(AthlyTheme.Typography.body(13))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                    }
                    if let date = suggestion.suggestedDate, let friendly = friendlyDate(date) {
                        Text("Ou mire a data: \(friendly)")
                            .font(AthlyTheme.Typography.body(13))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                    }
                }
            }

            if f.lowConfidence {
                Text("Estimativa preliminar — fica mais precisa conforme você registra corridas.")
                    .font(AthlyTheme.Typography.body(12))
                    .foregroundStyle(AthlyTheme.Color.textTertiary)
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyInsightCard()
    }

    // MARK: - Weekly analysis (reaproveita os insights da IA já gerados)

    private var weeklyAnalysisSection: some View {
        let analyzed = planVM.weeklyGoals
            .filter { ($0.metrics?.fitnessInsights?.isEmpty == false) }
            .sorted { $0.parsedStartDate > $1.parsedStartDate }

        return Group {
            if !analyzed.isEmpty {
                VStack(alignment: .leading, spacing: AthlyTheme.Spacing.sm) {
                    Text("Análise semanal da IA")
                        .font(AthlyTheme.Typography.semibold(16))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                        .padding(.top, 4)

                    ForEach(analyzed) { goal in
                        WeeklyGoalInsightCard(goal: goal)
                    }
                }
            }
        }
    }

    // MARK: - Delete

    private var deleteButton: some View {
        Button {
            showDeleteConfirmation = true
        } label: {
            HStack {
                if planVM.isDeleting {
                    ProgressView().tint(AthlyTheme.Color.error).scaleEffect(0.8)
                } else {
                    Image(systemName: "trash")
                }
                Text(planVM.isDeleting ? "Excluindo..." : "Excluir plano")
            }
            .font(AthlyTheme.Typography.semibold(15))
            .foregroundStyle(AthlyTheme.Color.error)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous)
                    .stroke(AthlyTheme.Color.error.opacity(0.5), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(planVM.isDeleting)
        .padding(.top, 8)
    }

    // MARK: - Bits

    private var divider: some View {
        Rectangle().fill(AthlyTheme.Color.glassBorder).frame(height: 1).padding(.vertical, 8)
    }

    private var divider1: some View {
        Rectangle().fill(AthlyTheme.Color.glassBorder).frame(width: 1, height: 28)
    }

    private func infoRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(AthlyTheme.Typography.body(14))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
            Spacer()
            Text(value)
                .font(AthlyTheme.Typography.semibold(14))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .multilineTextAlignment(.trailing)
        }
    }

    private func metricChip(label: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(AthlyTheme.Typography.semibold(14))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Text(label)
                .font(AthlyTheme.Typography.body(10))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Formatting

    private func formatTime(_ sec: Double) -> String {
        let total = Int(sec.rounded())
        let h = total / 3600, m = (total % 3600) / 60, s = total % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s)
    }

    private func friendlyDate(_ iso: String?) -> String? {
        guard let iso else { return nil }
        let inFmt = DateFormatter()
        inFmt.dateFormat = "yyyy-MM-dd"
        guard let date = inFmt.date(from: String(iso.prefix(10))) else { return String(iso.prefix(10)) }
        let outFmt = DateFormatter()
        outFmt.dateFormat = "dd/MM/yyyy"
        return outFmt.string(from: date)
    }

    private func verdictInfo(_ verdict: String) -> (String, Color, String) {
        switch verdict {
        case "ready": return ("Pronto", AthlyTheme.Color.success, "checkmark.seal.fill")
        case "feasible": return ("Viável", AthlyTheme.Color.success, "checkmark.circle.fill")
        case "ambitious": return ("Ambicioso", AthlyTheme.Color.warning, "flame.fill")
        case "unrealistic": return ("Inviável no prazo", AthlyTheme.Color.error, "exclamationmark.triangle.fill")
        default: return (verdict, AthlyTheme.Color.textSecondary, "questionmark.circle")
        }
    }

    private func statusInfo(_ status: String) -> (String, Color) {
        switch status.uppercased() {
        case "ACTIVE": return ("Ativo", AthlyTheme.Color.success)
        case "DRAFT": return ("Rascunho", AthlyTheme.Color.textSecondary)
        case "COMPLETED": return ("Concluído", AthlyTheme.Color.primary)
        case "CANCELLED": return ("Cancelado", AthlyTheme.Color.warning)
        case "LOCKED": return ("Bloqueado", AthlyTheme.Color.warning)
        default: return (status.capitalized, AthlyTheme.Color.textSecondary)
        }
    }
}
