import Foundation
import CoreLocation
import Combine

@MainActor
final class LocationManager: NSObject, ObservableObject {
    private let manager = CLLocationManager()

    @Published var currentLocation: CLLocation?
    @Published var authorizationStatus: CLAuthorizationStatus = .notDetermined
    @Published var locationError: String?

    /// Fluxo ordenado de TODOS os pontos aceitos (não coalesce como `$currentLocation`).
    /// O tracker assina isto para não perder os pontos que o iOS entrega em lote ao
    /// desbloquear a tela. `currentLocation` continua sendo o último ponto (mapa pré-corrida).
    let locationUpdates = PassthroughSubject<CLLocation, Never>()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        manager.distanceFilter = 5 // meters
        manager.activityType = .fitness
        manager.allowsBackgroundLocationUpdates = true
        manager.pausesLocationUpdatesAutomatically = false
        manager.showsBackgroundLocationIndicator = true
    }

    func requestPermission() {
        guard manager.authorizationStatus == .notDetermined else { return }
        manager.requestWhenInUseAuthorization()
    }

    func requestAlwaysPermission() {
        let status = manager.authorizationStatus
        guard status == .notDetermined || status == .authorizedWhenInUse else { return }
        manager.requestAlwaysAuthorization()
    }

    func startTracking() {
        manager.startUpdatingLocation()
    }

    func stopTracking() {
        manager.stopUpdatingLocation()
    }

    var hasPermission: Bool {
        authorizationStatus == .authorizedWhenInUse || authorizationStatus == .authorizedAlways
    }
}

extension LocationManager: CLLocationManagerDelegate {
    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        // O iOS pode entregar vários pontos de uma vez (ex.: lote acumulado enquanto a
        // tela ficou bloqueada). Processamos TODOS em ordem cronológica, mantendo só os
        // de boa precisão — em vez de descartar os intermediários pegando só `.last`.
        // Corte em 50m (não 30m): descartar pontos inteiros cria buracos na trajetória
        // que viram distância em linha reta (split mais lento que o real); o filtro de
        // velocidade implausível no consumidor já segura os teleportes dos pontos ruins.
        let valid = locations
            .filter { $0.horizontalAccuracy >= 0 && $0.horizontalAccuracy < 50 }
            .sorted { $0.timestamp < $1.timestamp }
        guard !valid.isEmpty else { return }

        Task { @MainActor in
            for location in valid {
                self.currentLocation = location
                self.locationUpdates.send(location)
            }
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            self.authorizationStatus = status
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            self.locationError = error.localizedDescription
        }
    }
}
