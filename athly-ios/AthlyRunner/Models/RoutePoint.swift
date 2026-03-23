import Foundation
import CoreLocation

struct RoutePoint: Identifiable, Codable {
    let id: UUID
    let latitude: Double
    let longitude: Double
    let altitude: Double
    let timestamp: Date
    let speed: Double
    let horizontalAccuracy: Double

    init(location: CLLocation) {
        self.id = UUID()
        self.latitude = location.coordinate.latitude
        self.longitude = location.coordinate.longitude
        self.altitude = location.altitude
        self.timestamp = location.timestamp
        self.speed = max(0, location.speed)
        self.horizontalAccuracy = location.horizontalAccuracy
    }

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    func toCLLocation() -> CLLocation {
        CLLocation(
            coordinate: coordinate,
            altitude: altitude,
            horizontalAccuracy: horizontalAccuracy,
            verticalAccuracy: -1,
            timestamp: timestamp
        )
    }
}
