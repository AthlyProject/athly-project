import SwiftUI
import UIKit
import Photos

/// Compõe a foto base com a marca d'água escolhida (em resolução cheia) e cuida de salvar
/// na galeria e gerar o arquivo para compartilhamento.
@MainActor
enum WatermarkRenderer {

    /// Rende a `WatermarkOverlayView` no tamanho exato da foto e a desenha por cima. Como a
    /// overlay é dimensionada por `scale` relativo à largura, ela fica proporcional em qualquer
    /// resolução de foto.
    static func compose(photo: UIImage, style: WatermarkStyle, data: WatermarkData) -> UIImage {
        let size = photo.size
        guard size.width > 0, size.height > 0 else { return photo }

        let overlay = WatermarkOverlayView(style: style, data: data)
            .frame(width: size.width, height: size.height)

        let renderer = ImageRenderer(content: overlay)
        renderer.scale = photo.scale
        let overlayImage = renderer.uiImage

        let format = UIGraphicsImageRendererFormat()
        format.scale = photo.scale
        format.opaque = true
        let composer = UIGraphicsImageRenderer(size: size, format: format)
        return composer.image { _ in
            photo.draw(in: CGRect(origin: .zero, size: size))
            overlayImage?.draw(in: CGRect(origin: .zero, size: size))
        }
    }

    /// Garante a permissão de adição à galeria (NSPhotoLibraryAddUsageDescription).
    static func ensureAddAuthorization() async -> Bool {
        let status = PHPhotoLibrary.authorizationStatus(for: .addOnly)
        switch status {
        case .authorized, .limited:
            return true
        case .notDetermined:
            let newStatus = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
            return newStatus == .authorized || newStatus == .limited
        default:
            return false
        }
    }

    /// Salva a imagem na galeria. Lança se a permissão for negada ou a gravação falhar.
    static func saveToPhotos(_ image: UIImage) async throws {
        guard await ensureAddAuthorization() else { throw CameraError.unavailable }
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            PHPhotoLibrary.shared().performChanges {
                PHAssetChangeRequest.creationRequestForAsset(from: image)
            } completionHandler: { success, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if success {
                    continuation.resume(returning: ())
                } else {
                    continuation.resume(throwing: CameraError.captureFailed)
                }
            }
        }
    }

    /// Escreve a imagem composta num arquivo temporário (JPEG) para o `ShareLink`.
    static func writeTemporaryJPEG(_ image: UIImage) -> URL? {
        guard let data = image.jpegData(compressionQuality: 0.92) else { return nil }
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("athly-treino-\(UUID().uuidString).jpg")
        do {
            try data.write(to: url)
            return url
        } catch {
            return nil
        }
    }
}
