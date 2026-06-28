import AVFoundation
import UIKit

enum CameraError: Error {
    case unavailable
    case captureFailed
}

/// Encapsula a câmera (AVFoundation) para a foto com marca d'água.
///
/// Concorrência: o estado publicado (`@Published`) é sempre atualizado na main; toda a
/// configuração e a captura da `AVCaptureSession` rodam numa serial queue dedicada. A classe é
/// `@unchecked Sendable` porque essa disciplina de filas garante a segurança manualmente — algo
/// que o compilador não consegue provar sozinho sob `strict concurrency`.
final class CameraCaptureService: NSObject, ObservableObject, @unchecked Sendable {
    @Published private(set) var authorizationStatus: AVAuthorizationStatus
    @Published private(set) var isRunning = false
    @Published private(set) var position: AVCaptureDevice.Position = .back

    /// Exposta para a `CameraPreviewView` ligar no `AVCaptureVideoPreviewLayer`.
    let session = AVCaptureSession()

    private let sessionQueue = DispatchQueue(label: "com.athly.camera.session")
    private let photoOutput = AVCapturePhotoOutput()
    private var videoInput: AVCaptureDeviceInput?
    private var activeDelegate: PhotoCaptureDelegate?
    private var configured = false

    override init() {
        authorizationStatus = AVCaptureDevice.authorizationStatus(for: .video)
        super.init()
    }

    // MARK: - Permissão

    /// Pede acesso à câmera se ainda não foi decidido e atualiza `authorizationStatus`.
    @MainActor
    func requestAccessIfNeeded() async {
        guard authorizationStatus == .notDetermined else { return }
        let granted = await AVCaptureDevice.requestAccess(for: .video)
        authorizationStatus = granted ? .authorized : .denied
    }

    // MARK: - Ciclo de vida

    func start() {
        sessionQueue.async { [weak self] in
            guard let self else { return }
            self.configureIfNeeded()
            guard self.configured, !self.session.isRunning else { return }
            self.session.startRunning()
            let running = self.session.isRunning
            DispatchQueue.main.async { [weak self] in self?.isRunning = running }
        }
    }

    func stop() {
        sessionQueue.async { [weak self] in
            guard let self, self.session.isRunning else { return }
            self.session.stopRunning()
            DispatchQueue.main.async { [weak self] in self?.isRunning = false }
        }
    }

    func flipCamera() {
        sessionQueue.async { [weak self] in
            guard let self, self.configured else { return }
            let target: AVCaptureDevice.Position = (self.position == .back) ? .front : .back
            self.session.beginConfiguration()
            self.applyInput(position: target)
            self.session.commitConfiguration()
        }
    }

    // MARK: - Captura

    func capturePhoto() async throws -> UIImage {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<UIImage, Error>) in
            sessionQueue.async { [weak self] in
                guard let self, self.session.isRunning else {
                    continuation.resume(throwing: CameraError.unavailable)
                    return
                }
                let delegate = PhotoCaptureDelegate(continuation: continuation) { [weak self] in
                    guard let self else { return }
                    self.sessionQueue.async { self.activeDelegate = nil }
                }
                self.activeDelegate = delegate
                self.photoOutput.capturePhoto(with: AVCapturePhotoSettings(), delegate: delegate)
            }
        }
    }

    // MARK: - Configuração (sempre na sessionQueue)

    private func configureIfNeeded() {
        guard !configured else { return }
        session.beginConfiguration()
        session.sessionPreset = .photo
        applyInput(position: .back)
        if session.canAddOutput(photoOutput) {
            session.addOutput(photoOutput)
        }
        session.commitConfiguration()
        configured = (videoInput != nil)
    }

    /// Troca o input de vídeo para a posição pedida. Chamar dentro de begin/commitConfiguration.
    private func applyInput(position: AVCaptureDevice.Position) {
        guard let device = Self.device(for: position),
              let input = try? AVCaptureDeviceInput(device: device) else { return }

        if let current = videoInput {
            session.removeInput(current)
        }
        if session.canAddInput(input) {
            session.addInput(input)
            videoInput = input
            DispatchQueue.main.async { [weak self] in self?.position = position }
        } else if let current = videoInput {
            session.addInput(current)  // rollback
        }
    }

    private static func device(for position: AVCaptureDevice.Position) -> AVCaptureDevice? {
        AVCaptureDevice.DiscoverySession(
            deviceTypes: [.builtInWideAngleCamera],
            mediaType: .video,
            position: position
        ).devices.first
    }
}

/// Delegate de captura isolado: a `AVCapturePhotoOutput` não retém o delegate, então o serviço
/// guarda uma referência forte (`activeDelegate`) até a foto chegar. Os dados são extraídos na
/// própria callback (já `Sendable`) e a continuation é resumida exatamente uma vez.
private final class PhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate, @unchecked Sendable {
    private let continuation: CheckedContinuation<UIImage, Error>
    private let onFinish: () -> Void

    init(continuation: CheckedContinuation<UIImage, Error>, onFinish: @escaping () -> Void) {
        self.continuation = continuation
        self.onFinish = onFinish
    }

    func photoOutput(_ output: AVCapturePhotoOutput,
                     didFinishProcessingPhoto photo: AVCapturePhoto,
                     error: Error?) {
        defer { onFinish() }
        if let error {
            continuation.resume(throwing: error)
        } else if let data = photo.fileDataRepresentation(), let image = UIImage(data: data) {
            continuation.resume(returning: image)
        } else {
            continuation.resume(throwing: CameraError.captureFailed)
        }
    }
}
