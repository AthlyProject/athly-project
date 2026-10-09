import SwiftUI

struct HeartRateZonesCard: View {
    @ObservedObject var model: HeartRateZonesViewModel
    let editProfile: () -> Void

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
                        Text("O Apple Health não forneceu dados suficientes para definir sua FC máxima. Usamos uma estimativa baseada na sua idade.")
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

            if let message = model.syncMessage {
                Text(message).font(.footnote).foregroundStyle(AthlyTheme.Color.textSecondary)
            }
            if let message = model.errorMessage {
                Text(message).font(.footnote).foregroundStyle(AthlyTheme.Color.error)
                Button("Tentar novamente") { Task { await model.refresh() } }
                    .disabled(model.isLoading)
            }
            VStack(alignment: .leading, spacing: 12) {
                Button("Sincronizar com Apple Health") {
                    Task { await model.refresh(requestAuthorization: true) }
                }
                .disabled(model.isLoading)
                Button("Editar dados de frequência cardíaca", action: editProfile)
            }
            .font(.subheadline)
            .tint(AthlyTheme.Color.primary)
        }
        .foregroundStyle(AthlyTheme.Color.textPrimary)
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .athlySurface()
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
    @State private var isVisible = false
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ScrollView {
            HeartRateZonesCard(model: model) { showEditProfile = true }
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
        .onReceive(NotificationCenter.default.publisher(for: .athlyAuthChanged)) { _ in
            model.cancel(clear: true)
            profile = nil
        }
        .sheet(isPresented: $showEditProfile) {
            EditProfileView(profile: profile) { updated in
                profile = updated
                Task { await model.refresh(syncHealth: false) }
            }
        }
    }
}
