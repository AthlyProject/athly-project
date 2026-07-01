import SwiftUI
import UIKit

struct AdminView: View {
    @StateObject private var vm = AdminViewModel()
    @State private var didCopy = false

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    weekPicker
                    if vm.isLoadingReport {
                        ProgressView()
                            .tint(AthlyTheme.Color.primary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding()
                    } else if let report = vm.report {
                        actionButtons
                        section(title: "Resumo da semana") {
                            Text("Período: \(report.weekStartDate.prefix(10)) – \(report.weekEndDate.prefix(10))")
                            if let log = report.promptLog {
                                Text("Modelo: \(log.modelUsed)")
                                Text("Prompt v\(log.promptVersion) • \(log.generationType)")
                                Text("Gerado em: \(log.createdAt)")
                            } else {
                                Text("Sem prompt log para esta semana")
                                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                            }
                        }

                        section(title: "Corridas concluídas (\(report.workouts.count))") {
                            if report.workouts.isEmpty {
                                Text("Nenhuma corrida registrada.")
                                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                            } else {
                                ForEach(report.workouts) { w in
                                    workoutRow(w)
                                }
                            }
                        }

                        section(title: "Prompt enviado") {
                            Text(report.promptLog?.promptText ?? "(sem prompt log)")
                                .font(.system(size: 12, design: .monospaced))
                                .textSelection(.enabled)
                        }

                        section(title: "Resposta da IA") {
                            Text(report.promptLog?.rawResponse ?? "(sem response log)")
                                .font(.system(size: 12, design: .monospaced))
                                .textSelection(.enabled)
                        }
                    } else if let err = vm.errorMessage {
                        Text(err)
                            .foregroundStyle(AthlyTheme.Color.error)
                    } else if !vm.isLoadingWeeks {
                        Text("Selecione uma semana acima")
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                    }
                }
                .padding(16)
            }
            .athlyTabBarContentClearance()
        }
        .navigationTitle("Admin")
        .task { await vm.loadWeeks() }
        .onChange(of: vm.selectedWeekId) { newValue in
            guard let id = newValue else { return }
            Task { await vm.loadReport(weekId: id) }
        }
    }

    // MARK: - Subviews

    private var weekPicker: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Semana")
                .font(AthlyTheme.Typography.semibold(13))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
            if vm.isLoadingWeeks {
                ProgressView().tint(AthlyTheme.Color.primary)
            } else if vm.weeks.isEmpty {
                Text("Nenhuma semana disponível")
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
            } else {
                Picker("Semana", selection: Binding(
                    get: { vm.selectedWeekId ?? vm.weeks.first?.id ?? "" },
                    set: { vm.selectedWeekId = $0 }
                )) {
                    ForEach(vm.weeks) { w in
                        Text("\(w.weekStartDate.prefix(10)) – \(w.weekEndDate.prefix(10))")
                            .tag(w.id)
                    }
                }
                .pickerStyle(.menu)
                .tint(AthlyTheme.Color.primary)
            }
        }
    }

    private var actionButtons: some View {
        HStack(spacing: 12) {
            Button {
                UIPasteboard.general.string = vm.composedReportText
                didCopy = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { didCopy = false }
            } label: {
                HStack {
                    Image(systemName: didCopy ? "checkmark" : "doc.on.doc")
                    Text(didCopy ? "Copiado!" : "Copiar tudo")
                }
                .font(AthlyTheme.Typography.semibold(14))
                .padding(.vertical, 8)
                .padding(.horizontal, 14)
                .background(AthlyTheme.Color.surfaceDark)
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .clipShape(Capsule())
            }

            if let url = vm.writeReportFile() {
                ShareLink(item: url) {
                    HStack {
                        Image(systemName: "square.and.arrow.up")
                        Text("Compartilhar .txt")
                    }
                    .font(AthlyTheme.Typography.semibold(14))
                    .padding(.vertical, 8)
                    .padding(.horizontal, 14)
                    .background(AthlyTheme.Color.surfaceDark)
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                    .clipShape(Capsule())
                }
            }
        }
    }

    private func workoutRow(_ w: AdminWorkoutSummary) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(w.dateScheduled.prefix(10)) • \(w.title)")
                .font(AthlyTheme.Typography.semibold(14))
            HStack(spacing: 12) {
                if let d = w.actualDistanceMeters {
                    Text(String(format: "%.2f km", d / 1000))
                }
                if let s = w.actualDurationSeconds {
                    Text(formatDuration(s))
                }
                Text("• \(w.status)")
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
            }
            .font(AthlyTheme.Typography.body(12))
            .foregroundStyle(AthlyTheme.Color.textSecondary)
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func section<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(AthlyTheme.Typography.semibold(15))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            content()
                .font(AthlyTheme.Typography.body(13))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(12)
        .background(AthlyTheme.Color.surfaceDark)
        .cornerRadius(12)
    }

    private func formatDuration(_ seconds: Double) -> String {
        let total = Int(seconds)
        let h = total / 3600
        let m = (total % 3600) / 60
        let s = total % 60
        if h > 0 { return String(format: "%d:%02d:%02d", h, m, s) }
        return String(format: "%d:%02d", m, s)
    }
}
