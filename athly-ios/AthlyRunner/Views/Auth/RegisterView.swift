import SwiftUI
import AuthenticationServices

struct RegisterView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var email         = ""
    @State private var password      = ""
    @State private var termsAccepted = false
    @State private var showPassword  = false

    private var isFormValid: Bool {
        !email.isEmpty && password.count >= 8 && termsAccepted
    }

    private var passwordStrength: Int {
        guard !password.isEmpty else { return 0 }
        var score = 0
        if password.count >= 8  { score += 1 }
        if password.count >= 12 { score += 1 }
        if password.range(of: "[A-Z]",      options: .regularExpression) != nil { score += 1 }
        if password.range(of: "[0-9!@#$%]", options: .regularExpression) != nil { score += 1 }
        return score
    }

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark.ignoresSafeArea()
            RadialGradient(
                colors: [AthlyTheme.Color.secondary.opacity(0.14), .clear],
                center: .topLeading, startRadius: 0, endRadius: 280
            )
            .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    // Back button + heading
                    HStack(alignment: .center, spacing: 10) {
                        Button { dismiss() } label: {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(AthlyTheme.Color.textSecondary)
                                .frame(width: 34, height: 34)
                                .background(AthlyTheme.Color.surfaceCard)
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        }
                        .buttonStyle(.plain)

                        VStack(alignment: .leading, spacing: 1) {
                            Text("Criar conta")
                                .font(AthlyTheme.Typography.heading(20))
                                .foregroundStyle(AthlyTheme.Color.textPrimary)
                            Text("Comece seu plano de treino com IA")
                                .font(AthlyTheme.Typography.body(12))
                                .foregroundStyle(AthlyTheme.Color.textSecondary)
                        }
                        Spacer()
                    }
                    .padding(.top, 8)
                    .padding(.bottom, 12)

                    // Step progress 1/2
                    HStack(spacing: 4) {
                        Capsule().fill(AthlyTheme.Color.primary).frame(height: 3)
                        Capsule().fill(AthlyTheme.Color.borderMid).frame(height: 3)
                    }
                    .padding(.bottom, 18)

                    // Email
                    authField(label: "Email") {
                        HStack {
                            ZStack(alignment: .leading) {
                                if email.isEmpty {
                                    Text("email@exemplo.com")
                                        .font(AthlyTheme.Typography.body(13))
                                        .foregroundStyle(Color(.placeholderText))
                                        .allowsHitTesting(false)

                                }
                                TextField("", text: $email)
                                    .font(AthlyTheme.Typography.body(13))
                                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                                    .textContentType(.emailAddress)
                                    .keyboardType(.emailAddress)
                                    .autocapitalization(.none)
                                    .autocorrectionDisabled()
                            }
                            Image(systemName: "envelope")
                                .font(.system(size: 14))
                                .foregroundStyle(AthlyTheme.Color.textTertiary)
                        }
                    }
                    .padding(.bottom, 9)

                    // Password + strength
                    passwordSection
                        .padding(.bottom, 12)

                    // Terms
                    termsRow
                        .padding(.bottom, 14)

                    // Error
                    if let error = authViewModel.errorMessage {
                        Text(error)
                            .font(AthlyTheme.Typography.body(12))
                            .foregroundStyle(AthlyTheme.Color.error)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.bottom, 8)
                    }

                    // Primary CTA
                    Button {
                        Task { await authViewModel.register(email: email, password: password) }
                    } label: {
                        Group {
                            if authViewModel.isLoading {
                                ProgressView().tint(.white).scaleEffect(0.85)
                            } else {
                                Text("Criar conta")
                                    .font(AthlyTheme.Typography.semibold(14))
                            }
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(AthlyTheme.Gradient.brand)
                        .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
                        .opacity((!isFormValid || authViewModel.isLoading) ? 0.55 : 1)
                    }
                    .buttonStyle(.plain)
                    .disabled(!isFormValid || authViewModel.isLoading)
                    .padding(.bottom, 14)

                    authDivider
                        .padding(.bottom, 10)

                    // Apple
                    SignInWithAppleButton(.signUp) { request in
                        request.requestedScopes = [.fullName, .email]
                    } onCompletion: { result in
                        switch result {
                        case .success(let auth):
                            guard let credential = auth.credential as? ASAuthorizationAppleIDCredential else { return }
                            Task { await authViewModel.signInWithApple(credential: credential) }
                        case .failure(let error):
                            if (error as? ASAuthorizationError)?.code != .canceled {
                                Task { @MainActor in authViewModel.errorMessage = error.localizedDescription }
                            }
                        }
                    }
                    .signInWithAppleButtonStyle(.white)
                    .frame(height: 44)
                    .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
                    .padding(.bottom, 14)

                    // Footer
                    HStack(spacing: 4) {
                        Text("Já tem conta?")
                            .font(AthlyTheme.Typography.body(12))
                            .foregroundStyle(AthlyTheme.Color.textTertiary)
                        Button("Entrar") { dismiss() }
                            .font(AthlyTheme.Typography.semibold(12))
                            .foregroundStyle(AthlyTheme.Color.primary)
                            .buttonStyle(.plain)
                    }
                    .padding(.bottom, 28)
                }
                .padding(.horizontal, 20)
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }

    // MARK: - Password section

    private var passwordSection: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text("Senha".uppercased())
                .font(AthlyTheme.Typography.label())
                .foregroundStyle(AthlyTheme.Color.textTertiary)
                .kerning(0.8)

            HStack {
                Group {
                    if showPassword {
                        TextField("Mínimo 8 caracteres", text: $password)
                    } else {
                        SecureField("Mínimo 8 caracteres", text: $password)
                    }
                }
                .font(AthlyTheme.Typography.body(13))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .textContentType(.newPassword)

                Button { showPassword.toggle() } label: {
                    Image(systemName: showPassword ? "eye.slash" : "eye")
                        .font(.system(size: 14))
                        .foregroundStyle(password.isEmpty ? AthlyTheme.Color.textTertiary : AthlyTheme.Color.primary)
                }
                .buttonStyle(.plain)
            }
            .padding(.vertical, 11)
            .padding(.horizontal, 13)
            .background(AthlyTheme.Color.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                    .stroke(AthlyTheme.Color.borderMid, lineWidth: 1)
            )

            if !password.isEmpty {
                HStack(spacing: 3) {
                    ForEach(0..<4, id: \.self) { i in
                        Capsule()
                            .fill(i < passwordStrength ? strengthColor : AthlyTheme.Color.borderMid)
                            .frame(height: 3)
                    }
                }

                Text(strengthLabel)
                    .font(AthlyTheme.Typography.body(10))
                    .foregroundStyle(strengthColor)
            }
        }
    }

    private var strengthColor: Color {
        switch passwordStrength {
        case 1:    return AthlyTheme.Color.error
        case 2:    return AthlyTheme.Color.warning
        default:   return AthlyTheme.Color.success
        }
    }

    private var strengthLabel: String {
        switch passwordStrength {
        case 1:    return "Senha fraca"
        case 2:    return "Senha média"
        default:   return "Senha forte ✓"
        }
    }

    // MARK: - Terms

    private var termsRow: some View {
        HStack(alignment: .top, spacing: 9) {
            Button { termsAccepted.toggle() } label: {
                ZStack {
                    RoundedRectangle(cornerRadius: 5, style: .continuous)
                        .fill(termsAccepted ? AthlyTheme.Color.primarySoft : .clear)
                        .overlay(
                            RoundedRectangle(cornerRadius: 5, style: .continuous)
                                .stroke(
                                    termsAccepted ? AthlyTheme.Color.primaryBorder : AthlyTheme.Color.borderMid,
                                    lineWidth: 2
                                )
                        )
                        .frame(width: 18, height: 18)
                    if termsAccepted {
                        Image(systemName: "checkmark")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(AthlyTheme.Color.primary)
                    }
                }
            }
            .buttonStyle(.plain)
            .padding(.top, 1)

            termsText
        }
    }

    // MARK: - Helpers

    private var termsText: some View {
        (Text("Concordo com os ").foregroundColor(AthlyTheme.Color.textSecondary)
        + Text("Termos de Uso e Política de Privacidade").foregroundColor(AthlyTheme.Color.primary)
        + Text(" da Athly").foregroundColor(AthlyTheme.Color.textSecondary))
        .font(AthlyTheme.Typography.body(10))
    }

    private func authField<Content: View>(label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label.uppercased())
                .font(AthlyTheme.Typography.label())
                .foregroundStyle(AthlyTheme.Color.textTertiary)
                .kerning(0.8)
            content()
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

    private var authDivider: some View {
        HStack(spacing: 10) {
            Rectangle().fill(AthlyTheme.Color.borderMid).frame(height: 1)
            Text("ou")
                .font(AthlyTheme.Typography.body(10))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
                .fixedSize()
                .kerning(0.5)
                .textCase(.uppercase)
            Rectangle().fill(AthlyTheme.Color.borderMid).frame(height: 1)
        }
    }
}
