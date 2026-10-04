import SwiftUI

/// Documentos legais publicados no site (fonte única: athly-frontend/src/config/legalContent.ts).
enum LegalDocument: String, Identifiable, CaseIterable {
    case terms
    case privacy

    var id: String { rawValue }

    var url: URL {
        switch self {
        case .terms: return URL(string: "https://athlyproject.app/terms")!
        case .privacy: return URL(string: "https://athlyproject.app/privacy")!
        }
    }

    var title: LocalizedStringKey {
        switch self {
        case .terms: return "Termos de Uso"
        case .privacy: return "Política de Privacidade"
        }
    }

    init?(url: URL) {
        guard let match = Self.allCases.first(where: { $0.url.path == url.path && $0.url.host == url.host }) else {
            return nil
        }
        self = match
    }
}

// MARK: - Links in-app

/// Abre os links dos documentos legais (em `Text` com markdown) numa folha com o web view do
/// app, em vez de sair para o Safari. Outros links seguem o comportamento padrão.
private struct LegalDocumentLinksModifier: ViewModifier {
    @State private var openDocument: LegalDocument?

    func body(content: Content) -> some View {
        content
            .tint(AthlyTheme.Color.primary)
            .environment(\.openURL, OpenURLAction { url in
                guard let document = LegalDocument(url: url) else { return .systemAction }
                openDocument = document
                return .handled
            })
            .sheet(item: $openDocument) { document in
                NavigationStack {
                    AthlyWebView(url: document.url)
                        .navigationTitle(document.title)
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbar {
                            ToolbarItem(placement: .confirmationAction) {
                                Button("Fechar") { openDocument = nil }
                            }
                        }
                }
            }
    }
}

extension View {
    func legalDocumentLinks() -> some View {
        modifier(LegalDocumentLinksModifier())
    }
}

// MARK: - Checkboxes

/// Os dois aceites obrigatórios e independentes (Termos, Privacidade), cada um com link para o
/// documento.
struct LegalConsentChecklist: View {
    @Binding var termsAccepted: Bool
    @Binding var privacyAccepted: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            row(
                isOn: $termsAccepted,
                text: Text("Li e aceito os [Termos de Uso](https://athlyproject.app/terms) da Athly")
            )
            row(
                isOn: $privacyAccepted,
                text: Text("Li e aceito a [Política de Privacidade](https://athlyproject.app/privacy) da Athly")
            )
        }
        .legalDocumentLinks()
    }

    private func row(isOn: Binding<Bool>, text: Text) -> some View {
        HStack(alignment: .top, spacing: 9) {
            Button { isOn.wrappedValue.toggle() } label: {
                ZStack {
                    RoundedRectangle(cornerRadius: 5, style: .continuous)
                        .fill(isOn.wrappedValue ? AthlyTheme.Color.primarySoft : .clear)
                        .overlay(
                            RoundedRectangle(cornerRadius: 5, style: .continuous)
                                .stroke(
                                    isOn.wrappedValue ? AthlyTheme.Color.primaryBorder : AthlyTheme.Color.borderMid,
                                    lineWidth: 2
                                )
                        )
                        .frame(width: 18, height: 18)
                    if isOn.wrappedValue {
                        Image(systemName: "checkmark")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(AthlyTheme.Color.primary)
                    }
                }
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(isOn.wrappedValue ? .isSelected : [])
            .padding(.top, 1)

            text
                .font(AthlyTheme.Typography.body(11))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - Tela de aceite

/// Aceite explícito de Termos + Privacidade fora do cadastro por email: contas sem aceite
/// registrado (ou de uma versão antiga dos documentos) e login social que criaria uma conta nova.
struct LegalConsentView: View {
    let subtitle: LocalizedStringKey
    let cancelTitle: LocalizedStringKey
    let onAccept: () async -> Void
    let onCancel: () -> Void

    @EnvironmentObject var authViewModel: AuthViewModel
    @State private var termsAccepted = false
    @State private var privacyAccepted = false
    @State private var isSubmitting = false

    private var canContinue: Bool { termsAccepted && privacyAccepted && !isSubmitting }

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark.ignoresSafeArea()
            RadialGradient(
                colors: [AthlyTheme.Color.primary.opacity(0.12), .clear],
                center: .top, startRadius: 0, endRadius: 300
            )
            .ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Image(systemName: "doc.text.magnifyingglass")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(AthlyTheme.Color.primary)
                        .frame(width: 46, height: 46)
                        .background(AthlyTheme.Color.primarySoft)
                        .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                        .padding(.top, 32)
                        .padding(.bottom, 16)

                    Text("Termos e Privacidade")
                        .font(AthlyTheme.Typography.heading(20))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                        .padding(.bottom, 6)

                    Text(subtitle)
                        .font(AthlyTheme.Typography.body(12))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.bottom, 20)

                    LegalConsentChecklist(termsAccepted: $termsAccepted, privacyAccepted: $privacyAccepted)
                        .padding(.bottom, 18)

                    if let error = authViewModel.errorMessage {
                        Text(error)
                            .font(AthlyTheme.Typography.body(12))
                            .foregroundStyle(AthlyTheme.Color.error)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.bottom, 8)
                    }

                    Button {
                        Task {
                            isSubmitting = true
                            await onAccept()
                            isSubmitting = false
                        }
                    } label: {
                        Group {
                            if isSubmitting {
                                ProgressView().tint(.white).scaleEffect(0.85)
                            } else {
                                Text("Aceitar e continuar")
                                    .font(AthlyTheme.Typography.semibold(14))
                            }
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(AthlyTheme.Gradient.brand)
                        .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
                        .opacity(canContinue ? 1 : 0.55)
                    }
                    .buttonStyle(.plain)
                    .disabled(!canContinue)
                    .padding(.bottom, 10)

                    Button(cancelTitle, action: onCancel)
                        .font(AthlyTheme.Typography.semibold(12))
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                        .buttonStyle(.plain)
                        .frame(maxWidth: .infinity)
                        .disabled(isSubmitting)
                        .padding(.bottom, 28)
                }
                .padding(.horizontal, 20)
            }
        }
        .onAppear { authViewModel.errorMessage = nil }
    }
}
