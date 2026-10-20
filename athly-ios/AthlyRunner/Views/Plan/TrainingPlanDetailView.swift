import SwiftUI

/// Tela dedicada do plano de treino: sumário, veredito de viabilidade (vs. objetivo),
/// análise semanal da IA (reaproveita os insights já gerados) e exclusão do plano.
struct TrainingPlanDetailView: View {
    @EnvironmentObject var planVM: TrainingPlanViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showDeleteConfirmation = false
    @State private var showGoalChange = false
    @State private var goalChangeNotice: String?

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
                        emptyState
                    }
                }
                .padding(AthlyTheme.Spacing.sm)
            }
            .athlyTabBarContentClearance()
            .scrollContentBackground(.hidden)
        }
        .navigationTitle("Plano de Treino")
        .navigationBarTitleDisplayMode(.inline)
        .task { await planVM.loadActiveGoalIfNeeded() }
        .sheet(isPresented: $showGoalChange) {
            GoalChangeFlowView(current: planVM.activeGoal?.parsedGoal) { outcome in
                Task {
                    let generatedNow = await planVM.applyGoalChange(outcome)
                    goalChangeNotice = generatedNow
                        ? String(localized: "Nova meta salva. A semana atual está sendo preparada com ela.")
                        : String(localized: "Nova meta salva. Ela vale a partir da próxima semana; as semanas já geradas continuam como estão.")
                }
            }
        }
        .alert("Meta atualizada", isPresented: Binding(
            get: { goalChangeNotice != nil },
            set: { if !$0 { goalChangeNotice = nil } }
        )) {
            Button("OK", role: .cancel) { goalChangeNotice = nil }
        } message: {
            Text(goalChangeNotice ?? "")
        }
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

            Button {
                showGoalChange = true
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "pencil")
                    Text("Alterar meta")
                }
                .font(AthlyTheme.Typography.semibold(13))
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(AthlySecondaryButtonStyle())
            .disabled(planVM.isGeneratingInBackground || planVM.isGenerating)

            if planVM.isGeneratingInBackground {
                Text("Aguarde o plano em preparo para trocar a meta.")
                    .font(AthlyTheme.Typography.body(11))
                    .foregroundStyle(AthlyTheme.Color.textTertiary)
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

    // MARK: - Feasibility

    private func feasibilityCard(_ f: GoalFeasibility) -> some View {
        let (label, color, icon) = GoalFormatting.verdict(f.verdict)
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
                metricChip(label: "Meta", value: formatTime(f.targetTimeSec), accentColor: color)
                divider1
                metricChip(label: "Semanas", value: "\(Int(f.weeksAvailable))")
            }
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(AthlyTheme.Color.glassBorder, lineWidth: 1)
            )

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
                    .italic()
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .background(
            ZStack {
                AthlyTheme.Color.surfaceCard
                AthlyTheme.Gradient.insightBackground
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous)
                .stroke(color.opacity(0.25), lineWidth: 1)
        )
    }

    // MARK: - Weekly analysis

    private var weeklyAnalysisSection: some View {
        let allWeeksSorted = planVM.weeklyGoals.sorted { $0.parsedStartDate < $1.parsedStartDate }
        let analyzed = planVM.weeklyGoals
            .filter { $0.metrics?.fitnessInsights?.isEmpty == false }
            .sorted { $0.parsedStartDate > $1.parsedStartDate }

        return Group {
            if !analyzed.isEmpty {
                VStack(alignment: .leading, spacing: AthlyTheme.Spacing.sm) {
                    Text("ANÁLISE SEMANAL DA IA")
                        .font(AthlyTheme.Typography.body(11))
                        .fontWeight(.bold)
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                        .tracking(2)
                        .padding(.top, 4)

                    ForEach(analyzed) { goal in
                        let weekNumber = allWeeksSorted.firstIndex(where: { $0.id == goal.id }).map { $0 + 1 }
                        WeeklyGoalInsightCard(goal: goal, weekNumber: weekNumber)
                    }
                }
            }
        }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "calendar")
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
            Text("Nenhum plano ativo")
                .font(AthlyTheme.Typography.semibold(15))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
            Text("Crie um plano na aba Plano para começar a treinar com objetivo.")
                .font(AthlyTheme.Typography.body(13))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 200)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
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
                Text(planVM.isDeleting ? String(localized: "Excluindo...") : String(localized: "Excluir plano"))
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

    private func infoRow(label: LocalizedStringKey, value: String) -> some View {
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

    private func metricChip(label: LocalizedStringKey, value: String, accentColor: Color? = nil) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(AthlyTheme.Typography.semibold(14))
                .foregroundStyle(accentColor ?? AthlyTheme.Color.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Text(label)
                .font(AthlyTheme.Typography.body(10))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    // MARK: - Formatting

    private func formatTime(_ sec: Double) -> String { GoalFormatting.time(sec) }

    private func friendlyDate(_ iso: String?) -> String? { GoalFormatting.friendlyDate(iso) }

    private func statusInfo(_ status: String) -> (String, Color) {
        switch status.uppercased() {
        case "ACTIVE": return (String(localized: "Ativo"), AthlyTheme.Color.success)
        case "DRAFT": return (String(localized: "Rascunho"), AthlyTheme.Color.textSecondary)
        case "COMPLETED": return (String(localized: "Concluído"), AthlyTheme.Color.primary)
        case "CANCELLED": return (String(localized: "Cancelado"), AthlyTheme.Color.warning)
        case "LOCKED": return (String(localized: "Bloqueado"), AthlyTheme.Color.warning)
        default: return (status.capitalized, AthlyTheme.Color.textSecondary)
        }
    }
}
