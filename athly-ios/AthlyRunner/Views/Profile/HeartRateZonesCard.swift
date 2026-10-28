import SwiftUI
import HealthKit

struct HeartRateZonesCard: View {
    @ObservedObject var model: HeartRateZonesViewModel
    let editProfile: (Int?) -> Void
    @State private var peakRefreshID = UUID()

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Label("Zonas de frequência cardíaca", systemImage: "heart.fill")
                    .font(.headline)
                Spacer(minLength: 0)
                if model.isLoading { ProgressView().accessibilityLabel(Text("Atualizando zonas")) }
            }

            if let result = model.zones {
                if !result.shouldShowInProfile {
                    Text("Seus treinos usam esforço percebido (RPE).")
                        .font(.subheadline.weight(.semibold))
                    if result.trainingGuidance?.reason == "no_recent_heart_rate" {
                        Text("Não há uma corrida com FC medida nos últimos 30 dias. As zonas ficam ocultas no perfil e não são usadas nos novos treinos.")
                            .font(.footnote)
                    } else {
                        Text("Ainda faltam dados para usar zonas de FC nos treinos.")
                            .font(.footnote)
                    }
                }
                if result.isEstimated {
                    VStack(alignment: .leading, spacing: 6) {
                        Label("Zonas estimadas", systemImage: "info.circle")
                            .font(.subheadline.weight(.semibold))
                        Text("A FC máxima usada nas zonas foi estimada pela sua idade.")
                            .font(.footnote)
                    }
                    .foregroundStyle(AthlyTheme.Color.warning)
                    .fixedSize(horizontal: false, vertical: true)
                }
                if result.status == "available" {
                    ForEach(result.zones) { zone in
                        ViewThatFits(in: .horizontal) {
                            HStack {
                                zoneLabel(zone)
                                Spacer()
                                zoneRange(zone)
                            }
                            VStack(alignment: .leading, spacing: 4) {
                                zoneLabel(zone)
                                zoneRange(zone)
                            }
                        }
                        .accessibilityElement(children: .combine)
                    }
                } else {
                    Text("Complete os dados abaixo para calcular suas zonas.")
                        .font(.subheadline)
                    if result.missingData.contains("resting_heart_rate") {
                        Text("Falta uma FC de repouso informada ou uma amostra do Apple Health dos últimos 30 dias.")
                            .font(.footnote)
                    }
                    if result.missingData.contains("max_heart_rate") {
                        Text("Informe sua FC máxima ou sua data de nascimento. A estimativa pela idade está disponível para adultos.")
                            .font(.footnote)
                    }
                    if result.missingData.contains("invalid_heart_rate_range") {
                        Text("Revise a FC de repouso e a FC máxima: os valores precisam formar cinco zonas válidas.")
                            .font(.footnote)
                    }
                }
                if let value = result.restingHeartRate {
                    valueRow(String(localized: "FC de repouso"), value: value)
                }
                if let value = result.maxHeartRate {
                    valueRow(String(localized: "FC máxima"), value: value)
                }
            }

            ObservedHeartRatePeakView(savedMaximum: model.zones?.maxHeartRate?.source == "manual" ? model.zones?.maxHeartRate?.bpm : nil) { editProfile($0) }.id(peakRefreshID)

            if let message = model.syncMessage {
                Text(message).font(.footnote).foregroundStyle(AthlyTheme.Color.textSecondary)
            }
            if let message = model.errorMessage {
                Text(message).font(.footnote).foregroundStyle(AthlyTheme.Color.error)
                Button { Task { await model.refresh() } } label: {
                    Label("Tentar novamente", systemImage: "arrow.clockwise")
                        .fixedSize(horizontal: false, vertical: true)
                }
                .buttonStyle(AthlySecondaryButtonStyle())
                .disabled(model.isLoading)
                .opacity(model.isLoading ? 0.5 : 1)
            }
            Divider().overlay(AthlyTheme.Color.borderMid)
            VStack(spacing: 10) {
                Button {
                    Task { await model.refresh(requestAuthorization: true); peakRefreshID = UUID() }
                } label: {
                    HStack(spacing: 10) {
                        if model.isLoading {
                            ProgressView().tint(AthlyTheme.Color.primary)
                                .accessibilityHidden(true)
                        } else {
                            Image(systemName: "arrow.triangle.2.circlepath")
                        }
                        Text("Sincronizar com Apple Health")
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .buttonStyle(AthlySecondaryButtonStyle())
                .disabled(model.isLoading)
                .opacity(model.isLoading ? 0.5 : 1)

                Button { editProfile(nil) } label: {
                    Label("Editar dados de frequência cardíaca", systemImage: "slider.horizontal.3")
                        .fixedSize(horizontal: false, vertical: true)
                }
                .buttonStyle(AthlyGhostButtonStyle())
            }
            .multilineTextAlignment(.center)
        }
        .foregroundStyle(AthlyTheme.Color.textPrimary)
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .athlySurface()
        .onReceive(NotificationCenter.default.publisher(for: .athlyHeartRateChanged)) { _ in
            Task { await model.refresh(syncHealth: false) }
        }
    }

    private func zoneLabel(_ zone: HeartRateZones.Zone) -> some View {
        Text("Z\(zone.zone) · \(zone.intensity)")
            .font(.subheadline.weight(.medium))
            .fixedSize(horizontal: false, vertical: true)
    }

    private func zoneRange(_ zone: HeartRateZones.Zone) -> some View {
        Text("\(zone.minBpm)–\(zone.maxBpm) bpm")
            .font(.subheadline.monospacedDigit())
            .fixedSize()
    }

    private func valueRow(_ title: String, value: HeartRateZones.Value) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("\(title): \(value.bpm) bpm")
            Text(value.sourceLabel)
            if let date = value.measurementDate {
                Text(date, format: .dateTime.day().month().year())
            }
        }
        .font(.footnote)
        .foregroundStyle(AthlyTheme.Color.textSecondary)
        .accessibilityElement(children: .combine)
    }
}

struct HeartRateSettingsView: View {
    @StateObject private var model = HeartRateZonesViewModel()
    @State private var profile: UserProfile?
    @State private var showEditProfile = false
    @State private var suggestedMaximum: Int?
    @State private var isVisible = false
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ScrollView {
            HeartRateZonesCard(model: model) { suggestedMaximum = $0; showEditProfile = true }
                .padding()
        }
        .background(AthlyTheme.Color.backgroundDark)
        .navigationTitle("Frequência cardíaca")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            profile = try? await APIClient.shared.getUserProfile()
            await model.refresh()
        }
        .onAppear { isVisible = true }
        .onDisappear { isVisible = false; model.cancel() }
        .onChange(of: scenePhase) { phase in
            if phase == .active, isVisible, !model.isLoading {
                Task { await model.refresh() }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .athlyHeartRateChanged)) { _ in
            Task { profile = try? await APIClient.shared.getUserProfile() }
        }
        .onReceive(NotificationCenter.default.publisher(for: .athlyAuthChanged)) { _ in
            model.cancel(clear: true)
            profile = nil
        }
        .sheet(isPresented: $showEditProfile, onDismiss: { suggestedMaximum = nil }) {
            EditProfileView(profile: profile, suggestedMaximum: suggestedMaximum) { updated in
                profile = updated
                Task { await model.refresh(syncHealth: false) }
            }
        }
    }
}

struct ObservedHeartRatePeakView: View {
    var savedMaximum: Int? = nil
    var draftMaximum: Int? = nil
    var isEditing = false
    let onUse: (Int) -> Void
    @StateObject private var model = ObservedHeartRatePeakViewModel()
    @State private var refreshID = UUID()
    @State private var requestAuthorization = false
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("Maior FC observada nos últimos 90 dias", systemImage: "waveform.path.ecg")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            if let peak = model.peak {
                Text("\(peak.bpm) bpm")
                    .font(.title2.weight(.bold).monospacedDigit())
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                VStack(alignment: .leading, spacing: 4) {
                    Text(peak.measuredAt, format: .dateTime.day().month().year())
                    Text(peak.sourceName)
                    Text(activityName(peak.activity))
                }
                Text("Maior registro encontrado nos seus exercícios. Suas zonas só mudam quando você escolher e salvar este valor.")
                    .fixedSize(horizontal: false, vertical: true)
                switch HeartRatePeakActionState.resolve(peak: peak.bpm, saved: savedMaximum, draft: draftMaximum, editing: isEditing) {
                case .inUse:
                    Label("Valor em uso", systemImage: "checkmark.circle.fill").foregroundStyle(AthlyTheme.Color.success)
                case .selected:
                    Label("Selecionado — salve para aplicar", systemImage: "checkmark.circle")
                case .higherConfigured:
                    Text("Sua FC máxima configurada já é maior que este pico.")
                case .available:
                Button { onUse(peak.bpm) } label: {
                    Label("Usar este valor", systemImage: "checkmark.circle.fill")
                        .fixedSize(horizontal: false, vertical: true)
                }
                .buttonStyle(AthlyPrimaryButtonStyle())
                .disabled(!peak.canUse)
                .opacity(peak.canUse ? 1 : 0.5)
                }
            }
            if let message = model.message {
                Text(message).fixedSize(horizontal: false, vertical: true)
            }
            Button { requestAuthorization = true; refreshID = UUID() } label: {
                HStack(spacing: 10) {
                    if model.isLoading {
                        ProgressView().tint(AthlyTheme.Color.textSecondary)
                            .accessibilityHidden(true)
                    } else {
                        Image(systemName: "arrow.clockwise")
                    }
                    Text("Atualizar maior FC observada")
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .buttonStyle(AthlyGhostButtonStyle())
            .disabled(model.isLoading)
            .opacity(model.isLoading ? 0.5 : 1)
            .multilineTextAlignment(.center)
        }
        .font(.footnote)
        .foregroundStyle(AthlyTheme.Color.textSecondary)
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AthlyTheme.Color.backgroundAlt)
        .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                .stroke(AthlyTheme.Color.borderMid, lineWidth: 1)
        }
        .task(id: refreshID) {
            let authorize = requestAuthorization
            requestAuthorization = false
            await model.refresh(requestAuthorization: authorize)
        }
        .onDisappear { model.clear() }
        .onReceive(NotificationCenter.default.publisher(for: .athlyAuthChanged)) { _ in
            model.clear()
            Task { await ObservedHeartRatePeakPool.shared.cancel() }
        }
        .onChange(of: scenePhase) { phase in
            if phase == .active { refreshID = UUID() }
            else { model.clear() }
        }
    }

    private func activityName(_ raw: UInt) -> String {
        switch HKWorkoutActivityType(rawValue: raw) {
        case .running: return String(localized: "Corrida")
        case .cycling: return String(localized: "Ciclismo")
        case .walking: return String(localized: "Caminhada")
        case .swimming: return String(localized: "Natação")
        case .highIntensityIntervalTraining: return "HIIT"
        case .traditionalStrengthTraining, .functionalStrengthTraining: return String(localized: "Treino de força")
        default: return String(localized: "Outro exercício")
        }
    }
}

struct WorkoutHeartRateSuggestionCard: View {
    let suggestion: WorkoutHeartRateSuggestion
    @State private var profile: UserProfile?
    @State private var currentMaximum: Int?
    @State private var isLoading = false
    @State private var showEditor = false
    @State private var message: String?
    @State private var generation = UUID()

    private var applied: Bool { currentMaximum.map { $0 >= suggestion.bpm } ?? false }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label(applied || suggestion.previousMaximum == nil
                  ? String(localized: "Revisar FC máxima")
                  : String(localized: "FC acima da máxima atual"), systemImage: "heart.fill").font(.headline)
            Text("Este treino registrou \(suggestion.bpm) bpm.").font(.title3.weight(.semibold))
            if let maximum = currentMaximum ?? suggestion.previousMaximum {
                Text("Sua FC máxima atual é \(maximum) bpm.")
            }
            if applied {
                if currentMaximum == suggestion.bpm {
                    Label("Valor em uso", systemImage: "checkmark.circle.fill").foregroundStyle(AthlyTheme.Color.success)
                } else {
                    Text("Sua FC máxima configurada já é maior que este pico.")
                }
            } else {
                Button { Task { await review() } } label: {
                    Label("Revisar FC máxima", systemImage: "slider.horizontal.3")
                }
                .buttonStyle(AthlyPrimaryButtonStyle())
                .disabled(isLoading)
            }
            if isLoading { ProgressView() }
            if let message { Text(message).foregroundStyle(AthlyTheme.Color.error) }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .athlySurface()
        .sheet(isPresented: $showEditor) {
            EditProfileView(profile: profile, suggestedMaximum: suggestion.bpm) { updated in
                profile = updated
                currentMaximum = updated.maxHeartRate
                showEditor = false
            }
        }
        .onDisappear { generation = UUID() }
        .onReceive(NotificationCenter.default.publisher(for: .athlyAuthChanged)) { _ in
            generation = UUID(); profile = nil; currentMaximum = nil; showEditor = false
        }
    }

    @MainActor private func review() async {
        guard !isLoading else { return }
        isLoading = true
        message = nil
        let token = generation
        let session = await APIClient.shared.heartRateSessionIdentifier
        defer { isLoading = false }
        do {
            let latest = try await APIClient.shared.getUserProfile()
            guard !Task.isCancelled, generation == token,
                  session == (await APIClient.shared.heartRateSessionIdentifier) else { return }
            profile = latest
            currentMaximum = latest.maxHeartRate
            if !applied { showEditor = true }
        } catch {
            guard generation == token else { return }
            message = String(localized: "Não foi possível atualizar seu perfil. Tente novamente.")
        }
    }
}
