import SwiftUI

/// Folha de edição dos dados pessoais coletados no onboarding (nome, gênero, peso, altura e FC).
struct EditProfileView: View {
    let profile: UserProfile?
    let onSaved: (UserProfile) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var name: String = ""
    @State private var gender: String = ""
    @State private var weightKg: Int?
    @State private var heightCm: Int?
    @State private var restingHeartRate: Int?
    @State private var maxHeartRate: Int?
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let genders: [(value: String, label: LocalizedStringKey)] = [
        ("male",   "Masculino"),
        ("female", "Feminino"),
        ("other",  "Outro"),
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                AthlyTheme.Color.backgroundDark
                    .ignoresSafeArea()

                RadialGradient(
                    colors: [AthlyTheme.Color.primary.opacity(0.12), .clear],
                    center: .init(x: 0.0, y: 0.0),
                    startRadius: 0, endRadius: 220
                )
                .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 14) {
                        avatar

                        field("Nome completo") {
                            TextField("", text: $name)
                                .textContentType(.name)
                                .foregroundStyle(AthlyTheme.Color.textPrimary)
                                .font(AthlyTheme.Typography.body(13))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 10)
                                .background(AthlyTheme.Color.backgroundAlt)
                                .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous)
                                        .stroke(AthlyTheme.Color.borderMid, lineWidth: 1)
                                )
                        }

                        field("Gênero") {
                            HStack(spacing: 6) {
                                ForEach(genders, id: \.value) { option in
                                    genderOption(value: option.value, label: option.label)
                                }
                            }
                        }

                        field("Peso") {
                            AthlyStepperField(value: $weightKg, unit: "kg", defaultValue: 70, range: 30...250)
                        }

                        field("Altura") {
                            AthlyStepperField(value: $heightCm, unit: "cm", defaultValue: 175, range: 100...250)
                        }

                        field("Frequência cardíaca") {
                            HStack(spacing: 8) {
                                AthlyStepperField(
                                    value: $restingHeartRate,
                                    unit: String(localized: "rep"),
                                    defaultValue: 60,
                                    range: 30...120,
                                    accessibilityName: String(localized: "Frequência cardíaca de repouso")
                                )
                                AthlyStepperField(
                                    value: $maxHeartRate,
                                    unit: String(localized: "máx"),
                                    defaultValue: 190,
                                    range: 120...230,
                                    accessibilityName: String(localized: "Frequência cardíaca máxima")
                                )
                            }
                        }

                        if let errorMessage {
                            Text(errorMessage)
                                .font(AthlyTheme.Typography.body(12))
                                .foregroundStyle(AthlyTheme.Color.error)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        saveButton
                    }
                    .padding(AthlyTheme.Spacing.sm)
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Editar perfil")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancelar") { dismiss() }
                        .foregroundStyle(AthlyTheme.Color.primary)
                        .disabled(isSaving)
                }
            }
            .onAppear(perform: hydrate)
        }
    }

    // MARK: - Blocos

    private var avatar: some View {
        Text(initials)
            .font(AthlyTheme.Typography.heading(23))
            .foregroundStyle(.white)
            .frame(width: 64, height: 64)
            .background(AthlyTheme.Gradient.brand)
            .clipShape(Circle())
            .shadow(color: AthlyTheme.Color.primaryGlow, radius: 14)
            .padding(.top, 4)
            .accessibilityHidden(true)
    }

    private func field<Content: View>(
        _ label: LocalizedStringKey,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(AthlyTheme.Typography.semibold(10))
                .kerning(1.0)
                .textCase(.uppercase)
                .foregroundStyle(AthlyTheme.Color.textTertiary)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func genderOption(value: String, label: LocalizedStringKey) -> some View {
        let isSelected = gender == value
        return Button {
            gender = value
        } label: {
            Text(label)
                .font(AthlyTheme.Typography.semibold(11))
                .foregroundStyle(isSelected ? AthlyTheme.Color.primary : AthlyTheme.Color.textSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 9)
                .background(isSelected ? AthlyTheme.Color.primarySoft : AthlyTheme.Color.backgroundAlt)
                .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous)
                        .stroke(isSelected ? AthlyTheme.Color.primaryBorder : AthlyTheme.Color.borderMid, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var saveButton: some View {
        Button {
            Task { await save() }
        } label: {
            HStack(spacing: 7) {
                if isSaving {
                    ProgressView()
                        .tint(.white)
                        .scaleEffect(0.8)
                } else {
                    Image(systemName: "checkmark")
                        .font(.system(size: 13, weight: .bold))
                }
                Text("Salvar alterações")
                    .font(AthlyTheme.Typography.semibold(13))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 13)
            .background(AthlyTheme.Gradient.brand)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
            .shadow(color: AthlyTheme.Color.primaryGlow, radius: 12, y: 6)
        }
        .buttonStyle(.plain)
        .disabled(isSaving || trimmedName.isEmpty)
        .opacity(trimmedName.isEmpty ? 0.5 : 1)
        .padding(.top, 4)
    }

    // MARK: - Ações

    private func hydrate() {
        name = profile?.name ?? ""
        gender = profile?.gender ?? ""
        weightKg = profile?.weight.map { Int($0.rounded()) }
        heightCm = profile?.height.map { Int($0.rounded()) }
        restingHeartRate = profile?.restingHeartRate
        maxHeartRate = profile?.maxHeartRate
    }

    private func save() async {
        guard trimmedName.count >= 2 else {
            errorMessage = String(localized: "Informe seu nome completo.")
            return
        }
        if let resting = restingHeartRate, let maximum = maxHeartRate, resting >= maximum {
            errorMessage = String(localized: "A FC de repouso precisa ser menor que a FC máxima.")
            return
        }

        isSaving = true
        errorMessage = nil

        let request = UpdateProfileRequest(
            name: trimmedName,
            weight: weightKg.map(Double.init),
            height: heightCm.map(Double.init),
            gender: gender.isEmpty ? nil : gender,
            restingHeartRate: restingHeartRate,
            maxHeartRate: maxHeartRate
        )

        do {
            let updated = try await APIClient.shared.updateProfile(request)
            if let weight = updated.weight {
                UserMetrics.weightKg = weight
            }
            onSaved(updated)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }

        isSaving = false
    }

    private var trimmedName: String {
        name.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var initials: String {
        let letters = trimmedName
            .split(separator: " ")
            .prefix(2)
            .compactMap { $0.first }
            .map(String.init)
            .joined()
            .uppercased()
        return letters.isEmpty ? "A" : letters
    }
}

/// Stepper "− valor +" do design system. `value == nil` mostra "—" até o primeiro toque.
struct AthlyStepperField: View {
    @Binding var value: Int?
    let unit: String
    let defaultValue: Int
    let range: ClosedRange<Int>
    var step: Int = 1
    var accessibilityName: String?

    var body: some View {
        HStack(spacing: 0) {
            button(systemImage: "minus", delta: -step, label: String(localized: "Diminuir"))

            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(value.map(String.init) ?? "—")
                    .font(AthlyTheme.Typography.mono(15))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                Text(unit)
                    .font(AthlyTheme.Typography.body(10))
                    .foregroundStyle(AthlyTheme.Color.textTertiary)
            }
            .frame(maxWidth: .infinity)

            button(systemImage: "plus", delta: step, label: String(localized: "Aumentar"))
        }
        .frame(height: 40)
        .background(AthlyTheme.Color.backgroundAlt)
        .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous)
                .stroke(AthlyTheme.Color.borderMid, lineWidth: 1)
        )
        .accessibilityValue(Text(value.map(String.init) ?? "—"))
    }

    private func button(systemImage: String, delta: Int, label: String) -> some View {
        Button {
            let current = value ?? defaultValue
            let next = value == nil ? defaultValue : current + delta
            value = min(max(next, range.lowerBound), range.upperBound)
        } label: {
            Image(systemName: systemImage)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .frame(width: 42, height: 40)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(verbatim: "\(label) \(accessibilityName ?? unit)"))
    }
}
