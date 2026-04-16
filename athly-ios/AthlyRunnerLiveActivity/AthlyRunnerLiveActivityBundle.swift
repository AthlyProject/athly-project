import OSLog
import WidgetKit
import SwiftUI

private let bundleLogger = Logger(subsystem: "com.athly.runner.liveactivity", category: "Bundle")

@main
struct AthlyRunnerLiveActivityBundle: WidgetBundle {
    init() {
        bundleLogger.info("AthlyRunnerLiveActivityBundle initialized.")
    }

    var body: some Widget {
        // Live Activities requerem dispositivo físico com iOS 16.2+.
        // No simulador, o SpringBoard não suporta ActivityKit e Xcode tentaria
        // exibir o widget automaticamente ao instalar o app, causando erros no console.
        #if !targetEnvironment(simulator)
        AthlyRunnerLiveActivityWidget()
        #endif
    }
}
