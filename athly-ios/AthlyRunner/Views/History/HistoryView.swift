import SwiftUI

/// Histórico de corridas lido do Apple Health (fonte da verdade). Inclui treinos de qualquer
/// origem (Apple Watch, outros apps) e sobrevive a reinstalação do app.
struct HistoryView: View {
    var body: some View {
        NavigationStack {
            HealthKitRunsView(title: "Histórico")
        }
    }
}
