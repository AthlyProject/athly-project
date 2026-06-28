import SwiftUI
import CoreLocation

/// Desenha o traçado GPS de uma corrida como um `Path`, normalizado para caber no rect
/// mantendo a proporção real. Sem MapKit — é só a "assinatura" da rota, para a marca d'água
/// (template "Assinatura de Rota"). Compensa o encolhimento da longitude com a latitude
/// (projeção equiretangular simples) para o traço não ficar achatado.
struct RouteTraceShape: Shape {
    let coordinates: [CLLocationCoordinate2D]

    func path(in rect: CGRect) -> Path {
        var path = Path()
        guard coordinates.count >= 2 else { return path }

        let lats = coordinates.map(\.latitude)
        let lons = coordinates.map(\.longitude)
        guard let minLat = lats.min(), let maxLat = lats.max(),
              let minLon = lons.min(), let maxLon = lons.max() else { return path }

        let latRange = max(maxLat - minLat, 1e-9)
        let lonRange = max(maxLon - minLon, 1e-9)

        // Correção de aspecto: 1° de longitude vale menos que 1° de latitude longe do equador.
        let midLatRad = ((minLat + maxLat) / 2) * .pi / 180
        let lonScale = max(cos(midLatRad), 0.01)

        let geoW = lonRange * lonScale
        let geoH = latRange

        let pad: CGFloat = 6
        let availW = max(rect.width - pad * 2, 1)
        let availH = max(rect.height - pad * 2, 1)
        let scale = min(availW / geoW, availH / geoH)

        let drawW = geoW * scale
        let drawH = geoH * scale
        let offsetX = rect.minX + pad + (availW - drawW) / 2
        let offsetY = rect.minY + pad + (availH - drawH) / 2

        func point(_ c: CLLocationCoordinate2D) -> CGPoint {
            let x = offsetX + (c.longitude - minLon) * lonScale * scale
            let y = offsetY + (maxLat - c.latitude) * scale  // y invertido: norte para cima
            return CGPoint(x: x, y: y)
        }

        path.move(to: point(coordinates[0]))
        for coord in coordinates.dropFirst() {
            path.addLine(to: point(coord))
        }
        return path
    }
}
