import SwiftUI
import MapKit
import UIKit

struct RunStartView: View {
    @EnvironmentObject var locationManager: LocationManager
    @StateObject private var viewModel: RunViewModel
    @Binding var isRunInProgress: Bool
    @Binding var pendingWorkout: WorkoutModel?

    init(isRunInProgress: Binding<Bool> = .constant(false), pendingWorkout: Binding<WorkoutModel?> = .constant(nil)) {
        _viewModel = StateObject(wrappedValue: RunViewModel(locationManager: LocationManager()))
        _isRunInProgress = isRunInProgress
        _pendingWorkout = pendingWorkout
    }

    @State private var isInitialized = false
    @State private var showLiveActivityAlert = false
    @State private var showTargetAlertSheet = false

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
        .sheet(isPresented: $showTargetAlertSheet) {
            TargetAlertSetupSheet(alert: $viewModel.targetAlert)
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
            if let workout = pendingWorkout {
                viewModel.pendingWorkout = workout
                pendingWorkout = nil
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
            .padding(.bottom, AthlyTheme.Layout.tabBarContentBottomClearance)
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

    private var locationIsDenied: Bool {
        locationManager.authorizationStatus == .denied || locationManager.authorizationStatus == .restricted
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

            Text(locationIsDenied
                ? "Acesso a localizacao foi negado. Habilite em Ajustes > Privacidade > Localizacao > Athly."
                : "Para rastrear sua corrida, precisamos acessar sua localizacao.")
                .font(AthlyTheme.Typography.body(15))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            if locationIsDenied {
                Button("Abrir Ajustes") {
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                }
                .buttonStyle(AthlyPrimaryButtonStyle())
                .padding(.horizontal, 40)
            } else {
                Button("Permitir localizacao") {
                    locationManager.requestAlwaysPermission()
                }
                .buttonStyle(AthlyPrimaryButtonStyle())
                .padding(.horizontal, 40)
            }
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

            VStack(spacing: 22) {
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

                targetAlertButton
            }
        }
    }

    private var targetAlertButton: some View {
        Button {
            showTargetAlertSheet = true
        } label: {
            HStack(spacing: 10) {
                Image(systemName: viewModel.targetAlert == nil ? "bell.badge" : "bell.fill")
                    .font(.system(size: 16, weight: .semibold))
                VStack(alignment: .leading, spacing: 2) {
                    Text(viewModel.targetAlert == nil ? "Adicionar aviso" : "Aviso configurado")
                        .font(AthlyTheme.Typography.semibold(14))
                    if let alert = viewModel.targetAlert {
                        Text("Em \(alert.displayValue)")
                            .font(AthlyTheme.Typography.body(12))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                    }
                }
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(AthlyTheme.Color.textTertiary)
            }
            .foregroundStyle(AthlyTheme.Color.textPrimary)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(AthlyTheme.Color.surfaceCard.opacity(0.85))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(AthlyTheme.Color.primary.opacity(0.35), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

private struct TargetAlertSetupSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var alert: RunTargetAlert?

    @State private var selectedKind: RunTargetAlert.Kind
    @State private var valueText: String

    init(alert: Binding<RunTargetAlert?>) {
        _alert = alert
        let current = alert.wrappedValue
        _selectedKind = State(initialValue: current?.kind ?? .distance)
        _valueText = State(initialValue: current.map { RunTargetAlertInputFormatter.string(from: $0.value) } ?? "")
    }

    private var parsedValue: Double? {
        RunTargetAlertInputFormatter.double(from: valueText)
    }

    private var draftAlert: RunTargetAlert? {
        guard let parsedValue else { return nil }
        return RunTargetAlert(kind: selectedKind, value: parsedValue)
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 22) {
                Picker("Tipo", selection: $selectedKind) {
                    Label("Distância", systemImage: "point.topleft.down.curvedto.point.bottomright.up")
                        .tag(RunTargetAlert.Kind.distance)
                    Label("Tempo", systemImage: "timer")
                        .tag(RunTargetAlert.Kind.time)
                }
                .pickerStyle(.segmented)

                VStack(alignment: .leading, spacing: 8) {
                    Text(selectedKind == .distance ? "Distância" : "Tempo")
                        .font(AthlyTheme.Typography.semibold(15))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)

                    HStack(spacing: 10) {
                        TextField(selectedKind == .distance ? "2,5" : "20", text: $valueText)
                            .keyboardType(.decimalPad)
                            .font(.custom("SpaceGrotesk-Bold", size: 30).monospacedDigit())
                            .foregroundStyle(AthlyTheme.Color.textPrimary)

                        Text(selectedKind == .distance ? "km" : "min")
                            .font(AthlyTheme.Typography.semibold(16))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(AthlyTheme.Color.surfaceCard)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                    Text("A voz vai avisar uma única vez quando esse ponto for alcançado.")
                        .font(AthlyTheme.Typography.body(13))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }

                if let alert {
                    Button(role: .destructive) {
                        self.alert = nil
                        dismiss()
                    } label: {
                        Label("Remover aviso em \(alert.displayValue)", systemImage: "trash")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(AthlySecondaryButtonStyle())
                }

                Spacer()
            }
            .padding(20)
            .background(AthlyTheme.Color.backgroundDark.ignoresSafeArea())
            .navigationTitle("Aviso de retorno")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salvar") {
                        alert = draftAlert
                        dismiss()
                    }
                    .disabled(draftAlert == nil)
                }
            }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }
}

private enum RunTargetAlertInputFormatter {
    static func double(from string: String) -> Double? {
        let normalized = string
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ",", with: ".")
        guard let value = Double(normalized), value.isFinite, value > 0 else { return nil }
        return value
    }

    static func string(from value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "pt_BR")
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
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
