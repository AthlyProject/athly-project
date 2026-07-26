import SwiftUI

struct ProfileCompletionView: View {
    @EnvironmentObject var authViewModel: AuthViewModel

    @State private var name         = ""
    @State private var gender       = ""
    @State private var weightKg     = 70
    @State private var heightCm     = 175
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    private var isValid: Bool { !name.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark.ignoresSafeArea()
            RadialGradient(
                colors: [AthlyTheme.Color.secondary.opacity(0.14), .clear],
                center: .topLeading, startRadius: 0, endRadius: 280
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                header
                    .padding(.horizontal, 20)

                ScrollView {
                    VStack(spacing: 9) {
                        nameField
                        genderSection
                        stepperSection(
                            label: "Peso",
                            value: weightKg,
                            unit: "kg",
                            range: 30...200
                        ) { weightKg += $0 }
                        stepperSection(
                            label: "Altura",
                            value: heightCm,
                            unit: "cm",
                            range: 100...250
                        ) { heightCm += $0 }

                        if let errorMessage {
                            Text(errorMessage)
                                .font(AthlyTheme.Typography.body(12))
                                .foregroundStyle(AthlyTheme.Color.error)
                                .frame(maxWidth: .infinity)
                                .padding(12)
                                .background(AthlyTheme.Color.error.opacity(0.10))
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 16)
                }
                .scrollDismissesKeyboard(.interactively)

                footerCTA
                    .padding(.horizontal, 20)
                    .padding(.bottom, 24)
                    .padding(.top, 10)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center, spacing: 10) {
                Color.clear.frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Seus dados")
                        .font(AthlyTheme.Typography.heading(20))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                    Text("A IA usa esses dados para personalizar seu plano")
                        .font(AthlyTheme.Typography.body(12))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }
            }
            .padding(.top, 8)
            .padding(.bottom, 12)

            HStack(spacing: 4) {
                Capsule().fill(AthlyTheme.Color.primary.opacity(0.45)).frame(height: 3)
                Capsule().fill(AthlyTheme.Color.primary).frame(height: 3)
            }
            .padding(.bottom, 20)
        }
    }

    // MARK: - Name

    private var nameField: some View {
        VStack(alignment: .leading, spacing: 5) {
            sectionLabel("Nome completo")
            HStack {
                TextField("Gabriel Fonseca", text: $name)
                    .font(AthlyTheme.Typography.body(13))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                    .textContentType(.name)
                    .autocorrectionDisabled()
                if isValid {
                    Image(systemName: "checkmark")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(AthlyTheme.Color.success)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .animation(.easeOut(duration: 0.15), value: isValid)
            .padding(.vertical, 11)
            .padding(.horizontal, 13)
            .background(AthlyTheme.Color.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                    .stroke(AthlyTheme.Color.borderMid, lineWidth: 1)
            )
        }
    }

    // MARK: - Gender

    private var genderSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Gênero")
            HStack(spacing: 6) {
                genderPill("Masculino", value: "male")
                genderPill("Feminino",  value: "female")
                genderPill("Outro",     value: "other")
            }
        }
    }

    private func genderPill(_ label: String, value: String) -> some View {
        let sel = gender == value
        return Button { gender = value } label: {
            Text(label)
                .font(AthlyTheme.Typography.semibold(12))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .foregroundStyle(sel ? AthlyTheme.Color.primary : AthlyTheme.Color.textSecondary)
                .frame(maxWidth: .infinity)
                .frame(height: 38)
                .background(sel ? AthlyTheme.Color.primarySoft : AthlyTheme.Color.surfaceCard)
                .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                        .stroke(sel ? AthlyTheme.Color.primaryBorder : AthlyTheme.Color.borderMid, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Stepper

    private func stepperSection(
        label: String,
        value: Int,
        unit: String,
        range: ClosedRange<Int>,
        onStep: @escaping (Int) -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel(label)
            HStack {
                stepperButton(symbol: "−", color: AthlyTheme.Color.surfaceCardElevated, textColor: AthlyTheme.Color.textPrimary) {
                    if value > range.lowerBound { onStep(-1) }
                }
                Spacer()
                HStack(alignment: .firstTextBaseline, spacing: 5) {
                    Text("\(value)")
                        .font(AthlyTheme.Typography.mono(24))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                        .contentTransition(.numericText())
                        .animation(.easeOut(duration: 0.12), value: value)
                    Text(unit)
                        .font(AthlyTheme.Typography.medium(13))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }
                Spacer()
                stepperButton(symbol: "+", color: AthlyTheme.Color.primary, textColor: .white) {
                    if value < range.upperBound { onStep(1) }
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(AthlyTheme.Color.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                    .stroke(AthlyTheme.Color.borderMid, lineWidth: 1)
            )
        }
    }

    private func stepperButton(symbol: String, color: Color, textColor: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(symbol)
                .font(.system(size: 20, weight: .light))
                .foregroundStyle(textColor)
                .frame(width: 36, height: 36)
                .background(color)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(AthlyTheme.Color.borderMid, lineWidth: color == AthlyTheme.Color.surfaceCardElevated ? 1 : 0)
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Footer CTA

    private var footerCTA: some View {
        Button {
            Task { await submit() }
        } label: {
            HStack(spacing: 8) {
                if isSubmitting { ProgressView().tint(.white).scaleEffect(0.85) }
                Text(isSubmitting ? "Salvando..." : "Continuar")
                    .font(AthlyTheme.Typography.semibold(14))
                if !isSubmitting {
                    Image(systemName: "arrow.right")
                        .font(.system(size: 13, weight: .semibold))
                }
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(AthlyTheme.Gradient.brand)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
            .opacity((!isValid || isSubmitting) ? 0.55 : 1)
        }
        .buttonStyle(.plain)
        .disabled(!isValid || isSubmitting)
    }

    // MARK: - Submit

    @MainActor
    private func submit() async {
        isSubmitting = true
        errorMessage = nil
        do {
            let request = UpdateProfileRequest(
                name: name.trimmingCharacters(in: .whitespaces),
                weight: Double(weightKg),
                height: Double(heightCm),
                dateOfBirth: nil,
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

    // MARK: - Helpers

    private func sectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(AthlyTheme.Typography.label())
            .foregroundStyle(AthlyTheme.Color.textTertiary)
            .kerning(0.8)
    }
}
