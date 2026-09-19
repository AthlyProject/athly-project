import SwiftUI

/// S3 · Confirmação do vínculo, comparando o planejado com o que foi realizado.
struct DetectedRunLinkedView: View {
    let run: HealthKitRunItem
    let workout: WorkoutModel?
    let onOpenPlan: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: 0) {
                    successHero
                    if let workout {
                        comparisonCard(workout)
                            .padding(.horizontal, AthlyTheme.Spacing.sm)
                            .padding(.top, 16)
                    }
                }
                .padding(.bottom, AthlyTheme.Spacing.sm)
            }
            .scrollContentBackground(.hidden)

            footer
        }
    }

    // MARK: - Hero

    private var successHero: some View {
        VStack(spacing: 0) {
            ZStack {
                Circle()
                    .fill(AthlyTheme.Color.success.opacity(0.10))
                Circle()
                    .stroke(AthlyTheme.Color.success.opacity(0.22), lineWidth: 1)
                Image(systemName: "checkmark")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(AthlyTheme.Color.success)
            }
            .frame(width: 70, height: 70)
            .shadow(color: AthlyTheme.Color.success.opacity(0.3), radius: 14)

            Text("Treino vinculado!")
                .font(AthlyTheme.Typography.heading(19))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .padding(.top, 14)

            if let workout {
                Text("Sua corrida do Apple Saúde foi atribuída ao treino \(workout.title).")
                    .font(AthlyTheme.Typography.body(11))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 250)
                    .padding(.top, 5)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 20)
    }

    // MARK: - Planejado × realizado

    private func comparisonCard(_ workout: WorkoutModel) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(workout.title)
                .font(AthlyTheme.Typography.semibold(13))
                .foregroundStyle(AthlyTheme.Color.textPrimary)

            Text(linkedMeta(workout))
                .font(AthlyTheme.Typography.mono(9))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .padding(.top, 2)

            HStack(alignment: .top, spacing: 8) {
                comparisonColumn(
                    title: "Planejado",
                    isActual: false,
                    rows: plannedRows(workout)
                )
                comparisonColumn(
                    title: "Realizado",
                    isActual: true,
                    rows: actualRows()
                )
            }
            .padding(.top, 12)

            if let verdict = verdictText(workout) {
                HStack(spacing: 6) {
                    Image(systemName: "bell.fill")
                        .font(.system(size: 11))
                    Text(verdict)
                        .font(AthlyTheme.Typography.semibold(10))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .foregroundStyle(AthlyTheme.Color.success)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 11)
                .padding(.vertical, 9)
                .background(AthlyTheme.Color.success.opacity(0.10))
                .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous)
                        .stroke(AthlyTheme.Color.success.opacity(0.22), lineWidth: 1)
                )
                .padding(.top, 12)
            }
        }
        .padding(14)
        .athlyCard()
    }

    private func comparisonColumn(
        title: LocalizedStringKey,
        isActual: Bool,
        rows: [(LocalizedStringKey, String)]
    ) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title)
                .font(AthlyTheme.Typography.semibold(8))
                .textCase(.uppercase)
                .tracking(1)
                .foregroundStyle(isActual ? AthlyTheme.Color.primary : AthlyTheme.Color.textTertiary)
                .padding(.bottom, 8)

            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack(alignment: .firstTextBaseline) {
                    Text(row.0)
                        .font(AthlyTheme.Typography.body(9))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                    Spacer(minLength: 4)
                    Text(row.1)
                        .font(AthlyTheme.Typography.mono(11))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                }
                .padding(.vertical, 3)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(isActual ? AthlyTheme.Color.primarySoft : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous)
                .stroke(
                    isActual ? AthlyTheme.Color.primaryBorder : AthlyTheme.Color.borderDark,
                    lineWidth: 1
                )
        )
    }

    private func plannedRows(_ workout: WorkoutModel) -> [(LocalizedStringKey, String)] {
        var rows: [(LocalizedStringKey, String)] = []
        if let km = workout.totalDistanceKm {
            rows.append(("Distância", "\(LocalizedFormatting.formattedDistanceKm(km)) km"))
        }
        if let minutes = workout.totalDurationMinutes {
            rows.append(("Duração", formattedPlannedDuration(minutes: minutes)))
        }
        if rows.isEmpty {
            rows.append(("Prescrição", String(localized: "livre")))
        }
        return rows
    }

    /// Duração planejada no mesmo formato do realizado: "50:00", ou "1:05:00" acima de uma hora.
    private func formattedPlannedDuration(minutes: Int) -> String {
        if minutes >= 60 {
            return String(format: "%d:%02d:00", minutes / 60, minutes % 60)
        }
        return String(format: "%02d:00", minutes)
    }

    private func actualRows() -> [(LocalizedStringKey, String)] {
        [
            ("Distância", "\(run.formattedDistance) km"),
            ("Pace real", run.formattedPace),
            ("Duração", run.formattedDuration)
        ]
    }

    /// Só afirma "meta cumprida" quando há distância planejada para comparar.
    private func verdictText(_ workout: WorkoutModel) -> String? {
        guard let plannedKm = workout.totalDistanceKm, plannedKm > 0 else { return nil }
        let actualKm = run.distanceKm
        let delta = (actualKm - plannedKm) / plannedKm * 100
        let rounded = abs(delta).rounded()
        if delta >= -5 {
            if rounded < 1 {
                return String(localized: "Meta cumprida — distância planejada atingida.")
            }
            return delta >= 0
                ? String(localized: "Meta cumprida — \(Int(rounded))% acima da distância planejada.")
                : String(localized: "Meta cumprida — \(Int(rounded))% abaixo da distância planejada.")
        }
        return String(localized: "\(Int(rounded))% abaixo da distância planejada.")
    }

    private func linkedMeta(_ workout: WorkoutModel) -> String {
        let df = DateFormatter()
        df.locale = .current
        df.setLocalizedDateFormatFromTemplate("EEEEdMMM")
        return "\(df.string(from: workout.parsedDate).capitalized) · \(String(localized: "vinculado ao plano"))"
    }

    // MARK: - Footer

    private var footer: some View {
        VStack(spacing: 11) {
            Button("Ver treino no plano") { onOpenPlan() }
                .buttonStyle(AthlyGradientButtonStyle())

            Button {
                onDismiss()
            } label: {
                Text("Voltar ao início")
                    .font(AthlyTheme.Typography.semibold(11))
                    .underline()
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, AthlyTheme.Spacing.sm)
        .padding(.top, 14)
        .padding(.bottom, 14)
    }
}
