import SwiftUI
import MapKit

/// iOS 16 compatible static map view for run summaries with polyline and start/end markers.
struct SummaryMapView: UIViewRepresentable {
    let coordinates: [CLLocationCoordinate2D]

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView()
        mapView.delegate = context.coordinator
        mapView.isScrollEnabled = false
        mapView.isZoomEnabled = false
        mapView.isRotateEnabled = false
        mapView.isPitchEnabled = false
        mapView.pointOfInterestFilter = .excludingAll
        return mapView
    }

    func updateUIView(_ mapView: MKMapView, context: Context) {
        mapView.removeOverlays(mapView.overlays)
        mapView.removeAnnotations(mapView.annotations)

        guard coordinates.count >= 2 else { return }

        let polyline = MKPolyline(coordinates: coordinates, count: coordinates.count)
        mapView.addOverlay(polyline)

        // Start marker (green)
        if let first = coordinates.first {
            let start = MarkerAnnotation(coordinate: first, markerType: .start)
            mapView.addAnnotation(start)
        }

        // End marker (red)
        if let last = coordinates.last {
            let end = MarkerAnnotation(coordinate: last, markerType: .end)
            mapView.addAnnotation(end)
        }

        // Fit map to polyline
        let rect = polyline.boundingMapRect
        let insets = UIEdgeInsets(top: 20, left: 20, bottom: 20, right: 20)
        mapView.setVisibleMapRect(rect, edgePadding: insets, animated: false)
    }

    final class Coordinator: NSObject, MKMapViewDelegate {
        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            if let polyline = overlay as? MKPolyline {
                let renderer = MKPolylineRenderer(polyline: polyline)
                renderer.strokeColor = UIColor(AthlyTheme.Color.secondaryNeon)
                renderer.lineWidth = 3
                return renderer
            }
            return MKOverlayRenderer(overlay: overlay)
        }

        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            guard let marker = annotation as? MarkerAnnotation else { return nil }

            let identifier = marker.markerType == .start ? "StartMarker" : "EndMarker"
            let view = mapView.dequeueReusableAnnotationView(withIdentifier: identifier)
                ?? MKAnnotationView(annotation: annotation, reuseIdentifier: identifier)
            view.annotation = annotation
            view.canShowCallout = false

            let color: UIColor = marker.markerType == .start
                ? UIColor(AthlyTheme.Color.success)
                : UIColor(AthlyTheme.Color.error)

            let size: CGFloat = 10
            let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
            view.image = renderer.image { ctx in
                color.setFill()
                UIBezierPath(ovalIn: CGRect(x: 0, y: 0, width: size, height: size)).fill()
            }
            view.centerOffset = .zero

            return view
        }
    }
}

private final class MarkerAnnotation: NSObject, MKAnnotation {
    enum MarkerType { case start, end }

    let coordinate: CLLocationCoordinate2D
    let markerType: MarkerType

    init(coordinate: CLLocationCoordinate2D, markerType: MarkerType) {
        self.coordinate = coordinate
        self.markerType = markerType
    }
}
