import SwiftUI
import MapKit

struct RunMapView: UIViewRepresentable {
    let coordinates: [CLLocationCoordinate2D]
    let isTracking: Bool

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView()
        mapView.delegate = context.coordinator
        mapView.showsUserLocation = true
        mapView.showsCompass = true
        mapView.pointOfInterestFilter = .excludingAll
        return mapView
    }

    func updateUIView(_ mapView: MKMapView, context: Context) {
        // Update route polyline
        mapView.removeOverlays(mapView.overlays)
        mapView.removeAnnotations(mapView.annotations.filter { !($0 is MKUserLocation) })

        if coordinates.count >= 2 {
            let polyline = MKPolyline(coordinates: coordinates, count: coordinates.count)
            mapView.addOverlay(polyline)
        }

        // Start marker
        if let first = coordinates.first {
            let startPin = MKPointAnnotation()
            startPin.coordinate = first
            startPin.title = "Inicio"
            mapView.addAnnotation(startPin)
        }

        // Follow user while tracking
        if isTracking, let last = coordinates.last {
            let region = MKCoordinateRegion(
                center: last,
                latitudinalMeters: 300,
                longitudinalMeters: 300
            )
            mapView.setRegion(region, animated: true)
        } else if !isTracking, let first = coordinates.first, coordinates.count <= 1 {
            let region = MKCoordinateRegion(
                center: first,
                latitudinalMeters: 500,
                longitudinalMeters: 500
            )
            mapView.setRegion(region, animated: false)
        }
    }

    final class Coordinator: NSObject, MKMapViewDelegate {
        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            if let polyline = overlay as? MKPolyline {
                let renderer = MKPolylineRenderer(polyline: polyline)
                renderer.strokeColor = UIColor(AthlyTheme.Color.secondaryNeon)
                renderer.lineWidth = 4
                return renderer
            }
            return MKOverlayRenderer(overlay: overlay)
        }

        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            guard !(annotation is MKUserLocation) else { return nil }

            let identifier = "StartPin"
            let view = mapView.dequeueReusableAnnotationView(withIdentifier: identifier)
                ?? MKAnnotationView(annotation: annotation, reuseIdentifier: identifier)
            view.annotation = annotation
            view.canShowCallout = false

            // Green circle for start
            let circle = UIView(frame: CGRect(x: 0, y: 0, width: 16, height: 16))
            circle.backgroundColor = UIColor(AthlyTheme.Color.success)
            circle.layer.cornerRadius = 8
            circle.layer.borderWidth = 2
            circle.layer.borderColor = UIColor.white.cgColor

            let renderer = UIGraphicsImageRenderer(size: CGSize(width: 16, height: 16))
            view.image = renderer.image { ctx in
                circle.layer.render(in: ctx.cgContext)
            }
            view.centerOffset = CGPoint(x: 0, y: 0)

            return view
        }
    }
}
