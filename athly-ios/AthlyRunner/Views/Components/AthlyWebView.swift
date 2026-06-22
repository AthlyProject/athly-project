import SwiftUI
import WebKit

/// Reusable web view that loads a remote URL with loading and error states,
/// styled to match the Athly dark theme. `mailto:`/`tel:` links and pop-ups
/// are opened in the system browser instead of inside the embedded view.
struct AthlyWebView: View {
    let url: URL

    @State private var isLoading = true
    @State private var loadFailed = false
    @State private var reloadToken = 0

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark
                .ignoresSafeArea()

            if !loadFailed {
                WebViewRepresentable(
                    url: url,
                    reloadToken: reloadToken,
                    isLoading: $isLoading,
                    loadFailed: $loadFailed
                )
                .opacity(isLoading ? 0 : 1)
            }

            if isLoading && !loadFailed {
                ProgressView()
                    .tint(AthlyTheme.Color.primary)
            }

            if loadFailed {
                errorView
            }
        }
    }

    private var errorView: some View {
        VStack(spacing: AthlyTheme.Spacing.sm) {
            Image(systemName: "wifi.slash")
                .font(.system(size: 40))
                .foregroundStyle(AthlyTheme.Color.textTertiary)

            Text("Não foi possível carregar o conteúdo")
                .font(AthlyTheme.Typography.semibold(17))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .multilineTextAlignment(.center)

            Text("Verifique sua conexão com a internet e tente novamente.")
                .font(AthlyTheme.Typography.body(14))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .multilineTextAlignment(.center)

            Button("Tentar novamente") {
                loadFailed = false
                isLoading = true
                reloadToken += 1
            }
            .buttonStyle(AthlySecondaryButtonStyle())
            .frame(maxWidth: 240)
            .padding(.top, 4)
        }
        .padding(AthlyTheme.Spacing.lg)
    }
}

// MARK: - UIViewRepresentable

private struct WebViewRepresentable: UIViewRepresentable {
    let url: URL
    let reloadToken: Int
    @Binding var isLoading: Bool
    @Binding var loadFailed: Bool

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        context.coordinator.loadedToken = reloadToken
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // Reload only when the retry button bumps the token.
        guard context.coordinator.loadedToken != reloadToken else { return }
        context.coordinator.loadedToken = reloadToken
        webView.load(URLRequest(url: url))
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        private let parent: WebViewRepresentable
        var loadedToken = -1

        init(_ parent: WebViewRepresentable) {
            self.parent = parent
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            parent.isLoading = true
            parent.loadFailed = false
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            parent.isLoading = false
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            handleFailure(error)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            handleFailure(error)
        }

        private func handleFailure(_ error: Error) {
            // Ignore "cancelled" errors triggered by a reload replacing an in-flight load.
            if (error as NSError).code == NSURLErrorCancelled { return }
            parent.isLoading = false
            parent.loadFailed = true
        }

        // Open external schemes in the system browser; keep web navigation in-app.
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            if let target = navigationAction.request.url,
               let scheme = target.scheme?.lowercased(),
               scheme == "mailto" || scheme == "tel" {
                UIApplication.shared.open(target)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}
