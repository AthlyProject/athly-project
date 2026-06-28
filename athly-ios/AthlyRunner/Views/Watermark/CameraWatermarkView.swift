import SwiftUI
import PhotosUI
import AVFoundation

/// Experiência em tela cheia: câmera ao vivo com a marca d'água sobreposta em tempo real,
/// seletor dos 4 templates, captura (ou importação da galeria) e, depois, salvar/compartilhar.
///
/// A imagem final é COMPOSTA via `WatermarkRenderer` (foto + overlay em resolução cheia), não é
/// um print da tela — por isso os controles na tela nunca aparecem na foto salva.
struct CameraWatermarkView: View {
    let data: WatermarkData

    @StateObject private var camera = CameraCaptureService()
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase

    @State private var selectedStyle: WatermarkStyle = .heroBar
    /// Foto capturada ou importada. `nil` = ainda na câmera ao vivo.
    @State private var baseImage: UIImage?
    @State private var pickerItem: PhotosPickerItem?
    @State private var isCapturing = false
    @State private var saveState: SaveState = .idle
    @State private var shareImage: ShareImage?

    private enum SaveState { case idle, saving, saved, error }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if let base = baseImage {
                previewStage(base: base)
            } else if camera.authorizationStatus == .denied || camera.authorizationStatus == .restricted {
                deniedStage
            } else {
                liveStage
            }

            VStack {
                topBar
                Spacer()
            }
        }
        .statusBarHidden(true)
        .task { await setupCamera() }
        .onDisappear { camera.stop() }
        .onChange(of: scenePhase) { phase in
            if phase == .active, baseImage == nil, camera.authorizationStatus == .authorized {
                camera.start()
            } else if phase == .background {
                camera.stop()
            }
        }
        .onChange(of: pickerItem) { item in importPicked(item) }
        .sheet(item: $shareImage) { wrapper in
            ActivityShareSheet(items: [wrapper.image])
        }
    }

    // MARK: - Estágios

    private var liveStage: some View {
        ZStack {
            CameraPreviewView(session: camera.session)
                .ignoresSafeArea()
            WatermarkOverlayView(style: selectedStyle, data: data)
                .ignoresSafeArea()
                .allowsHitTesting(false)
            VStack(spacing: 18) {
                Spacer()
                styleSelector
                liveControls
            }
            .padding(.bottom, 28)
        }
    }

    private func previewStage(base: UIImage) -> some View {
        ZStack {
            Image(uiImage: base)
                .resizable()
                .scaledToFit()
                .overlay {
                    WatermarkOverlayView(style: selectedStyle, data: data)
                }

            VStack(spacing: 18) {
                Spacer()
                styleSelector
                previewControls
            }
            .padding(.bottom, 28)
        }
    }

    private var deniedStage: some View {
        VStack(spacing: 18) {
            Image(systemName: "camera.fill")
                .font(.system(size: 44))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
            Text("Câmera sem permissão")
                .font(AthlyTheme.Typography.heading(20))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Text("Libere o acesso à câmera nos Ajustes para tirar a foto com a marca d'água — ou escolha uma foto da galeria.")
                .font(AthlyTheme.Typography.body(14))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Button {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            } label: {
                Text("Abrir Ajustes")
            }
            .buttonStyle(AthlyGradientButtonStyle())
            .padding(.horizontal, 40)

            PhotosPicker(selection: $pickerItem, matching: .images) {
                HStack {
                    Image(systemName: "photo.on.rectangle")
                    Text("Escolher da galeria")
                }
            }
            .buttonStyle(AthlySecondaryButtonStyle())
            .padding(.horizontal, 40)
        }
    }

    // MARK: - Seletor de estilos

    private var styleSelector: some View {
        HStack(spacing: 10) {
            ForEach(WatermarkStyle.allCases) { style in
                Button {
                    withAnimation(.easeOut(duration: 0.15)) { selectedStyle = style }
                } label: {
                    VStack(spacing: 5) {
                        Image(systemName: style.iconName)
                            .font(.system(size: 16, weight: .semibold))
                        Text(style.displayName)
                            .font(.custom("SpaceGrotesk-SemiBold", size: 11))
                    }
                    .frame(width: 66, height: 52)
                    .foregroundStyle(selectedStyle == style ? .white : AthlyTheme.Color.textSecondary)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(selectedStyle == style
                                  ? AnyShapeStyle(AthlyTheme.Gradient.brand)
                                  : AnyShapeStyle(Color.black.opacity(0.35)))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(Color.white.opacity(selectedStyle == style ? 0 : 0.18), lineWidth: 1)
                    )
                }
            }
        }
        .padding(.horizontal, 16)
    }

    // MARK: - Controles

    private var liveControls: some View {
        HStack {
            PhotosPicker(selection: $pickerItem, matching: .images) {
                ControlIcon(systemName: "photo.on.rectangle")
            }

            Spacer()

            Button(action: capture) {
                ZStack {
                    Circle()
                        .stroke(Color.white, lineWidth: 4)
                        .frame(width: 78, height: 78)
                    Circle()
                        .fill(Color.white)
                        .frame(width: 64, height: 64)
                    if isCapturing {
                        ProgressView().tint(.black)
                    }
                }
            }
            .disabled(isCapturing)

            Spacer()

            Button {
                camera.flipCamera()
            } label: {
                ControlIcon(systemName: "arrow.triangle.2.circlepath.camera")
            }
        }
        .padding(.horizontal, 36)
    }

    private var previewControls: some View {
        VStack(spacing: 12) {
            if saveState == .saved {
                statusPill(icon: "checkmark.circle.fill", text: "Salvo na galeria!", color: AthlyTheme.Color.success)
            } else if saveState == .error {
                statusPill(icon: "exclamationmark.triangle.fill", text: "Não consegui salvar", color: AthlyTheme.Color.warning)
            }

            HStack(spacing: 12) {
                Button(action: retake) {
                    HStack {
                        Image(systemName: "arrow.counterclockwise")
                        Text("Refazer")
                    }
                }
                .buttonStyle(AthlySecondaryButtonStyle())

                Button(action: save) {
                    HStack {
                        if saveState == .saving {
                            ProgressView().tint(.white)
                        } else {
                            Image(systemName: "square.and.arrow.down")
                        }
                        Text("Salvar")
                    }
                }
                .buttonStyle(AthlyGradientButtonStyle())
                .disabled(saveState == .saving)

                Button(action: share) {
                    Image(systemName: "square.and.arrow.up")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(AthlySecondaryButtonStyle())
            }
        }
        .padding(.horizontal, 24)
    }

    private var topBar: some View {
        HStack {
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 38, height: 38)
                    .background(Circle().fill(Color.black.opacity(0.4)))
            }
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    private func statusPill(icon: String, text: String, color: Color) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
            Text(text)
                .font(AthlyTheme.Typography.semibold(14))
        }
        .foregroundStyle(color)
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Capsule().fill(Color.black.opacity(0.45)))
    }

    // MARK: - Ações

    private func setupCamera() async {
        await camera.requestAccessIfNeeded()
        if camera.authorizationStatus == .authorized, baseImage == nil {
            camera.start()
        }
    }

    private func capture() {
        guard !isCapturing else { return }
        isCapturing = true
        Task {
            defer { isCapturing = false }
            if let image = try? await camera.capturePhoto() {
                camera.stop()
                baseImage = image
                saveState = .idle
            }
        }
    }

    private func importPicked(_ item: PhotosPickerItem?) {
        guard let item else { return }
        Task {
            if let imageData = try? await item.loadTransferable(type: Data.self),
               let image = UIImage(data: imageData) {
                camera.stop()
                baseImage = image
                saveState = .idle
            }
            pickerItem = nil
        }
    }

    private func retake() {
        baseImage = nil
        saveState = .idle
        if camera.authorizationStatus == .authorized {
            camera.start()
        }
    }

    private func save() {
        guard let base = baseImage, saveState != .saving else { return }
        saveState = .saving
        Task {
            let composed = WatermarkRenderer.compose(photo: base, style: selectedStyle, data: data)
            do {
                try await WatermarkRenderer.saveToPhotos(composed)
                saveState = .saved
            } catch {
                saveState = .error
            }
        }
    }

    private func share() {
        guard let base = baseImage else { return }
        let composed = WatermarkRenderer.compose(photo: base, style: selectedStyle, data: data)
        shareImage = ShareImage(image: composed)
    }
}

// MARK: - Auxiliares

private struct ShareImage: Identifiable {
    let id = UUID()
    let image: UIImage
}

/// Botão circular translúcido dos controles da câmera. É uma `View` (não um método que
/// devolve `some View`) para poder ser usada dentro dos closures de label sem fricção de
/// isolamento de ator no Swift 6.
private struct ControlIcon: View {
    let systemName: String

    var body: some View {
        Image(systemName: systemName)
            .font(.system(size: 20, weight: .medium))
            .foregroundStyle(.white)
            .frame(width: 52, height: 52)
            .background(Circle().fill(Color.black.opacity(0.4)))
    }
}

/// Folha de compartilhamento nativa (UIActivityViewController) para a imagem composta —
/// oferece Instagram/WhatsApp/Salvar Imagem etc.
struct ActivityShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
