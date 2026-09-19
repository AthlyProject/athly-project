import SwiftUI
import AuthenticationServices

/// Contas conectadas (design v2): estados vinculado / disponível para vincular.
/// Só permite desvincular um provedor se sobrar outra forma de entrar (senha ou o outro provedor).
struct ConnectedAccountsView: View {
    let profile: UserProfile?
    let onProfileChanged: (UserProfile) -> Void

    @EnvironmentObject var authViewModel: AuthViewModel

    @State private var currentProfile: UserProfile?
    @State private var isLinkingApple = false
    @State private var appleLinkError: String?
    @State private var isLinkingGoogle = false
    @State private var googleLinkError: String?

    init(profile: UserProfile?, onProfileChanged: @escaping (UserProfile) -> Void) {
        self.profile = profile
        self.onProfileChanged = onProfileChanged
        _currentProfile = State(initialValue: profile)
    }

    private var appleLinked: Bool { currentProfile?.appleLinked == true }
    private var googleLinked: Bool { currentProfile?.googleLinked == true }

    var body: some View {
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
                VStack(spacing: 6) {
                    Text("Vincule provedores para entrar de mais de uma forma. Você só pode desvincular se sobrar outra credencial ativa.")
                        .font(AthlyTheme.Typography.body(12))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 2)
                        .padding(.bottom, 2)

                    if appleLinked || googleLinked {
                        AthlySectionLabel("Vinculada")
                        AthlyListGroup {
                            if appleLinked {
                                linkedRow(
                                    systemImage: "applelogo",
                                    tint: .black,
                                    background: .white,
                                    name: Text("Apple"),
                                    isWorking: isLinkingApple,
                                    canUnlink: canUnlinkApple,
                                    unlink: { Task { await unlinkApple() } }
                                )
                            }
                            if appleLinked && googleLinked {
                                AthlyRowDivider()
                            }
                            if googleLinked {
                                linkedRow(
                                    systemImage: "g.circle.fill",
                                    tint: AthlyTheme.Color.primary,
                                    background: AthlyTheme.Color.backgroundAlt,
                                    name: Text("Google"),
                                    isWorking: isLinkingGoogle,
                                    canUnlink: canUnlinkGoogle,
                                    unlink: { Task { await unlinkGoogle() } }
                                )
                            }
                        }
                    }

                    if let appleLinkError {
                        errorText(appleLinkError)
                    }
                    if let googleLinkError {
                        errorText(googleLinkError)
                    }

                    if !appleLinked || !googleLinked {
                        AthlySectionLabel("Disponível para vincular")

                        if !appleLinked {
                            AthlyListGroup {
                                AthlyListRow(
                                    systemImage: "applelogo",
                                    tint: .black,
                                    iconBackground: .white,
                                    title: Text("Apple"),
                                    subtitle: Text("Não vinculada")
                                ) {
                                    if isLinkingApple {
                                        ProgressView()
                                            .tint(AthlyTheme.Color.primary)
                                            .scaleEffect(0.8)
                                    }
                                }

                                appleLinkButton
                                    .padding(.horizontal, 13)
                                    .padding(.bottom, 13)
                            }
                        }

                        if !googleLinked {
                            AthlyListGroup {
                                AthlyListRow(
                                    systemImage: "g.circle.fill",
                                    tint: AthlyTheme.Color.primary,
                                    iconBackground: AthlyTheme.Color.backgroundAlt,
                                    title: Text("Google"),
                                    subtitle: Text("Não vinculada")
                                ) {
                                    if isLinkingGoogle {
                                        ProgressView()
                                            .tint(AthlyTheme.Color.primary)
                                            .scaleEffect(0.8)
                                    }
                                }

                                AthlyWideButton(
                                    background: AnyShapeStyle(AthlyTheme.Color.backgroundAlt),
                                    action: { Task { await linkGoogle() } }
                                ) {
                                    Image(systemName: "g.circle.fill")
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundStyle(AthlyTheme.Color.primary)
                                    Text("Vincular conta Google")
                                }
                                .disabled(isLinkingGoogle)
                                .padding(.horizontal, 13)
                                .padding(.bottom, 13)
                            }
                        }
                    }
                }
                .padding(AthlyTheme.Spacing.sm)
            }
            .scrollContentBackground(.hidden)
            .athlyTabBarContentClearance()
        }
        .navigationTitle("Contas conectadas")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadProfileIfNeeded() }
    }

    // MARK: - Blocos

    private func linkedRow(
        systemImage: String,
        tint: Color,
        background: Color,
        name: Text,
        isWorking: Bool,
        canUnlink: Bool,
        unlink: @escaping () -> Void
    ) -> some View {
        AthlyListRow(
            systemImage: systemImage,
            tint: tint,
            iconBackground: background,
            title: name,
            subtitle: Text("● " + String(localized: "Conta vinculada")),
            subtitleColor: AthlyTheme.Color.success
        ) {
            if isWorking {
                ProgressView()
                    .tint(AthlyTheme.Color.primary)
                    .scaleEffect(0.8)
            } else if canUnlink {
                Button(action: unlink) {
                    Text("Desvincular")
                        .font(AthlyTheme.Typography.semibold(11))
                        .foregroundStyle(AthlyTheme.Color.error)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .overlay(
                            Capsule().stroke(AthlyTheme.Color.error.opacity(0.35), lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var appleLinkButton: some View {
        SignInWithAppleButton(.continue) { request in
            request.requestedScopes = [.fullName, .email]
        } onCompletion: { result in
            switch result {
            case .success(let auth):
                guard let credential = auth.credential as? ASAuthorizationAppleIDCredential else { return }
                Task { await linkApple(credential: credential) }
            case .failure(let error):
                if (error as? ASAuthorizationError)?.code != .canceled {
                    Task { @MainActor in appleLinkError = error.localizedDescription }
                }
            }
        }
        .signInWithAppleButtonStyle(.white)
        .frame(height: 44)
        .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous))
        .disabled(isLinkingApple)
    }

    private func errorText(_ message: String) -> some View {
        Text(message)
            .font(AthlyTheme.Typography.body(11))
            .foregroundStyle(AthlyTheme.Color.error)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 2)
    }

    private var canUnlinkApple: Bool {
        currentProfile?.hasPassword == true || googleLinked
    }

    private var canUnlinkGoogle: Bool {
        currentProfile?.hasPassword == true || appleLinked
    }

    // MARK: - Ações

    private func loadProfileIfNeeded() async {
        guard currentProfile == nil else { return }
        if let loaded = try? await APIClient.shared.getUserProfile() {
            apply(loaded)
        }
    }

    private func apply(_ profile: UserProfile) {
        currentProfile = profile
        onProfileChanged(profile)
    }

    private func linkApple(credential: ASAuthorizationAppleIDCredential) async {
        guard let tokenData = credential.identityToken,
              let identityToken = String(data: tokenData, encoding: .utf8) else {
            appleLinkError = String(localized: "Não foi possível obter as credenciais da Apple.")
            return
        }
        isLinkingApple = true
        appleLinkError = nil
        do {
            apply(try await APIClient.shared.linkApple(identityToken: identityToken))
        } catch {
            appleLinkError = error.localizedDescription
        }
        isLinkingApple = false
    }

    private func unlinkApple() async {
        isLinkingApple = true
        appleLinkError = nil
        do {
            apply(try await APIClient.shared.unlinkApple())
        } catch {
            appleLinkError = error.localizedDescription
        }
        isLinkingApple = false
    }

    private func linkGoogle() async {
        isLinkingGoogle = true
        googleLinkError = nil
        do {
            // nil = usuário cancelou a folha do Google.
            guard let idToken = try await authViewModel.acquireGoogleIdToken() else {
                isLinkingGoogle = false
                return
            }
            apply(try await APIClient.shared.linkGoogle(idToken: idToken))
        } catch {
            googleLinkError = error.localizedDescription
        }
        isLinkingGoogle = false
    }

    private func unlinkGoogle() async {
        isLinkingGoogle = true
        googleLinkError = nil
        do {
            apply(try await APIClient.shared.unlinkGoogle())
        } catch {
            googleLinkError = error.localizedDescription
        }
        isLinkingGoogle = false
    }
}
