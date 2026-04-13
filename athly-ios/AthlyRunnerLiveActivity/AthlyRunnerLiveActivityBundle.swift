import WidgetKit
import SwiftUI

@main
struct AthlyRunnerLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        // Live Activities requerem dispositivo físico com iOS 16.2+.
        // No simulador, o SpringBoard não suporta ActivityKit e Xcode tentaria
        // exibir o widget automaticamente ao instalar o app, causando erros no console.
        #if !targetEnvironment(simulator)
        AthlyRunnerLiveActivityWidget()
        #endif
    }
}
