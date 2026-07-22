import SwiftUI

struct ProfileCompletionView: View {
    @EnvironmentObject var authViewModel: AuthViewModel

    @State private var step = 0
    @State private var name = ""
    @State private var dateOfBirth = Date()
    @State private var gender = ""
    @State private var weightText = ""
    @State private var heightText = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    private let totalSteps = 2

    private var step1Valid: Bool { !name.trimmingCharacters(in: .whitespaces).isEmpty }

    private var dateOfBirthString: String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: dateOfBirth)
    }

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
                    VStack(spacing: 0) {
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
            Color.clear.frame(width: 30)
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    // MARK: - Progress

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
        let titles = ["Qual é o\nseu nome?", "Mais sobre\nvocê"]
        let subtitles = [
            "Como vamos te chamar no app",
            "Usamos esses dados para personalizar seus treinos",
        ]
        return VStack(alignment: .leading, spacing: 4) {
            Text(titles[step])
                .font(AthlyTheme.Typography.heading(19))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Text(subtitles[step])
                .font(AthlyTheme.Typography.body(12))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Steps

    @ViewBuilder
    private var stepContent: some View {
        if step == 0 {
            step1
        } else {
            step2
        }
    }

    // Step 1 — Name
    private var step1: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Nome completo")
            TextField("Ex: João Silva", text: $name)
                .textContentType(.name)
                .font(AthlyTheme.Typography.semibold(16))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .padding(.vertical, 13)
                .padding(.horizontal, 14)
                .background(AthlyTheme.Color.surfaceCard)
                .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                        .stroke(AthlyTheme.Color.borderMid, lineWidth: 1)
                )
        }
    }

    // Step 2 — DOB, gender, weight, height
    private var step2: some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionLabel("Data de nascimento").padding(.bottom, 8)
            DatePicker("", selection: $dateOfBirth, in: ...Date(), displayedComponents: .date)
                .datePickerStyle(.compact)
                .labelsHidden()
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .padding(.vertical, 10)
                .padding(.horizontal, 12)
                .background(AthlyTheme.Color.surfaceCard)
                .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                        .stroke(AthlyTheme.Color.borderMid, lineWidth: 1)
                )

            divider

            sectionLabel("Gênero").padding(.bottom, 8)
            HStack(spacing: 8) {
                genderPill("♂ Masculino", value: "male")
                genderPill("♀ Feminino",  value: "female")
                genderPill("⊕ Outro",     value: "other")
            }

            divider

            sectionLabel("Corpo", optional: true).padding(.bottom, 8)
            HStack(spacing: 8) {
                numericField(label: "Peso", unit: "kg", text: $weightText)
                numericField(label: "Altura", unit: "cm", text: $heightText)
            }
        }
    }

    // MARK: - Footer

    private var footer: some View {
        let isLast = step == totalSteps - 1
        let disabled = (step == 0 && !step1Valid) || isSubmitting

        return Button {
            if isLast { Task { await submit() } }
            else { withAnimation(.easeOut(duration: 0.2)) { step += 1 } }
        } label: {
            HStack(spacing: 8) {
                if isSubmitting { ProgressView().tint(.white).scaleEffect(0.85) }
                Text(isLast ? (isSubmitting ? "Salvando..." : "Continuar →") : "Continuar →")
                    .font(AthlyTheme.Typography.semibold(14))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 46)
            .background(AthlyTheme.Gradient.brand)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
            .opacity(disabled ? 0.5 : 1)
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .padding(.horizontal, 16)
        .padding(.bottom, 16)
        .padding(.top, 10)
    }

    // MARK: - Submit

    @MainActor
    private func submit() async {
        isSubmitting = true
        errorMessage = nil
        do {
            let request = UpdateProfileRequest(
                name: name.trimmingCharacters(in: .whitespaces),
                weight: Double(weightText.replacingOccurrences(of: ",", with: ".")),
                height: Double(heightText.replacingOccurrences(of: ",", with: ".")),
                dateOfBirth: dateOfBirthString,
                gender: gender.isEmpty ? nil : gender
            )
            let profile = try await APIClient.shared.updateProfile(request)
            UserMetrics.weightKg = profile.weight ?? 0
            authViewModel.markProfileCompleted()
        } catch {
            errorMessage = error.localizedDescription
        }
        isSubmitting = false
    }

    // MARK: - Shared sub-views

    private func sectionLabel(_ text: String, optional: Bool = false) -> some View {
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

    private var divider: some View {
        Rectangle()
            .fill(AthlyTheme.Color.borderDark)
            .frame(height: 1)
            .padding(.vertical, 12)
    }

    private func genderPill(_ label: String, value: String) -> some View {
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

    private func numericField(label: String, unit: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(AthlyTheme.Typography.label())
                .foregroundStyle(AthlyTheme.Color.textTertiary)
                .kerning(1)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                TextField("—", text: text)
                    .keyboardType(.decimalPad)
                    .font(AthlyTheme.Typography.mono(15))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
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
                .stroke(AthlyTheme.Color.borderMid, lineWidth: 1)
        )
        .frame(maxWidth: .infinity)
    }
}
