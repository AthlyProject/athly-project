import SwiftUI

/// Relógio Garmin (app Connect IQ da Athly): parear com o código mostrado no relógio, ver o status
/// da sincronização e desconectar. Os treinos vão para Treino › Treinos no relógio.
struct GarminConnectView: View {
    @StateObject private var viewModel: GarminConnectViewModel
    @State private var deviceToUnpair: ConnectIqDevice?
    @FocusState private var codeFocused: Bool

    init(viewModel: GarminConnectViewModel = GarminConnectViewModel()) {
        _viewModel = StateObject(wrappedValue: viewModel)
    }

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark
                .ignoresSafeArea()

            RadialGradient(
                colors: [AthlyTheme.Color.primary.opacity(0.12), .clear],
                center: .init(x: 0.0, y: 0.0),
                startRadius: 0, endRadius: 220
            )
            .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 6) {
                    Text("Leve os treinos da Athly para o seu Garmin. Eles aparecem em Treino › Treinos no relógio e rodam no player de treino da própria Garmin.")
                        .font(AthlyTheme.Typography.body(12))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 2)
                        .padding(.bottom, 2)

                    if !viewModel.devices.isEmpty {
                        AthlySectionLabel("Seus relógios")
                        devicesGroup
                    }

                    AthlySectionLabel("Como conectar")
                    stepsGroup

                    AthlySectionLabel("Código do relógio")
                    codeGroup

                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(AthlyTheme.Typography.body(11))
                            .foregroundStyle(AthlyTheme.Color.error)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 2)
                    }

                    Text("Os treinos dos próximos 7 dias sincronizam sempre que você abre o app Athly no relógio. No iPhone, mantenha o Garmin Connect aberto durante a sincronização.")
                        .font(AthlyTheme.Typography.body(11))
                        .foregroundStyle(AthlyTheme.Color.textTertiary)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 2)
                        .padding(.top, 8)
                }
                .padding(AthlyTheme.Spacing.sm)
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .athlyTabBarContentClearance()
        }
        .navigationTitle("Relógio Garmin")
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.load() }
        // Depois do código confirmado, acompanha até o relógio aparecer como ativo.
        .task(id: viewModel.hasPendingDevice) { await viewModel.watchPendingDevices() }
        .confirmationDialog(
            "Desconectar este relógio?",
            isPresented: Binding(
                get: { deviceToUnpair != nil },
                set: { if !$0 { deviceToUnpair = nil } }
            ),
            titleVisibility: .visible,
            presenting: deviceToUnpair
        ) { device in
            Button("Desconectar", role: .destructive) {
                Task { await viewModel.unpair(device) }
            }
        } message: { _ in
            Text("Os treinos da Athly saem do relógio na próxima vez que o app abrir nele.")
        }
    }

    // MARK: - Blocos

    private var devicesGroup: some View {
        AthlyListGroup {
            ForEach(Array(viewModel.devices.enumerated()), id: \.element.id) { index, device in
                if index > 0 {
                    AthlyRowDivider()
                }
                deviceRow(device)
            }
        }
    }

    private func deviceRow(_ device: ConnectIqDevice) -> some View {
        let status = statusLine(for: device)
        return AthlyListRow(
            systemImage: "stopwatch.fill",
            tint: AthlyTheme.Color.primary,
            title: Text("Relógio Garmin"),
            subtitle: Text(status.text),
            subtitleColor: status.color
        ) {
            if viewModel.workingDeviceId == device.id {
                ProgressView()
                    .tint(AthlyTheme.Color.primary)
                    .scaleEffect(0.8)
            } else {
                Button {
                    deviceToUnpair = device
                } label: {
                    Text("Desconectar")
                        .font(AthlyTheme.Typography.semibold(11))
                        .foregroundStyle(AthlyTheme.Color.error)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .overlay(
                            Capsule().stroke(AthlyTheme.Color.error.opacity(0.35), lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var stepsGroup: some View {
        AthlyListGroup {
            AthlyListRow(
                systemImage: "1.circle.fill",
                title: Text("Instale o app Athly no relógio"),
                subtitle: Text("Pela Connect IQ Store, no celular")
            ) {
                if let storeURL = FeatureFlags.garminStoreURL {
                    Link(destination: storeURL) {
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(AthlyTheme.Color.textTertiary)
                    }
                    .accessibilityLabel(Text("Abrir na Connect IQ Store"))
                }
            }
            AthlyRowDivider()
            AthlyListRow(
                systemImage: "2.circle.fill",
                title: Text("Abra o app no relógio"),
                subtitle: Text("Ele mostra um código de 8 dígitos")
            )
            AthlyRowDivider()
            AthlyListRow(
                systemImage: "3.circle.fill",
                title: Text("Digite o código abaixo")
            )
        }
    }

    private var codeGroup: some View {
        AthlyListGroup {
            TextField(
                "",
                text: Binding(get: { viewModel.code }, set: { viewModel.updateCode($0) }),
                prompt: Text(verbatim: "00000000").foregroundColor(AthlyTheme.Color.textTertiary)
            )
            .font(AthlyTheme.Typography.mono(22))
            .kerning(4)
            .multilineTextAlignment(.center)
            .foregroundStyle(AthlyTheme.Color.textPrimary)
            .keyboardType(.numberPad)
            .textContentType(.oneTimeCode)
            .focused($codeFocused)
            .padding(.vertical, 12)
            .padding(.horizontal, 13)
            .accessibilityLabel(Text("Código do relógio"))

            AthlyWideButton(
                background: AnyShapeStyle(AthlyTheme.Gradient.brand),
                border: .clear,
                foreground: .white,
                action: {
                    codeFocused = false
                    Task { await viewModel.claim() }
                }
            ) {
                if viewModel.isClaiming {
                    ProgressView().tint(.white).scaleEffect(0.8)
                } else {
                    Image(systemName: "link")
                        .font(.system(size: 13, weight: .semibold))
                    Text("Conectar relógio")
                }
            }
            .disabled(!viewModel.canClaim)
            .opacity(viewModel.canClaim || viewModel.isClaiming ? 1 : 0.55)
            .padding(.horizontal, 13)
            .padding(.bottom, 13)
        }
    }

    // MARK: - Derivados

    private func statusLine(for device: ConnectIqDevice) -> (text: String, color: Color) {
        guard device.isActive else {
            return (String(localized: "Aguardando o relógio…"), AthlyTheme.Color.warning)
        }
        if device.lastSync?.storageFull == true {
            return (String(localized: "Memória de treinos cheia no relógio"), AthlyTheme.Color.warning)
        }
        if let failed = device.lastSync?.failed, failed > 0 {
            return (String(localized: "Alguns treinos não baixaram na última sincronização"), AthlyTheme.Color.warning)
        }
        guard let lastSync = device.lastSyncDate else {
            return ("● " + String(localized: "Conectado · ainda não sincronizou"), AthlyTheme.Color.success)
        }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        let relative = formatter.localizedString(for: lastSync, relativeTo: Date())
        return ("● " + String(localized: "Sincronizado \(relative)"), AthlyTheme.Color.success)
    }
}
