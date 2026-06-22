import SwiftUI

/// Privacy Policy screen. The content is served from the web so it stays a single
/// source of truth (also used as the App Store Connect "Privacy Policy URL").
struct PrivacyPolicyView: View {
    private let url = URL(string: "https://athlyproject.app/privacy")!

    var body: some View {
        AthlyWebView(url: url)
            .navigationTitle("Política de Privacidade")
            .navigationBarTitleDisplayMode(.inline)
    }
}
