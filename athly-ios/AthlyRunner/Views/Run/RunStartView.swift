import SwiftUI

struct RunStartView: View {
    @EnvironmentObject var locationManager: LocationManager
    @StateObject private var viewModel: RunViewModel

    init() {
        _viewModel = StateObject(wrappedValue: RunViewModel(locationManager: LocationManager()))
    }

    @State private var isInitialized = false

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isActive {
                    RunTrackingView(viewModel: viewModel)
                } else if viewModel.showSummary {
                    RunSummaryView(viewModel: viewModel)
                } else {
                    preRunView
                }
            }
            .navigationTitle(viewModel.isActive ? "" : "Correr")
            .navigationBarTitleDisplayMode(.inline)
        }
        .onAppear {
            if !isInitialized {
                viewModel.updateLocationManager(locationManager)
                isInitialized = true
            }
        }
    }

    private var preRunView: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark
                .ignoresSafeArea()

            // Ambient top-left purple
            RadialGradient(
                colors: [AthlyTheme.Color.primary.opacity(0.20), Color.clear],
                center: .init(x: 0.2, y: 0.1),
                startRadius: 0,
                endRadius: 300
            )
            .ignoresSafeArea()

            // Ambient bottom-right cyan
            RadialGradient(
                colors: [AthlyTheme.Color.secondary.opacity(0.12), Color.clear],
                center: .init(x: 0.85, y: 0.9),
                startRadius: 0,
                endRadius: 250
            )
            .ignoresSafeArea()

            VStack(spacing: AthlyTheme.Spacing.lg) {
                Spacer()

                if !locationManager.hasPermission {
                    permissionView
                } else {
                    readyView
                }

                Spacer()
            }
        }
    }

    private var permissionView: some View {
        VStack(spacing: 20) {
            Image(systemName: "location.slash.circle.fill")
                .font(.system(size: 64))
                .foregroundStyle(AthlyTheme.Color.warning)

            Text("Permissao de localizacao necessaria")
                .font(AthlyTheme.Typography.semibold(20))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
                .multilineTextAlignment(.center)

            Text("Para rastrear sua corrida, precisamos acessar sua localizacao.")
                .font(AthlyTheme.Typography.body(15))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            Button("Permitir localizacao") {
                locationManager.requestAlwaysPermission()
            }
            .buttonStyle(AthlyPrimaryButtonStyle())
            .padding(.horizontal, 40)
        }
    }

    private var readyView: some View {
        VStack(spacing: 40) {
            VStack(spacing: 8) {
                Image(systemName: "figure.run")
                    .font(.system(size: 64))
                    .foregroundStyle(AthlyTheme.Color.primary)
                    .shadow(color: AthlyTheme.Color.primary.opacity(0.5), radius: 20)

                Text("Pronto para correr?")
                    .font(AthlyTheme.Typography.heading(22))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
            }

            Button {
                viewModel.startRun()
            } label: {
                ZStack {
                    Circle()
                        .fill(AthlyTheme.Gradient.neon)
                        .frame(width: 130, height: 130)
                        .shadow(color: AthlyTheme.Color.primary.opacity(0.6), radius: 24, y: 8)

                    Circle()
                        .stroke(AthlyTheme.Color.primaryNeon.opacity(0.3), lineWidth: 2)
                        .frame(width: 148, height: 148)

                    Text("INICIAR")
                        .font(AthlyTheme.Typography.heading(18))
                        .foregroundStyle(.white)
                }
            }
        }
    }
}

// Extension to allow updating locationManager after init
extension RunViewModel {
    func updateLocationManager(_ manager: LocationManager) {
        self.tracker = RunTracker(locationManager: manager)
    }
}
