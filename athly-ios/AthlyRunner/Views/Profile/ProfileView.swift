import SwiftUI

/// Perfil do atleta (design v2): identidade, estatísticas de vida, meta ativa, dias de treino
/// e recordes pessoais. Toda a parametrização do app mora agora em `SettingsView`.
struct ProfileView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @EnvironmentObject var runStore: RunStore
    @EnvironmentObject var planVM: TrainingPlanViewModel

    @State private var userProfile: UserProfile?
    @State private var selectedDays: Set<String> = []
    @State private var savedDays: Set<String> = []
    @State private var isSavingDays = false
    @State private var daysError: String?
    @State private var showDaysSaved = false
    @State private var showEditProfile = false
    @State private var records: [PersonalRecord] = []

    private var allRuns: [RunSession] { runStore.sortedSessions }

    private struct Weekday {
        let key: String
        /// Já localizado ("Seg", "Mon", "Mo"…); a pílula usa só a primeira letra.
        let label: String
        var initial: String { String(label.prefix(1)) }
    }

    private var weekdays: [Weekday] {
        [
            Weekday(key: "sunday",    label: String(localized: "Dom")),
            Weekday(key: "monday",    label: String(localized: "Seg")),
            Weekday(key: "tuesday",   label: String(localized: "Ter")),
            Weekday(key: "wednesday", label: String(localized: "Qua")),
            Weekday(key: "thursday",  label: String(localized: "Qui")),
            Weekday(key: "friday",    label: String(localized: "Sex")),
            Weekday(key: "saturday",  label: String(localized: "Sáb")),
        ]
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AthlyTheme.Color.backgroundDark
                    .ignoresSafeArea()

                RadialGradient(
                    colors: [AthlyTheme.Color.primary.opacity(0.13), .clear],
                    center: .init(x: 0.0, y: 0.0),
                    startRadius: 0, endRadius: 220
                )
                .ignoresSafeArea()

                RadialGradient(
                    colors: [AthlyTheme.Color.secondary.opacity(0.10), .clear],
                    center: .init(x: 1.0, y: 0.0),
                    startRadius: 0, endRadius: 200
                )
                .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 10) {
                        identityHeader

                        totalDistanceCard

                        statsGrid

                        if let goal = goalSnapshot {
                            AthlySectionLabel("Meta ativa")
                            goalCard(goal)
                        }

                        AthlySectionLabel("Dias disponíveis para treinar")
                        trainingDaysSection

                        if !records.isEmpty {
                            AthlySectionLabel("Recordes pessoais")
                            ForEach(records) { record in
                                recordRow(record)
                            }
                        }
                    }
                    .padding(AthlyTheme.Spacing.sm)
                }
                .scrollContentBackground(.hidden)
                .athlyTabBarContentClearance()
            }
            .navigationTitle("Perfil")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    NavigationLink {
                        SettingsView(userProfile: userProfile)
                    } label: {
                        Image(systemName: "gearshape")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                    }
                    .accessibilityLabel(Text("Ajustes"))
                }
            }
            .task {
                await loadProfile()
                await planVM.loadActiveGoalIfNeeded()
            }
            .onAppear { refreshRecords() }
            .onChange(of: runStore.sessions.count) { _ in refreshRecords() }
            .sheet(isPresented: $showEditProfile) {
                EditProfileView(profile: userProfile) { updated in
                    applyProfile(updated)
                }
            }
        }
    }

    // MARK: - Identidade

    private var identityHeader: some View {
        VStack(spacing: 0) {
            Button {
                showEditProfile = true
            } label: {
                ZStack(alignment: .bottomTrailing) {
                    Text(initials)
                        .font(AthlyTheme.Typography.heading(27))
                        .foregroundStyle(.white)
                        .frame(width: 74, height: 74)
                        .background(AthlyTheme.Gradient.brand)
                        .clipShape(Circle())
                        .shadow(color: AthlyTheme.Color.primaryGlow, radius: 16)

                    Image(systemName: "pencil")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(AthlyTheme.Color.primary)
                        .frame(width: 24, height: 24)
                        .background(AthlyTheme.Color.surfaceCardElevated)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(AthlyTheme.Color.backgroundDark, lineWidth: 2))
                        .offset(x: 2, y: 2)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Text("Editar perfil"))

            Text(displayName)
                .font(AthlyTheme.Typography.heading(19))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .padding(.top, 11)

            if let email = userProfile?.email {
                Text(email)
                    .font(AthlyTheme.Typography.mono(11))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                    .padding(.top, 2)
            }

            HStack(spacing: 6) {
                if let level = levelLabel {
                    AthlyChip(
                        text: String(localized: "Nível · \(level)"),
                        tint: AthlyTheme.Color.primary,
                        background: AthlyTheme.Color.primarySoft,
                        border: AthlyTheme.Color.primaryBorder
                    )
                }
                if let goal = goalChipLabel {
                    AthlyChip(
                        text: String(localized: "Meta · \(goal)"),
                        tint: AthlyTheme.Color.secondary,
                        background: AthlyTheme.Color.secondarySoft,
                        border: AthlyTheme.Color.secondaryBorder
                    )
                }
            }
            .padding(.top, 11)
        }
        .frame(maxWidth: .infinity)
        .padding(.bottom, 4)
    }

    // MARK: - Estatísticas

    private var totalDistanceCard: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("Distância total")
                .font(AthlyTheme.Typography.semibold(10))
                .kerning(1.0)
                .textCase(.uppercase)
                .foregroundStyle(AthlyTheme.Color.textTertiary)

            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(LocalizedFormatting.formattedDistanceKm(totalDistance))
                    .font(AthlyTheme.Typography.mono(30))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                Text("km")
                    .font(AthlyTheme.Typography.medium(15))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
            }

            Text(lastFourWeeksSummary)
                .font(AthlyTheme.Typography.body(11))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .athlySurface(border: AthlyTheme.Gradient.brand.opacity(0.5))
    }

    private var statsGrid: some View {
        LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 2),
            spacing: 8
        ) {
            statCell(icon: "figure.run", value: "\(allRuns.count)", caption: String(localized: "Corridas"))
            statCell(icon: "clock", value: formatDuration(totalTime), caption: String(localized: "Tempo total"))
            statCell(icon: "speedometer", value: formatPace(averagePace), caption: String(localized: "Pace médio /km"))
            statCell(icon: "mountain.2", value: formatElevation(totalElevation), caption: String(localized: "Elevação total"))
        }
    }

    private func statCell(icon: String, value: String, caption: String) -> some View {
        HStack(spacing: 9) {
            AthlyIconTile(systemImage: icon)
            VStack(alignment: .leading, spacing: 2) {
                Text(value)
                    .font(AthlyTheme.Typography.mono(14))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(caption)
                    .font(AthlyTheme.Typography.body(9))
                    .foregroundStyle(AthlyTheme.Color.textTertiary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 10)
        .athlySurface(cornerRadius: AthlyTheme.Radius.small)
    }

    // MARK: - Meta ativa

    private struct GoalSnapshot {
        let title: String
        let subtitle: String
        let badge: (label: String, color: Color)?
        let weekText: String?
        let progress: Double?
    }

    private var goalSnapshot: GoalSnapshot? {
        let parsed = planVM.activeGoal?.parsedGoal
        let plan = planVM.trainingPlanResponse
        guard parsed != nil || plan != nil else { return nil }

        let title: String
        if let parsed {
            if let distance = parsed.targetDistance?.uppercased(), let time = parsed.targetTime, !time.isEmpty {
                title = "\(distance) · \(time)"
            } else if let event = parsed.eventName, !event.isEmpty {
                title = event
            } else if let distance = parsed.targetDistance?.uppercased(), !distance.isEmpty {
                title = distance
            } else {
                title = parsed.summary
            }
        } else {
            title = objectiveLabel(plan?.objective)
        }

        let weeks = planWeekProgress
        var subtitleParts: [String] = [objectiveLabel(plan?.objective)]
        if let weeks {
            subtitleParts.append(String(localized: "\(weeks.total) semanas"))
        }

        var badge: (String, Color)?
        if let verdict = planVM.activeGoal?.feasibility?.verdict {
            badge = Self.verdictInfo(verdict)
        }

        return GoalSnapshot(
            title: title,
            subtitle: subtitleParts.joined(separator: " · "),
            badge: badge,
            weekText: weeks.map { String(localized: "Semana \($0.current)/\($0.total)") },
            progress: weeks.map { Double($0.current) / Double(max($0.total, 1)) }
        )
    }

    private func goalCard(_ goal: GoalSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 8) {
                AthlyIconTile(systemImage: "target", tint: AthlyTheme.Color.secondary, size: 30)

                VStack(alignment: .leading, spacing: 1) {
                    Text(goal.title)
                        .font(AthlyTheme.Typography.semibold(13))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                    Text(goal.subtitle)
                        .font(AthlyTheme.Typography.body(9))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }

                Spacer(minLength: 4)

                if let badge = goal.badge {
                    Text(badge.label)
                        .font(AthlyTheme.Typography.semibold(9))
                        .foregroundStyle(badge.color)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(badge.color.opacity(0.12))
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(badge.color.opacity(0.25), lineWidth: 1))
                }
            }

            if let progress = goal.progress {
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(AthlyTheme.Color.backgroundAlt)
                        Capsule()
                            .fill(AthlyTheme.Gradient.brand)
                            .frame(width: max(0, min(1, progress)) * proxy.size.width)
                    }
                }
                .frame(height: 6)

                HStack {
                    if let weekText = goal.weekText {
                        Text(weekText)
                            .font(AthlyTheme.Typography.mono(9))
                            .foregroundStyle(AthlyTheme.Color.textTertiary)
                    }
                    Spacer()
                    Text(verbatim: "\(Int((progress * 100).rounded()))%")
                        .font(AthlyTheme.Typography.mono(9))
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .athlySurface()
    }

    // MARK: - Dias de treino

    private var trainingDaysSection: some View {
        VStack(spacing: 8) {
            HStack(spacing: 5) {
                ForEach(weekdays, id: \.key) { day in
                    dayToggleButton(day)
                }
            }

            HStack {
                Text(String(localized: "\(selectedDays.count) dia selecionado"))
                    .font(AthlyTheme.Typography.body(11))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)

                Spacer()

                if hasUnsavedDays {
                    Button {
                        Task { await saveDays() }
                    } label: {
                        if isSavingDays {
                            ProgressView()
                                .tint(AthlyTheme.Color.primary)
                                .scaleEffect(0.7)
                        } else {
                            Text("Salvar")
                                .font(AthlyTheme.Typography.semibold(12))
                                .foregroundStyle(AthlyTheme.Color.primary)
                        }
                    }
                    .disabled(isSavingDays)
                } else if showDaysSaved {
                    Label {
                        Text("Dias de treino salvos!")
                            .font(AthlyTheme.Typography.body(11))
                    } icon: {
                        Image(systemName: "checkmark.circle.fill")
                    }
                    .foregroundStyle(AthlyTheme.Color.success)
                    .transition(.opacity)
                } else {
                    Text(selectedDaysSummary)
                        .font(AthlyTheme.Typography.mono(10))
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                }
            }

            if let daysError {
                Text(daysError)
                    .font(AthlyTheme.Typography.body(11))
                    .foregroundStyle(AthlyTheme.Color.error)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func dayToggleButton(_ day: Weekday) -> some View {
        let isSelected = selectedDays.contains(day.key)
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) {
                if isSelected {
                    selectedDays.remove(day.key)
                } else {
                    selectedDays.insert(day.key)
                }
            }
            daysError = nil
            showDaysSaved = false
        } label: {
            Text(day.initial)
                .font(AthlyTheme.Typography.semibold(13))
                .foregroundStyle(isSelected ? .white : AthlyTheme.Color.textTertiary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 9)
                .background(
                    Group {
                        if isSelected {
                            AthlyTheme.Gradient.brand
                        } else {
                            AthlyTheme.Color.backgroundAlt
                        }
                    }
                )
                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                        .stroke(isSelected ? Color.clear : AthlyTheme.Color.borderMid, lineWidth: 1)
                )
                .shadow(color: isSelected ? AthlyTheme.Color.primary.opacity(0.35) : .clear, radius: 6, y: 2)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(day.label))
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    // MARK: - Recordes

    private func recordRow(_ record: PersonalRecord) -> some View {
        HStack(spacing: 10) {
            AthlyIconTile(systemImage: "trophy", tint: Self.recordTint(record.id), size: 26)

            VStack(alignment: .leading, spacing: 1) {
                Text(record.label)
                    .font(AthlyTheme.Typography.semibold(11))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                Text(record.date.formatted(Date.FormatStyle().day().month(.abbreviated).year()).uppercased())
                    .font(AthlyTheme.Typography.mono(8))
                    .foregroundStyle(AthlyTheme.Color.textTertiary)
            }

            Spacer(minLength: 0)

            Text(record.isEstimated ? "≈ " + record.formattedTime : record.formattedTime)
                .font(AthlyTheme.Typography.mono(13))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .accessibilityLabel(
                    record.isEstimated
                        ? Text("Tempo estimado: \(record.formattedTime)")
                        : Text(record.formattedTime)
                )
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 9)
        .athlySurface(cornerRadius: AthlyTheme.Radius.small)
    }

    // MARK: - Ações

    private func loadProfile() async {
        do {
            applyProfile(try await APIClient.shared.getUserProfile())
        } catch {
            // Silencioso: as estatísticas continuam saindo do RunStore local.
        }
    }

    private func applyProfile(_ profile: UserProfile) {
        userProfile = profile
        let days = Set(profile.availableDays ?? [])
        selectedDays = days
        savedDays = days
        if let weight = profile.weight {
            UserMetrics.weightKg = weight
        }
    }

    private func saveDays() async {
        isSavingDays = true
        daysError = nil
        showDaysSaved = false

        do {
            let request = UpdateProfileRequest(availableDays: Array(selectedDays))
            let updated = try await APIClient.shared.updateProfile(request)
            applyProfile(updated)
            withAnimation { showDaysSaved = true }
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            withAnimation { showDaysSaved = false }
        } catch {
            daysError = error.localizedDescription
        }

        isSavingDays = false
    }

    private func refreshRecords() {
        records = PersonalRecordCalculator.records(from: allRuns)
    }

    // MARK: - Derivados

    private var hasUnsavedDays: Bool { selectedDays != savedDays }

    private var displayName: String {
        let name = userProfile?.name ?? authViewModel.userName
        return name.isEmpty ? String(localized: "Atleta") : name
    }

    private var initials: String {
        let letters = displayName
            .split(separator: " ")
            .prefix(2)
            .compactMap { $0.first }
            .map(String.init)
            .joined()
            .uppercased()
        return letters.isEmpty ? "A" : letters
    }

    private var levelLabel: String? {
        guard let raw = userProfile?.fitnessLevel else { return nil }
        switch raw {
        case "beginning":    return String(localized: "Começando")
        case "beginner":     return String(localized: "Iniciante")
        case "hobby":        return String(localized: "Hobby")
        case "intermediate": return String(localized: "Intermediário")
        case "advanced":     return String(localized: "Avançado")
        case "pro":          return String(localized: "Pro")
        default:             return nil
        }
    }

    private var goalChipLabel: String? {
        if let distance = planVM.activeGoal?.parsedGoal.targetDistance, !distance.isEmpty {
            return distance.uppercased()
        }
        if let event = planVM.activeGoal?.parsedGoal.eventName, !event.isEmpty {
            return event
        }
        return nil
    }

    private var selectedDaysSummary: String {
        let labels = weekdays.filter { selectedDays.contains($0.key) }.map(\.label)
        return labels.joined(separator: " · ")
    }

    private var planWeekProgress: (current: Int, total: Int)? {
        let weeks = planVM.weeks
        guard !weeks.isEmpty else { return nil }

        let today = Date()
        var current = weeks.count
        for (index, week) in weeks.enumerated() {
            guard let goal = week.weeklyGoal else { continue }
            if today >= goal.parsedStartDate && today <= goal.parsedEndDate {
                current = index + 1
                break
            }
        }

        var total = weeks.count
        if let plan = planVM.trainingPlanResponse,
           let start = Self.parseDate(plan.startDate),
           let target = Self.parseDate(plan.targetDate) {
            let weeksToTarget = Int((target.timeIntervalSince(start) / (7 * 24 * 3600)).rounded(.up))
            total = max(total, weeksToTarget)
        }

        return (min(current, total), max(total, 1))
    }

    private var totalDistance: Double {
        allRuns.reduce(0) { $0 + $1.distanceKm }
    }

    private var totalTime: Double {
        allRuns.reduce(0) { $0 + $1.durationSeconds }
    }

    private var totalElevation: Double {
        allRuns.reduce(0) { $0 + $1.elevationGainMeters }
    }

    private var averagePace: Double {
        guard totalDistance > 0 else { return 0 }
        return totalTime / totalDistance
    }

    private var lastFourWeeksSummary: String {
        let cutoff = Calendar.current.date(byAdding: .day, value: -28, to: Date()) ?? Date()
        let distance = allRuns.filter { $0.startDate >= cutoff }.reduce(0) { $0 + $1.distanceKm }
        guard distance > 0 else {
            return String(localized: "Nenhuma corrida nas últimas 4 semanas")
        }
        let formatted = LocalizedFormatting.formattedDistanceKm(distance)
        return String(localized: "↑ \(formatted) km nas últimas 4 semanas")
    }

    // MARK: - Formatação

    private func objectiveLabel(_ objective: String?) -> String {
        switch objective {
        case "personal": return String(localized: "Objetivo pessoal")
        case "fitness":  return String(localized: "Melhorar fitness")
        case let other?: return other
        case nil:        return String(localized: "Plano de treino")
        }
    }

    private static func recordTint(_ recordId: String) -> Color {
        switch recordId {
        case "5k":  return AthlyTheme.Color.success
        case "10k": return AthlyTheme.Color.primary
        case "21k": return AthlyTheme.Color.secondary
        default:    return AthlyTheme.Color.warning
        }
    }

    private static func verdictInfo(_ verdict: String) -> (String, Color)? {
        switch verdict {
        case "ready":       return (String(localized: "Pronto"), AthlyTheme.Color.success)
        case "feasible":    return (String(localized: "Viável"), AthlyTheme.Color.success)
        case "ambitious":   return (String(localized: "Ambicioso"), AthlyTheme.Color.warning)
        case "unrealistic": return (String(localized: "Inviável no prazo"), AthlyTheme.Color.error)
        default:            return nil
        }
    }

    private static func parseDate(_ raw: String?) -> Date? {
        guard let raw else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: String(raw.prefix(10)))
    }

    private func formatDuration(_ seconds: Double) -> String {
        let h = Int(seconds) / 3600
        let m = (Int(seconds) % 3600) / 60
        if h > 0 { return String(format: "%dh %02d", h, m) }
        return String(format: "%dmin", m)
    }

    private func formatPace(_ pace: Double) -> String {
        guard pace > 0, pace.isFinite else { return "--:--" }
        return String(format: "%d:%02d", Int(pace) / 60, Int(pace) % 60)
    }

    private func formatElevation(_ meters: Double) -> String {
        let formatter = NumberFormatter()
        formatter.locale = .current
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 0
        let value = formatter.string(from: NSNumber(value: meters)) ?? String(format: "%.0f", meters)
        return value + " m"
    }
}
