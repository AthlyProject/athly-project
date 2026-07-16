import SwiftUI

/// Questionário de avaliação pós-cadastro — mesmo conteúdo, passos e valores do
/// `AssessmentPage.tsx` do athly-frontend. Envia para `POST /assessment`, que marca
/// `assessmentCompleted = true` no usuário (gate aplicado pelo `RootView`).
struct AssessmentView: View {
    /// Chamado após o envio com sucesso (RootView troca para o MainTabView).
    let onCompleted: () -> Void

    @State private var step = 0
    @State private var form = AssessmentSubmissionRequest()
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    // Datas dos DatePickers (serializadas como "yyyy-MM-dd" no envio, igual ao web)
    @State private var startDate = Date()
    @State private var hasPickedStartDate = false
    @State private var targetDate = Date()
    @State private var hasPickedTargetDate = false

    private static let steps = ["Objetivos", "Atividades", "Planejamento", "Performance & Saúde", "PAR-Q", "Termos"]

    private var isLastStep: Bool { step == Self.steps.count - 1 }

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark
                .ignoresSafeArea()

            VStack(spacing: 0) {
                header
                progressBar

                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        stepContent

                        if let errorMessage {
                            Text(errorMessage)
                                .font(AthlyTheme.Typography.body(13))
                                .foregroundStyle(AthlyTheme.Color.error)
                                .frame(maxWidth: .infinity)
                                .padding(12)
                                .background(AthlyTheme.Color.error.opacity(0.10))
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                    }
                    .padding(.horizontal, AthlyTheme.Spacing.sm)
                    .padding(.top, 16)
                    .padding(.bottom, 24)
                }
                .scrollDismissesKeyboard(.interactively)

                navigation
            }
        }
    }

    // MARK: - Header / Progress

    private var header: some View {
        VStack(spacing: 6) {
            HStack(spacing: 10) {
                Image("AthlyLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 36, height: 36)
                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                Text("Athly")
                    .font(AthlyTheme.Typography.heading(24))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
            }
            Text("Vamos personalizar sua experiência")
                .font(AthlyTheme.Typography.body(14))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 18)
        .padding(.bottom, 12)
    }

    private var progressBar: some View {
        VStack(spacing: 6) {
            HStack {
                Text(Self.steps[step])
                Spacer()
                Text("\(step + 1) / \(Self.steps.count)")
            }
            .font(AthlyTheme.Typography.body(12))
            .foregroundStyle(AthlyTheme.Color.textTertiary)

            HStack(spacing: 4) {
                ForEach(0..<Self.steps.count, id: \.self) { i in
                    Capsule()
                        .fill(i <= step ? AthlyTheme.Color.primary : AthlyTheme.Color.glassBorder)
                        .frame(height: 4)
                }
            }
        }
        .padding(.horizontal, AthlyTheme.Spacing.sm)
        .padding(.bottom, 4)
    }

    // MARK: - Steps

    @ViewBuilder
    private var stepContent: some View {
        switch step {
        case 0: goalsStep
        case 1: activityStep
        case 2: planningStep
        case 3: performanceStep
        case 4: parqStep
        default: termsStep
        }
    }

    // Passo 0 — Objetivos
    private var goalsStep: some View {
        VStack(alignment: .leading, spacing: 24) {
            section("Você já pratica atividades físicas regularmente?") {
                radioGroup(
                    options: [("Sim", "yes"), ("Ainda não", "no")],
                    selection: $form.goals.practicesRegularly
                )
            }
            section("Para qual distância você quer treinar?") {
                radioGroup(
                    options: [("5 km", "5k"), ("10 km", "10k"), ("Meia maratona (21.1 km)", "half")],
                    selection: $form.goals.targetDistance
                )
            }
            section("Eu quero treinar para...") {
                chipGrid(
                    options: [
                        ("Correr provas", "races"),
                        ("Emagrecer", "weight_loss"),
                        ("Melhorar saúde física", "physical_health"),
                        ("Melhorar saúde mental", "mental_health"),
                        ("Superar desafios pessoais", "challenges"),
                        ("Outro motivo", "other"),
                    ],
                    selections: $form.goals.motivations
                )
            }
        }
    }

    // Passo 1 — Atividades
    private var activityStep: some View {
        VStack(alignment: .leading, spacing: 24) {
            section("Atividades que você pratica atualmente") {
                chipGrid(
                    options: ["Caminhada", "Pilates", "Yoga", "Musculação", "Corrida", "Natação",
                              "Ciclismo", "Esportes coletivos", "Outras"].map { ($0, $0) },
                    selections: $form.activityHistory.currentActivities
                )
            }
            section("Quem prepara seus treinos de corrida atualmente?") {
                radioGroup(
                    options: [
                        ("Ainda não treino corrida", "none"),
                        ("Planilhas do ChatGPT", "chatgpt"),
                        ("Outra assessoria de corrida", "other_coach"),
                        ("Planilha pronta da internet", "online_plan"),
                        ("App de corrida (Runna, Nike Run, etc.)", "app"),
                        ("Nenhuma das opções acima", "none_above"),
                    ],
                    selection: $form.activityHistory.trainingPreparedBy
                )
            }
            section("Você consegue correr 3 km direto, sem caminhar?") {
                radioGroup(
                    options: [("Sim", "yes"), ("Ainda não", "no")],
                    selection: $form.activityHistory.canRun3km
                )
            }
            section("Há quanto tempo você começou a correr?") {
                radioGroup(
                    options: [
                        ("Menos de 6 meses", "<6m"),
                        ("6 a 12 meses", "6-12m"),
                        ("1 a 3 anos", "1-3y"),
                        ("Mais de 3 anos", ">3y"),
                    ],
                    selection: $form.activityHistory.runningExperience
                )
            }
        }
    }

    // Passo 2 — Planejamento
    private var planningStep: some View {
        VStack(alignment: .leading, spacing: 24) {
            section("Quais dias da semana você tem disponíveis para treinar?") {
                chipGrid(
                    options: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"].map { ($0, $0) },
                    selections: $form.trainingPlanning.availableDays
                )
            }
            section("Qual dia você vai começar a treinar?") {
                datePickerCard(date: $startDate, hasPicked: $hasPickedStartDate)
            }
            section("Você quer correr em alguma data específica?") {
                radioGroup(
                    options: [("Sim", "yes"), ("Não", "no")],
                    selection: $form.trainingPlanning.hasTargetDate
                )
                if form.trainingPlanning.hasTargetDate == "yes" {
                    fieldLabel("Qual data?")
                    datePickerCard(date: $targetDate, hasPicked: $hasPickedTargetDate)
                }
            }
        }
    }

    // Passo 3 — Performance & Saúde
    private var performanceStep: some View {
        VStack(alignment: .leading, spacing: 24) {
            section("Calculando seus ritmos") {
                fieldLabel("Escolha uma distância de referência:")
                radioGroup(
                    options: [("5 km", "5k"), ("10 km", "10k")],
                    selection: $form.performanceHealth.referenceDistance
                )
                fieldLabel("Seu melhor tempo estimado (Hr:Min:Seg):")
                    .padding(.top, 8)
                TextField("00:35:00", text: $form.performanceHealth.bestTime)
                    .keyboardType(.numbersAndPunctuation)
                    .textFieldStyle(.plain)
                    .font(AthlyTheme.Typography.body(15))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                    .padding(14)
                    .background(AthlyTheme.Color.surfaceCard)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(AthlyTheme.Color.glassBorder, lineWidth: 1)
                    )
            }
            section("Qualidade do sono (0 a 10)") {
                sleepScale
            }
            section("Você possui alguma dor crônica?") {
                radioGroup(
                    options: [("Sim", "yes"), ("Não", "no")],
                    selection: $form.performanceHealth.hasChronicPain
                )
                if form.performanceHealth.hasChronicPain == "yes" {
                    TextField(
                        "Descreva suas dores da melhor forma que conseguir...",
                        text: Binding(
                            get: { form.performanceHealth.chronicPainDescription ?? "" },
                            set: { form.performanceHealth.chronicPainDescription = $0.isEmpty ? nil : $0 }
                        ),
                        axis: .vertical
                    )
                    .lineLimit(3...5)
                    .textFieldStyle(.plain)
                    .font(AthlyTheme.Typography.body(14))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                    .padding(14)
                    .background(AthlyTheme.Color.surfaceCard)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(AthlyTheme.Color.glassBorder, lineWidth: 1)
                    )
                    .padding(.top, 8)
                }
            }
        }
    }

    private var sleepScale: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 6), spacing: 6) {
            ForEach(0...10, id: \.self) { n in
                let selected = form.performanceHealth.sleepQuality == n
                Button {
                    form.performanceHealth.sleepQuality = n
                } label: {
                    Text("\(n)")
                        .font(AthlyTheme.Typography.semibold(14))
                        .foregroundStyle(selected ? AthlyTheme.Color.backgroundDark : AthlyTheme.Color.textSecondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 40)
                        .background(selected ? AthlyTheme.Color.primary : AthlyTheme.Color.surfaceCard)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .stroke(selected ? AthlyTheme.Color.primary : AthlyTheme.Color.glassBorder, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            }
        }
    }

    // Passo 4 — PAR-Q
    private var parqStep: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Questionário de Prontidão (PAR-Q)")
                .font(AthlyTheme.Typography.heading(18))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Text("Responda com honestidade. Estas perguntas são apenas para sua segurança.")
                .font(AthlyTheme.Typography.body(13))
                .foregroundStyle(AthlyTheme.Color.textTertiary)

            parqQuestion(
                "Algum médico já disse que você possui algum problema de coração e que só deveria realizar atividade física supervisionado por profissionais de saúde?",
                value: $form.parq.heartCondition
            )
            parqQuestion(
                "Você sente dores no peito quando pratica atividade física?",
                value: $form.parq.chestPainDuringActivity
            )
            parqQuestion(
                "No último mês, você sentiu dores no peito quando praticou atividade física?",
                value: $form.parq.chestPainLastMonth
            )
            parqQuestion(
                "Você apresenta desequilíbrio devido à tontura e/ou perda de consciência?",
                value: $form.parq.dizzinessOrLossOfConsciousness
            )
            parqQuestion(
                "Você possui algum problema ósseo ou articular que poderia ser piorado pela atividade física?",
                value: $form.parq.boneJointProblem
            )
            parqQuestion(
                "Você toma atualmente algum medicamento para pressão arterial e/ou problema de coração?",
                value: $form.parq.takingBloodPressureMeds
            )
            parqQuestion(
                "Sabe de alguma outra razão pela qual você não deve praticar atividade física?",
                value: $form.parq.otherReasonToAvoidExercise
            )
        }
    }

    private func parqQuestion(_ text: String, value: Binding<Bool?>) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(text)
                .font(AthlyTheme.Typography.body(14))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 10) {
                parqAnswerButton("Sim", selected: value.wrappedValue == true) { value.wrappedValue = true }
                parqAnswerButton("Não", selected: value.wrappedValue == false) { value.wrappedValue = false }
            }
        }
        .padding(14)
        .background(AthlyTheme.Color.surfaceCard)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(AthlyTheme.Color.glassBorder, lineWidth: 1)
        )
    }

    private func parqAnswerButton(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(AthlyTheme.Typography.semibold(14))
                .foregroundStyle(selected ? AthlyTheme.Color.backgroundDark : AthlyTheme.Color.textSecondary)
                .frame(maxWidth: .infinity)
                .frame(height: 38)
                .background(selected ? AthlyTheme.Color.primary : AthlyTheme.Color.backgroundDark)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(selected ? AthlyTheme.Color.primary : AthlyTheme.Color.glassBorder, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    // Passo 5 — Termos + gênero
    private var termsStep: some View {
        VStack(alignment: .leading, spacing: 24) {
            section("Dados Complementares") {
                fieldLabel("Gênero")
                radioGroup(
                    options: [
                        ("Masculino", "male"),
                        ("Feminino", "female"),
                        ("Não-binário", "nonbinary"),
                        ("Prefiro não informar", "not_informed"),
                    ],
                    selection: Binding(
                        get: { form.gender ?? "" },
                        set: { form.gender = $0 }
                    )
                )
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Termo de Uso e Ciência")
                    .font(AthlyTheme.Typography.semibold(14))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                Text("Estou ciente de que é recomendável conversar com um médico antes de iniciar um programa de treinamento. Assumo plena responsabilidade por qualquer atividade praticada. Os treinos propostos pela IA usarão como base as respostas deste formulário.")
                    .font(AthlyTheme.Typography.body(12))
                    .foregroundStyle(AthlyTheme.Color.textTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(14)
            .background(AthlyTheme.Color.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(AthlyTheme.Color.glassBorder, lineWidth: 1)
            )

            VStack(alignment: .leading, spacing: 10) {
                fieldLabel("Ao prosseguir, você declara que leu e concorda com o Termo de Uso acima.")
                termChoice("Aceito os termos e quero começar a treinar", accepted: true)
                termChoice("Não aceito", accepted: false)
            }
        }
    }

    private func termChoice(_ title: String, accepted: Bool) -> some View {
        let selected = form.termsAccepted == accepted
        return Button {
            form.termsAccepted = accepted
            errorMessage = nil
        } label: {
            HStack(spacing: 12) {
                Image(systemName: selected ? "checkmark.square.fill" : "square")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(selected ? AthlyTheme.Color.primary : AthlyTheme.Color.textTertiary)
                Text(title)
                    .font(AthlyTheme.Typography.body(14))
                    .foregroundStyle(selected ? AthlyTheme.Color.textPrimary : AthlyTheme.Color.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            .padding(14)
            .background(selected ? AthlyTheme.Color.primary.opacity(0.10) : AthlyTheme.Color.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(selected ? AthlyTheme.Color.primary : AthlyTheme.Color.glassBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Navigation

    private var navigation: some View {
        HStack(spacing: 10) {
            if step > 0 {
                Button {
                    withAnimation(.easeOut(duration: 0.2)) { step -= 1 }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "chevron.left")
                        Text("Voltar")
                    }
                    .font(AthlyTheme.Typography.semibold(15))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(AthlyTheme.Color.surfaceCard)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(isSubmitting)
            }

            Button {
                if isLastStep {
                    Task { await submit() }
                } else {
                    withAnimation(.easeOut(duration: 0.2)) { step += 1 }
                }
            } label: {
                HStack(spacing: 8) {
                    if isSubmitting {
                        ProgressView()
                            .tint(.white)
                            .scaleEffect(0.85)
                    }
                    Text(isLastStep ? (isSubmitting ? "Enviando..." : "Finalizar") : "Continuar")
                    if !isLastStep {
                        Image(systemName: "chevron.right")
                    }
                }
            }
            .buttonStyle(AthlyGradientButtonStyle())
            .disabled(isSubmitting)
        }
        .padding(.horizontal, AthlyTheme.Spacing.sm)
        .padding(.top, 8)
        .padding(.bottom, 12)
    }

    // MARK: - Submit

    @MainActor
    private func submit() async {
        guard form.termsAccepted else {
            errorMessage = "Você deve aceitar os termos para continuar."
            return
        }

        isSubmitting = true
        errorMessage = nil

        // Datas no mesmo formato do web (input type="date" → yyyy-MM-dd)
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        if hasPickedStartDate {
            form.trainingPlanning.startDate = formatter.string(from: startDate)
        }
        if form.trainingPlanning.hasTargetDate == "yes", hasPickedTargetDate {
            form.trainingPlanning.targetDate = formatter.string(from: targetDate)
        } else {
            form.trainingPlanning.targetDate = nil
        }

        do {
            try await APIClient.shared.submitAssessment(form)
            onCompleted()
        } catch {
            errorMessage = "Não foi possível enviar o questionário. Tente novamente."
        }

        isSubmitting = false
    }

    // MARK: - Building blocks

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(AthlyTheme.Typography.heading(18))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
            content()
        }
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(AthlyTheme.Typography.semibold(13))
            .foregroundStyle(AthlyTheme.Color.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
    }

    /// Lista de opções de seleção única (equivalente ao RadioGroup do web).
    private func radioGroup(options: [(String, String)], selection: Binding<String>) -> some View {
        VStack(spacing: 8) {
            ForEach(options, id: \.1) { option in
                let selected = selection.wrappedValue == option.1
                Button {
                    selection.wrappedValue = option.1
                } label: {
                    HStack(spacing: 12) {
                        ZStack {
                            Circle()
                                .stroke(selected ? AthlyTheme.Color.primary : AthlyTheme.Color.glassBorder, lineWidth: 2)
                                .frame(width: 18, height: 18)
                            if selected {
                                Circle()
                                    .fill(AthlyTheme.Color.primary)
                                    .frame(width: 9, height: 9)
                            }
                        }
                        Text(option.0)
                            .font(AthlyTheme.Typography.body(14))
                            .foregroundStyle(selected ? AthlyTheme.Color.textPrimary : AthlyTheme.Color.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 12)
                    .padding(.horizontal, 14)
                    .background(selected ? AthlyTheme.Color.primary.opacity(0.10) : AthlyTheme.Color.surfaceCard)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(selected ? AthlyTheme.Color.primary : AthlyTheme.Color.glassBorder, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    /// Chips de seleção múltipla (equivalente ao ToggleChip do web).
    private func chipGrid(options: [(String, String)], selections: Binding<[String]>) -> some View {
        FlowLayout(spacing: 8) {
            ForEach(options, id: \.1) { option in
                let selected = selections.wrappedValue.contains(option.1)
                Button {
                    if selected {
                        selections.wrappedValue.removeAll { $0 == option.1 }
                    } else {
                        selections.wrappedValue.append(option.1)
                    }
                } label: {
                    Text(option.0)
                        .font(AthlyTheme.Typography.semibold(13))
                        .foregroundStyle(selected ? AthlyTheme.Color.backgroundDark : AthlyTheme.Color.textSecondary)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 9)
                        .background(selected ? AthlyTheme.Color.primary : AthlyTheme.Color.surfaceCard)
                        .clipShape(Capsule())
                        .overlay(
                            Capsule()
                                .stroke(selected ? AthlyTheme.Color.primary : AthlyTheme.Color.glassBorder, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func datePickerCard(date: Binding<Date>, hasPicked: Binding<Bool>) -> some View {
        DatePicker(
            "",
            selection: Binding(
                get: { date.wrappedValue },
                set: { date.wrappedValue = $0; hasPicked.wrappedValue = true }
            ),
            displayedComponents: .date
        )
        .datePickerStyle(.compact)
        .labelsHidden()
        .tint(AthlyTheme.Color.primary)
        .environment(\.colorScheme, .dark)
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AthlyTheme.Color.surfaceCard)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AthlyTheme.Color.glassBorder, lineWidth: 1)
        )
    }
}

/// Layout de fluxo simples para os chips (quebra de linha automática).
private struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: width, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), anchor: .topLeading, proposal: .unspecified)
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
