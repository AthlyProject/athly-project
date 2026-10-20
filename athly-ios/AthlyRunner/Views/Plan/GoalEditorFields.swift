import SwiftUI

// Perguntas de meta do onboarding (distância, tipo/tempo alvo e data da prova), compartilhadas
// pelo `AssessmentView` e pela troca de meta no meio do ciclo (`GoalEditView`).

/// Grade de distâncias. A chave (`5k`, `half`...) é o contrato do backend.
struct GoalDistanceGrid: View {
    @Binding var selection: String

    struct Item {
        let icon: String; let label: String; let description: String; let value: String
    }

    nonisolated static let items: [Item] = [
        .init(icon: "flag",       label: "5K",       description: String(localized: "5 quilômetros"),  value: "5k"),
        .init(icon: "figure.run", label: "10K",      description: String(localized: "10 quilômetros"), value: "10k"),
        .init(icon: "medal",      label: "15K",      description: String(localized: "15 quilômetros"), value: "15k"),
        .init(icon: "rosette",    label: String(localized: "Meia"),     description: String(localized: "21 quilômetros"), value: "half"),
        .init(icon: "trophy",     label: String(localized: "Maratona"), description: String(localized: "42 quilômetros"), value: "42k"),
        .init(icon: "bolt.fill",  label: String(localized: "Ultra"),    description: String(localized: "Mais de 42 km"),  value: "ultra"),
    ]

    var body: some View {
        LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 2),
            spacing: 10
        ) {
            ForEach(Self.items, id: \.value) { item in
                let sel = selection == item.value
                Button { selection = item.value } label: {
                    VStack(spacing: 6) {
                        Image(systemName: item.icon)
                            .font(.system(size: 24, weight: .regular))
                            .foregroundStyle(sel ? AthlyTheme.Color.primary : AthlyTheme.Color.textSecondary)
                            .frame(height: 30)
                        Text(item.label)
                            .font(AthlyTheme.Typography.semibold(16))
                            .foregroundStyle(sel ? AthlyTheme.Color.primary : AthlyTheme.Color.textPrimary)
                        Text(item.description)
                            .font(AthlyTheme.Typography.body(10))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 18)
                    .background(sel ? AthlyTheme.Color.primarySoft : AthlyTheme.Color.surfaceCard)
                    .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                            .stroke(sel ? AthlyTheme.Color.primaryBorder : AthlyTheme.Color.borderMid, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// Tipo de meta (completar ou tempo alvo), com o campo do tempo quando é tempo alvo.
struct GoalTypeSelector: View {
    @Binding var objectiveType: String
    @Binding var targetTimeText: String

    struct Item {
        let icon: String; let iconColor: Color; let title: String; let description: String; let value: String; let iconBg: Color
    }

    static let items: [Item] = [
        .init(icon: "cpu", iconColor: Color(hex: "#7C3AED"),
              title: String(localized: "Workload adaptado pela IA"),
              description: String(localized: "A IA define a carga com base na sua evolução"),
              value: "workload", iconBg: Color(hex: "#7C3AED").opacity(0.10)),
        .init(icon: "stopwatch", iconColor: Color(hex: "#F59E0B"),
              title: String(localized: "Tempo alvo"),
              description: String(localized: "Defina um tempo e a IA cria um plano para você bater"),
              value: "target_time", iconBg: Color(hex: "#F59E0B").opacity(0.10)),
    ]

    var body: some View {
        VStack(spacing: 8) {
            ForEach(Self.items, id: \.value) { item in
                let isSel = objectiveType == item.value
                VStack(spacing: 0) {
                    Button { withAnimation(.easeOut(duration: 0.2)) { objectiveType = item.value } } label: {
                        HStack(spacing: 12) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .fill(item.iconBg)
                                    .frame(width: 44, height: 44)
                                Image(systemName: item.icon)
                                    .font(.system(size: 19, weight: .semibold))
                                    .foregroundStyle(item.iconColor)
                            }
                            VStack(alignment: .leading, spacing: 3) {
                                Text(item.title)
                                    .font(AthlyTheme.Typography.semibold(13))
                                    .foregroundStyle(isSel ? AthlyTheme.Color.primary : AthlyTheme.Color.textPrimary)
                                Text(item.description)
                                    .font(AthlyTheme.Typography.body(10))
                                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            ZStack {
                                Circle()
                                    .stroke(isSel ? AthlyTheme.Color.primary : AthlyTheme.Color.borderMid, lineWidth: 2)
                                    .frame(width: 20, height: 20)
                                if isSel { Circle().fill(AthlyTheme.Color.primary).frame(width: 20, height: 20) }
                            }
                        }
                        .padding(14)
                    }
                    .buttonStyle(.plain)

                    if isSel && item.value == "target_time" {
                        Rectangle()
                            .fill(AthlyTheme.Color.borderDark)
                            .frame(height: 1)
                            .padding(.horizontal, 14)

                        HStack(spacing: 8) {
                            Text("Meta")
                                .font(AthlyTheme.Typography.body(11))
                                .foregroundStyle(AthlyTheme.Color.textTertiary)
                            TextField("47:30", text: $targetTimeText)
                                .keyboardType(.numbersAndPunctuation)
                                .font(AthlyTheme.Typography.mono(20))
                                .foregroundStyle(AthlyTheme.Color.primary)
                                .frame(maxWidth: .infinity)
                            Text("min:seg")
                                .font(AthlyTheme.Typography.body(11))
                                .foregroundStyle(AthlyTheme.Color.textTertiary)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                    }
                }
                .background(isSel ? AthlyTheme.Color.primarySoft : AthlyTheme.Color.surfaceCard)
                .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                        .stroke(isSel ? AthlyTheme.Color.primaryBorder : AthlyTheme.Color.borderMid, lineWidth: 1)
                )
            }
        }
    }
}

/// Data da prova (opcional): com ela, o backend monta o ciclo até a prova e avalia a meta.
struct GoalEventDateCard: View {
    @Binding var hasEventDate: Bool
    @Binding var eventDate: Date

    // Prova a partir de amanhã e até 3 anos — o backend rejeita fora disso.
    nonisolated static var range: ClosedRange<Date> {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: today) ?? today
        let latest = calendar.date(byAdding: .year, value: 3, to: today) ?? tomorrow
        return tomorrow...latest
    }

    var body: some View {
        VStack(spacing: 0) {
            Toggle(isOn: $hasEventDate.animation(.easeOut(duration: 0.2))) {
                HStack(spacing: 12) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(Color(hex: "#0EA5E9").opacity(0.10))
                            .frame(width: 44, height: 44)
                        Image(systemName: "calendar")
                            .font(.system(size: 19, weight: .semibold))
                            .foregroundStyle(Color(hex: "#0EA5E9"))
                    }
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Tenho data de prova")
                            .font(AthlyTheme.Typography.semibold(13))
                            .foregroundStyle(hasEventDate ? AthlyTheme.Color.primary : AthlyTheme.Color.textPrimary)
                        Text("A IA monta o ciclo até a prova e avalia se a meta é viável")
                            .font(AthlyTheme.Typography.body(10))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .tint(AthlyTheme.Color.primary)
            .padding(14)

            if hasEventDate {
                Rectangle()
                    .fill(AthlyTheme.Color.borderDark)
                    .frame(height: 1)
                    .padding(.horizontal, 14)

                DatePicker(selection: $eventDate, in: Self.range, displayedComponents: .date) {
                    Text("Data da prova")
                        .font(AthlyTheme.Typography.body(11))
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                }
                .datePickerStyle(.compact)
                .tint(AthlyTheme.Color.primary)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
            }
        }
        .background(hasEventDate ? AthlyTheme.Color.primarySoft : AthlyTheme.Color.surfaceCard)
        .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                .stroke(hasEventDate ? AthlyTheme.Color.primaryBorder : AthlyTheme.Color.borderMid, lineWidth: 1)
        )
    }
}

/// Estado do formulário de meta da troca no meio do ciclo, pré-preenchido com a meta ativa.
struct GoalFormState: Equatable {
    var objectiveDistance = ""
    var objectiveType = ""
    var targetTimeText = ""
    var hasEventDate = false
    var eventDate = Calendar.current.date(byAdding: .weekOfYear, value: 12, to: Date()) ?? Date()

    init() {}

    init(parsedGoal: ParsedGoal?) {
        guard let goal = parsedGoal, let distance = goal.targetDistance else { return }
        objectiveDistance = distance
        objectiveType = goal.targetTime == nil ? "workload" : "target_time"
        targetTimeText = goal.targetTime ?? ""
        if let iso = goal.eventDate, let date = GoalFormatting.date(fromCivil: iso), date >= GoalEventDateCard.range.lowerBound {
            hasEventDate = true
            eventDate = date
        }
    }

    /// Mesmas regras do backend: distância e tipo escolhidos, tempo h:mm:ss ou mm:ss.
    var validationMessage: String? {
        if objectiveDistance.isEmpty { return String(localized: "Escolha a distância.") }
        if objectiveType.isEmpty { return String(localized: "Escolha o tipo de meta.") }
        if objectiveType == "target_time",
           targetTimeText.range(of: #"^\d{1,2}:\d{2}(:\d{2})?$"#, options: .regularExpression) == nil {
            return String(localized: "Informe o tempo alvo como h:mm:ss ou mm:ss.")
        }
        return nil
    }

    var draft: GoalDraft {
        GoalDraft(
            objectiveDistance: objectiveDistance,
            objectiveType: objectiveType,
            targetTime: objectiveType == "target_time" ? targetTimeText.trimmingCharacters(in: .whitespaces) : nil,
            eventDate: hasEventDate ? GoalFormatting.civilDateString(eventDate) : nil
        )
    }
}

/// Formatos e rótulos da meta compartilhados pelas telas de plano e de análise.
enum GoalFormatting {
    /// Data civil escolhida no fuso do aparelho, no formato do backend (yyyy-MM-dd).
    static func civilDateString(_ date: Date) -> String {
        let parts = Calendar(identifier: .gregorian).dateComponents(in: .current, from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    static func date(fromCivil iso: String) -> Date? {
        let parts = iso.prefix(10).split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return Calendar(identifier: .gregorian).date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }

    static func friendlyDate(_ iso: String?) -> String? {
        guard let iso, let date = date(fromCivil: iso) else { return iso.map { String($0.prefix(10)) } }
        let formatter = DateFormatter()
        formatter.dateFormat = "dd/MM/yyyy"
        return formatter.string(from: date)
    }

    static func time(_ seconds: Double) -> String {
        let total = Int(seconds.rounded())
        let h = total / 3600, m = (total % 3600) / 60, s = total % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s)
    }

    static func distanceLabel(_ key: String?) -> String {
        guard let key else { return String(localized: "Corrida") }
        return GoalDistanceGrid.items.first { $0.value == key }?.label ?? key
    }

    /// Rótulo, cor e ícone do veredito de viabilidade.
    static func verdict(_ verdict: String) -> (label: String, color: Color, icon: String) {
        switch verdict {
        case "ready": return (String(localized: "Pronto"), AthlyTheme.Color.success, "checkmark.seal.fill")
        case "feasible": return (String(localized: "Viável"), AthlyTheme.Color.success, "checkmark.circle.fill")
        case "ambitious": return (String(localized: "Ambicioso"), AthlyTheme.Color.warning, "flame.fill")
        case "unrealistic": return (String(localized: "Inviável no prazo"), AthlyTheme.Color.error, "exclamationmark.triangle.fill")
        default: return (verdict, AthlyTheme.Color.textSecondary, "questionmark.circle")
        }
    }
}
