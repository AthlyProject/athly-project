import SwiftUI
import MapKit
import UIKit

struct RunStartView: View {
    @EnvironmentObject var locationManager: LocationManager
    @StateObject private var viewModel: RunViewModel
    @Binding var isRunInProgress: Bool
    @Binding var pendingWorkoutId: String?

    init(isRunInProgress: Binding<Bool> = .constant(false), pendingWorkoutId: Binding<String?> = .constant(nil)) {
        _viewModel = StateObject(wrappedValue: RunViewModel(locationManager: LocationManager()))
        _isRunInProgress = isRunInProgress
        _pendingWorkoutId = pendingWorkoutId
    }

    @State private var isInitialized = false
    @State private var showLiveActivityAlert = false

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
        .alert("Live Activities desativadas", isPresented: $showLiveActivityAlert) {
            Button("Abrir Ajustes") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            Button("OK", role: .cancel) {}
        } message: {
            Text("Para acompanhar sua corrida na tela de bloqueio, ative Live Activities em Ajustes > Athly Runner > Live Activities.")
        }
        .onChange(of: viewModel.tracker.liveActivityDisabled) { disabled in
            if disabled {
                showLiveActivityAlert = true
                viewModel.tracker.liveActivityDisabled = false
            }
        }
        .onAppear {
            if !isInitialized {
                viewModel.updateLocationManager(locationManager)
                isInitialized = true
            }
            // Sync pending workout context from dashboard
            if let workoutId = pendingWorkoutId {
                viewModel.pendingWorkoutId = workoutId
                pendingWorkoutId = nil
            }
        }
        .onChange(of: viewModel.isActive) { active in
            isRunInProgress = active || viewModel.showSummary
        }
        .onChange(of: viewModel.showSummary) { summary in
            isRunInProgress = viewModel.isActive || summary
        }
    }

    // MARK: - Pre-run view with location map snapshot

    private var preRunView: some View {
        ZStack {
            // Static map showing user's current location
            if let location = locationManager.currentLocation {
                LocationSnapshotMap(coordinate: location.coordinate)
                    .ignoresSafeArea()
            } else {
                AthlyTheme.Color.backgroundDark
                    .ignoresSafeArea()
            }

            // Dark overlay for readability
            LinearGradient(
                colors: [
                    Color.black.opacity(0.3),
                    Color.black.opacity(0.6),
                    Color.black.opacity(0.85)
                ],
                startPoint: .top,
                endPoint: .bottom
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
        .onAppear {
            // Request location early so map can show user position
            if locationManager.hasPermission {
                locationManager.startTracking()
            }
        }
        .onDisappear {
            // Stop tracking when leaving pre-run (tracking restarts in RunTracker.start())
            if !viewModel.isActive {
                locationManager.stopTracking()
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
            // Location info
            VStack(spacing: 8) {
                if locationManager.currentLocation != nil {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(AthlyTheme.Color.success)
                            .frame(width: 8, height: 8)
                        Text("GPS ativo")
                            .font(AthlyTheme.Typography.body(14))
                            .foregroundStyle(AthlyTheme.Color.success)
                    }
                } else {
                    HStack(spacing: 6) {
                        ProgressView()
                            .scaleEffect(0.7)
                            .tint(AthlyTheme.Color.warning)
                        Text("Buscando GPS...")
                            .font(AthlyTheme.Typography.body(14))
                            .foregroundStyle(AthlyTheme.Color.warning)
                    }
                }

                Text("Pronto para correr?")
                    .font(AthlyTheme.Typography.heading(26))
                    .foregroundStyle(.white)
            }

            // Start button
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
            .disabled(locationManager.currentLocation == nil)
            .opacity(locationManager.currentLocation == nil ? 0.5 : 1.0)
        }
    }
}

// MARK: - Static map centered on user location

private struct LocationSnapshotMap: UIViewRepresentable {
    let coordinate: CLLocationCoordinate2D

    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView()
        mapView.isScrollEnabled = false
        mapView.isZoomEnabled = false
        mapView.isRotateEnabled = false
        mapView.isPitchEnabled = false
        mapView.showsUserLocation = true
        mapView.pointOfInterestFilter = .excludingAll
        return mapView
    }

    func updateUIView(_ mapView: MKMapView, context: Context) {
        let region = MKCoordinateRegion(
            center: coordinate,
            latitudinalMeters: 400,
            longitudinalMeters: 400
        )
        mapView.setRegion(region, animated: false)
    }
}

// Extension to allow updating locationManager after init
extension RunViewModel {
    func updateLocationManager(_ manager: LocationManager) {
        self.tracker = RunTracker(locationManager: manager)
        bindTracker()
    }
}
