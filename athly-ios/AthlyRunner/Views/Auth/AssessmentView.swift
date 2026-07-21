import SwiftUI

struct AssessmentView: View {
    let onCompleted: () -> Void

    // MARK: - Navigation state
    @State private var step = 0
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    // MARK: - P1: Informações Importantes
    @State private var gender = ""
    @State private var weightText = ""
    @State private var heightText = ""
    @State private var restingHRText = ""
    @State private var maxHRText = ""

    // MARK: - P2: Motivação
    @State private var motivations: [String] = []

    // MARK: - P3: Frequência
    @State private var runningFrequency = ""

    // MARK: - P4: Nível
    @State private var fitnessLevel = ""

    // MARK: - P5: Pace (seconds/km)
    @State private var paceSeconds = 345  // default 5:45/km

    // MARK: - P6: Objetivos
    @State private var expandedObjective: String? = nil
    @State private var objective = ""
    @State private var objectiveDistance = ""
    @State private var objectiveType = ""
    @State private var targetTimeText = ""

    private let totalSteps = 6
    private var isLastStep: Bool { step == totalSteps - 1 }

    private let screenMeta: [(title: String, subtitle: String)] = [
        ("Informações\nImportantes",    "Usamos esses dados para personalizar seu treino com IA"),
        ("Motivação\npara Correr",      "Escolha todas que fazem sentido pra você"),
        ("Quanto\nvocê corre?",         "Com que frequência você vai para a rua correr?"),
        ("Seu nível\nno momento",       "Seja honesto — vamos ajustar seus treinos"),
        ("Seu pace\nconfortável",       "Ritmo em que você corre sentindo-se bem — sem forçar"),
        ("Seus\nObjetivos",             "O que você quer alcançar correndo?"),
    ]

    // MARK: - Body

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark.ignoresSafeArea()
            VStack(spacing: 0) {
                topBar
                progressBar
                screenHead
                    .padding(.horizontal, 16)
                    .padding(.top, 18)
                    .padding(.bottom, 10)
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        stepContent
                            .padding(.horizontal, 16)
                            .padding(.bottom, 24)
                        if let errorMessage {
                            Text(errorMessage)
                                .font(AthlyTheme.Typography.body(13))
                                .foregroundStyle(AthlyTheme.Color.error)
                                .frame(maxWidth: .infinity)
                                .padding(12)
                                .background(AthlyTheme.Color.error.opacity(0.10))
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                .padding(.horizontal, 16)
                                .padding(.bottom, 8)
                        }
                    }
                }
                .scrollDismissesKeyboard(.interactively)
                footer
            }
        }
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack {
            Button {
                withAnimation(.easeOut(duration: 0.2)) { step -= 1 }
            } label: {
                Text("‹")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                    .frame(width: 30, height: 30)
                    .background(AthlyTheme.Color.surfaceCard)
                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
            }
            .buttonStyle(.plain)
            .opacity(step == 0 ? 0 : 1)
            .disabled(step == 0)

            Spacer()

            Text("\(step + 1) de \(totalSteps)")
                .font(AthlyTheme.Typography.semibold(11))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
                .kerning(0.5)

            Spacer()

            if isLastStep {
                Text("Final")
                    .font(AthlyTheme.Typography.semibold(12))
                    .foregroundStyle(AthlyTheme.Color.textTertiary)
            } else {
                Button("Pular") {
                    withAnimation(.easeOut(duration: 0.2)) { step += 1 }
                }
                .font(AthlyTheme.Typography.semibold(12))
                .foregroundStyle(AthlyTheme.Color.primary)
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    // MARK: - Progress segments

    private var progressBar: some View {
        HStack(spacing: 4) {
            ForEach(0..<totalSteps, id: \.self) { i in
                Capsule()
                    .fill(
                        i < step  ? AthlyTheme.Color.primary.opacity(0.45) :
                        i == step ? AthlyTheme.Color.primary :
                                    AthlyTheme.Color.borderMid
                    )
                    .frame(height: 3)
                    .animation(.easeOut(duration: 0.25), value: step)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
    }

    // MARK: - Screen head

    private var screenHead: some View {
        let meta = screenMeta[step]
        return VStack(alignment: .leading, spacing: 4) {
            Text(meta.title)
                .font(AthlyTheme.Typography.heading(19))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Text(meta.subtitle)
                .font(AthlyTheme.Typography.body(12))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Step router

    @ViewBuilder
    private var stepContent: some View {
        switch step {
        case 0: step1
        case 1: step2
        case 2: step3
        case 3: step4
        case 4: step5
        default: step6
        }
    }

    // MARK: - Footer

    private var footer: some View {
        Button {
            if isLastStep { Task { await submit() } }
            else { withAnimation(.easeOut(duration: 0.2)) { step += 1 } }
        } label: {
            HStack(spacing: 8) {
                if isSubmitting { ProgressView().tint(.white).scaleEffect(0.85) }
                Text(isLastStep
                     ? (isSubmitting ? "Enviando..." : "Começar com a Athly ✦")
                     : "Continuar →")
                    .font(AthlyTheme.Typography.semibold(14))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 46)
            .background(AthlyTheme.Gradient.brand)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(isSubmitting)
        .padding(.horizontal, 16)
        .padding(.bottom, 16)
        .padding(.top, 10)
    }

    // MARK: - Submit

    @MainActor
    private func submit() async {
        isSubmitting = true
        errorMessage = nil

        let request = AssessmentSubmissionRequest(
            gender: gender.isEmpty ? nil : gender,
            weight: Double(weightText),
            height: Double(heightText),
            restingHeartRate: Int(restingHRText),
            maxHeartRate: Int(maxHRText),
            motivations: motivations,
            runningFrequency: runningFrequency.isEmpty ? nil : runningFrequency,
            fitnessLevel: fitnessLevel.isEmpty ? nil : fitnessLevel,
            comfortPaceSeconds: paceSeconds,
            objective: objective.isEmpty ? nil : objective,
            objectiveDistance: objectiveDistance.isEmpty ? nil : objectiveDistance,
            objectiveType: objectiveType.isEmpty ? nil : objectiveType,
            targetTime: targetTimeText.isEmpty ? nil : targetTimeText,
            termsAccepted: true
        )

        do {
            try await APIClient.shared.submitAssessment(request)
            onCompleted()
        } catch {
            errorMessage = "Não foi possível enviar o questionário. Tente novamente."
        }
        isSubmitting = false
    }
}

// MARK: - Shared building blocks

private extension AssessmentView {
    func obSectionLabel(_ text: String, optional: Bool = false) -> some View {
        HStack(spacing: 4) {
            Text(text.uppercased())
                .font(AthlyTheme.Typography.label())
                .foregroundStyle(AthlyTheme.Color.textTertiary)
                .kerning(1.2)
            if optional {
                Text("(opcional)")
                    .font(AthlyTheme.Typography.body(8))
                    .foregroundStyle(AthlyTheme.Color.textTertiary.opacity(0.7))
            }
        }
    }

    var obDivider: some View {
        Rectangle()
            .fill(AthlyTheme.Color.borderDark)
            .frame(height: 1)
            .padding(.vertical, 10)
    }

    func obInfoNotice(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 6) {
            Text("ℹ")
                .font(.system(size: 11))
                .foregroundStyle(AthlyTheme.Color.primary)
                .padding(.top, 1)
            Text(text)
                .font(AthlyTheme.Typography.body(10))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
                .fixedSize(horizontal: false, vertical: true)
                .lineSpacing(2)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(AthlyTheme.Color.surfaceDark)
        .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous)
                .stroke(AthlyTheme.Color.borderDark, lineWidth: 1)
        )
    }
}

// MARK: - P1: Informações Importantes

private extension AssessmentView {
    var step1: some View {
        VStack(alignment: .leading, spacing: 0) {
            obSectionLabel("Gênero").padding(.bottom, 8)
            genderRow.padding(.bottom, 10)
            obDivider

            obSectionLabel("Corpo", optional: true).padding(.bottom, 8)
            HStack(spacing: 8) {
                p1NumericField(label: "Peso", unit: "kg", text: $weightText)
                p1NumericField(label: "Altura", unit: "cm", text: $heightText)
            }
            .padding(.bottom, 10)
            obDivider

            obSectionLabel("Frequência Cardíaca").padding(.bottom, 8)
            HStack(spacing: 8) {
                p1NumericField(label: "FC em Repouso", unit: "bpm", text: $restingHRText)
                p1NumericField(label: "FC Máxima", unit: "bpm", text: $maxHRText, accent: true)
            }
            .padding(.bottom, 8)

            obInfoNotice("FC máxima estimada: 220 − sua idade. Ajuste se fizer testes de esforço específicos.")
        }
    }

    var genderRow: some View {
        HStack(spacing: 8) {
            genderPill("♂ Masculino", value: "male")
            genderPill("♀ Feminino",  value: "female")
            genderPill("⊕ Outro",     value: "other")
        }
    }

    func genderPill(_ label: String, value: String) -> some View {
        let sel = gender == value
        return Button { gender = value } label: {
            Text(label)
                .font(AthlyTheme.Typography.semibold(13))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .foregroundStyle(sel ? AthlyTheme.Color.primary : AthlyTheme.Color.textSecondary)
                .frame(maxWidth: .infinity)
                .frame(height: 42)
                .background(sel ? AthlyTheme.Color.primarySoft : AthlyTheme.Color.surfaceCard)
                .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                        .stroke(sel ? AthlyTheme.Color.primaryBorder : AthlyTheme.Color.borderMid, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    func p1NumericField(label: String, unit: String, text: Binding<String>, accent: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(AthlyTheme.Typography.label())
                .foregroundStyle(AthlyTheme.Color.textTertiary)
                .kerning(1)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                TextField("—", text: text)
                    .keyboardType(.decimalPad)
                    .font(AthlyTheme.Typography.mono(15))
                    .foregroundStyle(accent ? AthlyTheme.Color.error : AthlyTheme.Color.textPrimary)
                Text(unit)
                    .font(AthlyTheme.Typography.body(10))
                    .foregroundStyle(AthlyTheme.Color.textTertiary)
            }
        }
        .padding(.vertical, 9)
        .padding(.horizontal, 12)
        .background(AthlyTheme.Color.surfaceCard)
        .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                .stroke(accent ? AthlyTheme.Color.primaryBorder : AthlyTheme.Color.borderMid, lineWidth: 1)
        )
        .frame(maxWidth: .infinity)
    }
}

// MARK: - P2: Motivação para Correr

private extension AssessmentView {
    struct MotivationItem {
        let emoji: String; let title: String; let value: String
    }

    static let motivationItems: [MotivationItem] = [
        .init(emoji: "🔥", title: "Queimar gordura",            value: "fat_burning"),
        .init(emoji: "😊", title: "Sentir-me bem",              value: "feel_good"),
        .init(emoji: "🚶", title: "Voltar a me movimentar",     value: "get_active"),
        .init(emoji: "🧘", title: "Reduzir o stress",           value: "reduce_stress"),
        .init(emoji: "📊", title: "Otimizar meus treinos",      value: "optimize"),
        .init(emoji: "⚡", title: "Melhores tempos",            value: "better_times"),
    ]

    var step2: some View {
        VStack(spacing: 7) {
            ForEach(Self.motivationItems, id: \.value) { item in
                let sel = motivations.contains(item.value)
                Button {
                    if sel { motivations.removeAll { $0 == item.value } }
                    else { motivations.append(item.value) }
                } label: {
                    HStack(spacing: 10) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 9, style: .continuous)
                                .fill(sel ? AthlyTheme.Color.primarySoft : AthlyTheme.Color.surfaceDark)
                                .frame(width: 32, height: 32)
                            Text(item.emoji).font(.system(size: 16))
                        }
                        Text(item.title)
                            .font(AthlyTheme.Typography.semibold(13))
                            .foregroundStyle(sel ? AthlyTheme.Color.primary : AthlyTheme.Color.textSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        ZStack {
                            Circle()
                                .stroke(sel ? AthlyTheme.Color.primary : AthlyTheme.Color.borderMid, lineWidth: 2)
                                .frame(width: 18, height: 18)
                            if sel {
                                Circle().fill(AthlyTheme.Color.primary).frame(width: 18, height: 18)
                                Text("✓").font(.system(size: 9, weight: .bold)).foregroundStyle(.white)
                            }
                        }
                    }
                    .padding(.vertical, 10)
                    .padding(.horizontal, 12)
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

// MARK: - P3: Frequência

private extension AssessmentView {
    struct FrequencyItem {
        let emoji: String; let title: String; let desc: String; let value: String
    }

    static let frequencyItems: [FrequencyItem] = [
        .init(emoji: "🛋️", title: "Dificilmente",  desc: "Menos de uma vez por semana",   value: "rarely"),
        .init(emoji: "🏃", title: "Regularmente",  desc: "1 a 3 vezes por semana",         value: "regularly"),
        .init(emoji: "🏅", title: "Há anos",        desc: "Corrida é parte da minha rotina", value: "years"),
    ]

    var step3: some View {
        VStack(spacing: 8) {
            ForEach(Self.frequencyItems, id: \.value) { item in
                let sel = runningFrequency == item.value
                Button { runningFrequency = item.value } label: {
                    HStack(spacing: 12) {
                        Text(item.emoji).font(.system(size: 22))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.title)
                                .font(AthlyTheme.Typography.semibold(14))
                                .foregroundStyle(sel ? AthlyTheme.Color.primary : AthlyTheme.Color.textPrimary)
                            Text(item.desc)
                                .font(AthlyTheme.Typography.body(11))
                                .foregroundStyle(AthlyTheme.Color.textSecondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        ZStack {
                            Circle()
                                .stroke(sel ? AthlyTheme.Color.primary : AthlyTheme.Color.borderMid, lineWidth: 2)
                                .frame(width: 20, height: 20)
                            if sel { Circle().fill(AthlyTheme.Color.primary).frame(width: 20, height: 20) }
                        }
                    }
                    .padding(14)
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

// MARK: - P4: Nível

private extension AssessmentView {
    struct LevelItem {
        let color: Color; let name: String; let desc: String; let value: String
    }

    static let levelItems: [LevelItem] = [
        .init(color: Color(hex: "#94A3B8"), name: "Começando",     desc: "Nunca corri de forma consistente",       value: "beginning"),
        .init(color: Color(hex: "#10B981"), name: "Iniciante",     desc: "Consigo correr até 5 km",                value: "beginner"),
        .init(color: Color(hex: "#0EA5E9"), name: "Hobby",         desc: "Corro 10 km sem problema",               value: "hobby"),
        .init(color: Color(hex: "#7C3AED"), name: "Intermediário", desc: "Participo de provas com preparação",     value: "intermediate"),
        .init(color: Color(hex: "#EC4899"), name: "Avançado",      desc: "Treino estruturado, meia-maratona+",     value: "advanced"),
        .init(color: Color(hex: "#F59E0B"), name: "Pro",           desc: "Corrida é meu esporte principal",        value: "pro"),
    ]

    var step4: some View {
        VStack(spacing: 6) {
            ForEach(Self.levelItems, id: \.value) { item in
                let sel = fitnessLevel == item.value
                Button { fitnessLevel = item.value } label: {
                    HStack(spacing: 10) {
                        Circle().fill(item.color).frame(width: 8, height: 8)
                        Text(item.name)
                            .font(AthlyTheme.Typography.semibold(13))
                            .foregroundStyle(sel ? AthlyTheme.Color.primary : AthlyTheme.Color.textPrimary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Text(item.desc)
                            .font(AthlyTheme.Typography.body(10))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    .padding(.vertical, 9)
                    .padding(.horizontal, 12)
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

// MARK: - P5: Pace Confortável

private extension AssessmentView {
    var paceLabel: String {
        String(format: "%d:%02d", paceSeconds / 60, paceSeconds % 60)
    }

    var paceKmhLabel: String {
        String(format: "≈ %.1f km/h", 3600.0 / Double(paceSeconds))
    }

    var step5: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Dial card
            VStack(spacing: 6) {
                Text("PACE CONFORTÁVEL")
                    .font(AthlyTheme.Typography.label())
                    .foregroundStyle(AthlyTheme.Color.primary)
                    .kerning(1.2)

                Text(paceLabel)
                    .font(AthlyTheme.Typography.mono(52))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                    .monospacedDigit()
                    .contentTransition(.numericText())
                    .animation(.easeOut(duration: 0.1), value: paceSeconds)

                Text("min / km")
                    .font(AthlyTheme.Typography.body(12))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)

                Text(paceKmhLabel)
                    .font(AthlyTheme.Typography.mono(14))
                    .foregroundStyle(AthlyTheme.Color.textTertiary)

                HStack(spacing: 10) {
                    Button {
                        paceSeconds = min(900, paceSeconds + 5)
                    } label: {
                        Text("−")
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundStyle(AthlyTheme.Color.textPrimary)
                            .frame(width: 48, height: 48)
                            .background(AthlyTheme.Color.surfaceCardElevated)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(AthlyTheme.Color.borderMid, lineWidth: 1))
                    }
                    .buttonStyle(.plain)

                    Spacer().frame(width: 8)

                    Button {
                        paceSeconds = max(180, paceSeconds - 5)
                    } label: {
                        Text("+")
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 48, height: 48)
                            .background(AthlyTheme.Color.primary)
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.top, 4)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 24)
            .padding(.horizontal, 16)
            .background(AthlyTheme.Color.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.xl, style: .continuous)
                    .stroke(AthlyTheme.Color.primaryBorder, lineWidth: 1)
            )

            Text("Toque + ou − para ajustar em 5 segundos")
                .font(AthlyTheme.Typography.body(10))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.top, 8)

            obSectionLabel("Como esse ritmo parece?")
                .padding(.top, 14)
                .padding(.bottom, 8)

            HStack(spacing: 6) {
                paceFeelChip("😓 Pesado",      active: false)
                paceFeelChip("😊 Confortável", active: true)
                paceFeelChip("😴 Fácil demais", active: false)
            }

            obInfoNotice("A IA vai usar esse pace como zona base para calcular suas zonas de treino.")
                .padding(.top, 12)
        }
    }

    func paceFeelChip(_ label: String, active: Bool) -> some View {
        Text(label)
            .font(AthlyTheme.Typography.semibold(10))
            .foregroundStyle(active ? AthlyTheme.Color.primary : AthlyTheme.Color.textTertiary)
            .frame(maxWidth: .infinity)
            .frame(height: 32)
            .background(active ? AthlyTheme.Color.primarySoft : AthlyTheme.Color.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous)
                    .stroke(active ? AthlyTheme.Color.primaryBorder : AthlyTheme.Color.borderMid, lineWidth: 1)
            )
    }
}

// MARK: - P6: Objetivos

private extension AssessmentView {
    struct ObjectiveCard {
        let emoji: String; let title: String; let subtitle: String
        let value: String; let emojiBg: Color
    }

    static let objectiveCards: [ObjectiveCard] = [
        .init(emoji: "🏁", title: "Correr em um evento público",
              subtitle: "Provas, corridas de rua, maratonas",
              value: "event",   emojiBg: Color(hex: "#EC4899").opacity(0.12)),
        .init(emoji: "🎯", title: "Objetivo pessoal",
              subtitle: "Definido por mim mesmo",
              value: "personal", emojiBg: Color(hex: "#0EA5E9").opacity(0.10)),
        .init(emoji: "📈", title: "Melhorar fitness e endurance",
              subtitle: "Evoluir sem meta específica",
              value: "fitness",  emojiBg: Color(hex: "#10B981").opacity(0.10)),
    ]

    static let distancePills: [(label: String, value: String)] = [
        ("5K", "5k"), ("10K", "10k"), ("HM", "hm"),
        ("Meia", "half"), ("42K", "42k"), ("Ultra", "ultra"),
    ]

    var step6: some View {
        VStack(spacing: 7) {
            ForEach(Self.objectiveCards, id: \.value) { card in
                let isExpanded = expandedObjective == card.value
                let isSel = objective == card.value

                VStack(spacing: 0) {
                    // Card head
                    Button {
                        withAnimation(.easeOut(duration: 0.2)) {
                            if isExpanded {
                                expandedObjective = nil
                                if objective == card.value { objective = "" }
                            } else {
                                expandedObjective = card.value
                                objective = card.value
                            }
                        }
                    } label: {
                        HStack(spacing: 10) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 9, style: .continuous)
                                    .fill(card.emojiBg)
                                    .frame(width: 30, height: 30)
                                Text(card.emoji).font(.system(size: 14))
                            }
                            VStack(alignment: .leading, spacing: 1) {
                                Text(card.title)
                                    .font(AthlyTheme.Typography.semibold(13))
                                    .foregroundStyle(isSel ? AthlyTheme.Color.primary : AthlyTheme.Color.textPrimary)
                                Text(card.subtitle)
                                    .font(AthlyTheme.Typography.body(10))
                                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            Text("›")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(isSel ? AthlyTheme.Color.primary : AthlyTheme.Color.textTertiary)
                                .rotationEffect(.degrees(isExpanded ? 90 : 0))
                                .animation(.easeOut(duration: 0.2), value: isExpanded)
                        }
                        .padding(11)
                    }
                    .buttonStyle(.plain)

                    // Expanded sub-options (personal only)
                    if isExpanded && card.value == "personal" {
                        personalExpanded
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

    var personalExpanded: some View {
        VStack(alignment: .leading, spacing: 8) {
            Divider().background(AthlyTheme.Color.borderDark)

            // "Define a distance" sub-option (always selected when this card is open)
            objSubOption("Definir uma distância", selected: true)

            // Distance pills
            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: 5), count: 6),
                spacing: 5
            ) {
                ForEach(Self.distancePills, id: \.value) { pill in
                    let sel = objectiveDistance == pill.value
                    Button { objectiveDistance = pill.value } label: {
                        Text(pill.label)
                            .font(AthlyTheme.Typography.semibold(11))
                            .foregroundStyle(sel ? AthlyTheme.Color.primary : AthlyTheme.Color.textSecondary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 5)
                            .background(sel ? AthlyTheme.Color.primarySoft : AthlyTheme.Color.surfaceCardElevated)
                            .clipShape(Capsule())
                            .overlay(
                                Capsule().stroke(sel ? AthlyTheme.Color.primaryBorder : AthlyTheme.Color.borderMid, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }

            Text("TIPO DE OBJETIVO")
                .font(AthlyTheme.Typography.label())
                .foregroundStyle(AthlyTheme.Color.textTertiary)
                .kerning(1)
                .padding(.top, 4)

            Button { objectiveType = "workload" } label: {
                objSubOption("Workload adaptado pela IA", selected: objectiveType == "workload")
            }
            .buttonStyle(.plain)

            Button { objectiveType = "target_time" } label: {
                objSubOption("Tempo alvo", selected: objectiveType == "target_time")
            }
            .buttonStyle(.plain)

            if objectiveType == "target_time" {
                HStack {
                    Text("Meta")
                        .font(AthlyTheme.Typography.body(10))
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                    TextField("47:30", text: $targetTimeText)
                        .keyboardType(.numbersAndPunctuation)
                        .font(AthlyTheme.Typography.mono(18))
                        .foregroundStyle(AthlyTheme.Color.primary)
                        .frame(maxWidth: .infinity)
                    Text("min:seg")
                        .font(AthlyTheme.Typography.body(10))
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(AthlyTheme.Color.surfaceDark)
                .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous)
                        .stroke(AthlyTheme.Color.primaryBorder, lineWidth: 1)
                )
            }
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 12)
        .padding(.top, 4)
    }

    func objSubOption(_ title: String, selected: Bool) -> some View {
        HStack(spacing: 8) {
            ZStack {
                Circle()
                    .stroke(selected ? AthlyTheme.Color.primary : AthlyTheme.Color.borderMid, lineWidth: 2)
                    .frame(width: 14, height: 14)
                if selected { Circle().fill(AthlyTheme.Color.primary).frame(width: 14, height: 14) }
            }
            Text(title)
                .font(AthlyTheme.Typography.semibold(12))
                .foregroundStyle(selected ? AthlyTheme.Color.textPrimary : AthlyTheme.Color.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(AthlyTheme.Color.surfaceDark)
        .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous)
                .stroke(selected ? AthlyTheme.Color.primaryBorder : AthlyTheme.Color.borderDark, lineWidth: 1)
        )
    }
}
