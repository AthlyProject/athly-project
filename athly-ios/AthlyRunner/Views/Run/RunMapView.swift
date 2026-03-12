import SwiftUI
import MapKit

struct RunMapView: View {
    let coordinates: [CLLocationCoordinate2D]
    let isTracking: Bool

    @State private var cameraPosition: MapCameraPosition = .userLocation(fallback: .automatic)

    var body: some View {
        Map(position: $cameraPosition) {
            // User location
            UserAnnotation()

            // Route polyline — cyan neon
            if coordinates.count >= 2 {
                MapPolyline(coordinates: coordinates)
                    .stroke(AthlyTheme.Color.secondaryNeon, lineWidth: 4)
            }

            // Start marker
            if let first = coordinates.first {
                Annotation("Inicio", coordinate: first) {
                    ZStack {
                        Circle()
                            .fill(AthlyTheme.Color.success)
                            .frame(width: 16, height: 16)
                        Circle()
                            .stroke(.white, lineWidth: 2)
                            .frame(width: 16, height: 16)
                    }
                }
            }
        }
        .mapStyle(.standard(emphasis: .muted))
        .mapControls {
            MapUserLocationButton()
            MapCompass()
        }
        .onChange(of: coordinates.count) { _, _ in
            if isTracking, let last = coordinates.last {
                withAnimation(.easeInOut(duration: 0.5)) {
                    cameraPosition = .region(MKCoordinateRegion(
                        center: last,
                        latitudinalMeters: 300,
                        longitudinalMeters: 300
                    ))
                }
            }
        }
    }
}
