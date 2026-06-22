import SwiftUI
import UIKit

/// Minimal in-app support screen: a way to reach support by email and the app version.
/// The richer, web-hosted version (athlyproject.app/support) backs the App Store
/// Connect "Support URL".
struct SupportView: View {
    private let supportEmail = "support@athlyproject.app"
    private let websiteURL = URL(string: "https://athlyproject.app")!

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark
                .ignoresSafeArea()

            List {
                Section {
                    Button {
                        openSupportEmail()
                    } label: {
                        HStack {
                            Image(systemName: "envelope.fill")
                                .foregroundStyle(AthlyTheme.Color.primary)
                                .frame(width: 28)
                            Text("Falar com suporte")
                                .font(AthlyTheme.Typography.body())
                                .foregroundStyle(AthlyTheme.Color.textPrimary)
                            Spacer()
                            Text(supportEmail)
                                .font(AthlyTheme.Typography.medium(14))
                                .foregroundStyle(AthlyTheme.Color.textTertiary)
                        }
                    }
                    .listRowBackground(AthlyTheme.Color.surfaceDark)
                } header: {
                    Text("Contato")
                } footer: {
                    Text("Normalmente respondemos em até 2 dias úteis.")
                }

                Section("Sobre o app") {
                    HStack {
                        Text("Versão")
                            .font(AthlyTheme.Typography.body())
                            .foregroundStyle(AthlyTheme.Color.textPrimary)
                        Spacer()
                        Text(Bundle.main.appVersionDisplay)
                            .font(AthlyTheme.Typography.medium(16))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                    }
                    .listRowBackground(AthlyTheme.Color.surfaceDark)

                    Link(destination: websiteURL) {
                        HStack {
                            Image(systemName: "globe")
                                .foregroundStyle(AthlyTheme.Color.primary)
                                .frame(width: 28)
                            Text("Site oficial")
                                .font(AthlyTheme.Typography.body())
                                .foregroundStyle(AthlyTheme.Color.textPrimary)
                            Spacer()
                            Image(systemName: "arrow.up.right")
                                .font(.system(size: 12))
                                .foregroundStyle(AthlyTheme.Color.textTertiary)
                        }
                    }
                    .listRowBackground(AthlyTheme.Color.surfaceDark)
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
        }
        .navigationTitle("Suporte")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Actions

    /// Opens the user's mail client with the support address and a prefilled
    /// body containing app/device info to speed up triage.
    private func openSupportEmail() {
        let body = "\n\n---\nApp: Athly Runner \(Bundle.main.appVersionDisplay)"
            + "\nDispositivo: \(UIDevice.current.systemName) \(UIDevice.current.systemVersion)"

        var components = URLComponents()
        components.scheme = "mailto"
        components.path = supportEmail
        components.queryItems = [
            URLQueryItem(name: "subject", value: "Suporte Athly Runner"),
            URLQueryItem(name: "body", value: body),
        ]

        if let url = components.url {
            UIApplication.shared.open(url)
        }
    }
}

// MARK: - Bundle app version helper

extension Bundle {
    /// Marketing version plus build, e.g. "1.0.0 (12)" — or just "1.0.0" when they match.
    var appVersionDisplay: String {
        let version = infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
        let build = infoDictionary?["CFBundleVersion"] as? String
        if let build, !build.isEmpty, build != version {
            return "\(version) (\(build))"
        }
        return version
    }
}
