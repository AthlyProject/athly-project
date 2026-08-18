import SwiftUI

struct AssessmentView: View {
    let onCompleted: () -> Void

    // MARK: - Navigation state
    @State private var step = 0
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    // MARK: - P3: Nível
    @State private var fitnessLevel = ""

    // MARK: - P4: Pace (seconds/km)
    @State private var paceSeconds = 345  // default 5:45/km

    // MARK: - P5: Objetivos
    @State private var objective = ""
    @State private var objectiveDistance = ""
    @State private var objectiveType = ""
    @State private var targetTimeText = ""

    private var totalSteps: Int { objective == "personal" ? 5 : 3 }
    private var isLastStep: Bool { step == totalSteps - 1 && (step != 2 || !objective.isEmpty) }

    private let screenMeta: [(title: String, subtitle: String)] = [
        ("Seu nível\nno momento",       "Seja honesto — vamos ajustar seus treinos"),
        ("Seu pace\nconfortável",       "Ritmo em que você corre sentindo-se bem — sem forçar"),
        ("Seus\nObjetivos",             "O que você quer alcançar correndo?"),
        ("Sua\nDistância",              "Para qual distância você quer treinar?"),
        ("Tipo de\nObjetivo",           "Como você quer que a IA monte seu treino?"),
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
                // Placeholder para manter o contador "X de Y" centralizado (balanceia o botão voltar).
                Color.clear.frame(width: 30, height: 30)
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
        case 0: step4
        case 1: step5
        case 2: step6
        case 3: stepDistancia
        default: stepTipo
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
        .disabled(isSubmitting || (step == 2 && objective.isEmpty))
        .opacity((step == 2 && objective.isEmpty) ? 0.5 : 1)
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
            gender: nil,
            weight: nil,
            height: nil,
            restingHeartRate: nil,
            maxHeartRate: nil,
            motivations: [],
            runningFrequency: nil,
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
        }
    }
}

// MARK: - P6: Objetivos

private extension AssessmentView {
    struct ObjectiveCard {
        let emoji: String; let title: String; let subtitle: String
        let value: String; let emojiBg: Color
    }

    static let objectiveCards: [ObjectiveCard] = [
        .init(emoji: "🎯", title: "Objetivo pessoal",
              subtitle: "Definido por mim mesmo",
              value: "personal", emojiBg: Color(hex: "#0EA5E9").opacity(0.10)),
        .init(emoji: "📈", title: "Melhorar fitness e endurance",
              subtitle: "Evoluir sem meta específica",
              value: "fitness",  emojiBg: Color(hex: "#10B981").opacity(0.10)),
    ]

    var step6: some View {
        VStack(spacing: 8) {
            ForEach(Self.objectiveCards, id: \.value) { card in
                let isSel = objective == card.value
                Button {
                    withAnimation(.easeOut(duration: 0.2)) {
                        objective = card.value
                        if card.value == "fitness" {
                            objectiveDistance = ""
                            objectiveType = ""
                            targetTimeText = ""
                        }
                    }
                } label: {
                    HStack(spacing: 12) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .fill(card.emojiBg)
                                .frame(width: 44, height: 44)
                            Text(card.emoji).font(.system(size: 22))
                        }
                        VStack(alignment: .leading, spacing: 3) {
                            Text(card.title)
                                .font(AthlyTheme.Typography.semibold(14))
                                .foregroundStyle(isSel ? AthlyTheme.Color.primary : AthlyTheme.Color.textPrimary)
                            Text(card.subtitle)
                                .font(AthlyTheme.Typography.body(11))
                                .foregroundStyle(AthlyTheme.Color.textSecondary)
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
                    .background(isSel ? AthlyTheme.Color.primarySoft : AthlyTheme.Color.surfaceCard)
                    .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                            .stroke(isSel ? AthlyTheme.Color.primaryBorder : AthlyTheme.Color.borderMid, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - P7: Distância (personal path)

private extension AssessmentView {
    struct DistanceItem {
        let emoji: String; let label: String; let description: String; let value: String
    }

    static let distanceItems: [DistanceItem] = [
        .init(emoji: "🏃", label: "5K",       description: "5 quilômetros",       value: "5k"),
        .init(emoji: "🏃", label: "10K",      description: "10 quilômetros",      value: "10k"),
        .init(emoji: "🏅", label: "Meia",     description: "21 quilômetros",      value: "half"),
        .init(emoji: "🏆", label: "Maratona", description: "42 quilômetros",      value: "42k"),
        .init(emoji: "⚡", label: "Ultra",    description: "Mais de 42 km",       value: "ultra"),
    ]

    var stepDistancia: some View {
        LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 2),
            spacing: 10
        ) {
            ForEach(Self.distanceItems, id: \.value) { item in
                let sel = objectiveDistance == item.value
                Button { objectiveDistance = item.value } label: {
                    VStack(spacing: 6) {
                        Text(item.emoji)
                            .font(.system(size: 28))
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

// MARK: - P8: Tipo de Objetivo (personal path)

private extension AssessmentView {
    struct ObjectiveTypeItem {
        let emoji: String; let title: String; let description: String; let value: String; let emojiBg: Color
    }

    static let objectiveTypeItems: [ObjectiveTypeItem] = [
        .init(emoji: "🤖", title: "Workload adaptado pela IA",
              description: "A IA define a carga com base na sua evolução",
              value: "workload", emojiBg: Color(hex: "#7C3AED").opacity(0.10)),
        .init(emoji: "⏱️", title: "Tempo alvo",
              description: "Defina um tempo e a IA cria um plano para você bater",
              value: "target_time", emojiBg: Color(hex: "#F59E0B").opacity(0.10)),
    ]

    var stepTipo: some View {
        VStack(spacing: 8) {
            ForEach(Self.objectiveTypeItems, id: \.value) { item in
                let isSel = objectiveType == item.value
                VStack(spacing: 0) {
                    Button { withAnimation(.easeOut(duration: 0.2)) { objectiveType = item.value } } label: {
                        HStack(spacing: 12) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .fill(item.emojiBg)
                                    .frame(width: 44, height: 44)
                                Text(item.emoji).font(.system(size: 22))
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
