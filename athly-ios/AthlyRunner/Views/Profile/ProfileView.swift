import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @EnvironmentObject var runStore: RunStore

    @State private var userProfile: UserProfile?
    @State private var selectedDays: Set<String> = []
    @State private var isSavingDays = false
    @State private var saveError: String?
    @State private var showSaveConfirmation = false

    private var allRuns: [RunSession] { runStore.sortedSessions }

    private static let adminEmails: Set<String> = [
        "alexandrefonseca998@gmail.com",
    ]

    private var isAdminUser: Bool {
        guard let email = userProfile?.email else { return false }
        return Self.adminEmails.contains(email.lowercased())
    }

    private let weekdays: [(key: String, label: String)] = [
        ("sunday",    "Dom"),
        ("monday",    "Seg"),
        ("tuesday",   "Ter"),
        ("wednesday", "Qua"),
        ("thursday",  "Qui"),
        ("friday",    "Sex"),
        ("saturday",  "Sáb"),
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                AthlyTheme.Color.backgroundDark
                    .ignoresSafeArea()

                List {
                    // Stats section
                    Section("Estatisticas gerais") {
                        statsRow(icon: "figure.run", label: "Total de corridas", value: "\(allRuns.count)")
                        statsRow(icon: "ruler", label: "Distancia total", value: String(format: "%.1f km", totalDistance))
                        statsRow(icon: "clock", label: "Tempo total", value: formatDuration(totalTime))
                        statsRow(icon: "speedometer", label: "Pace medio", value: formatPace(averagePace))
                        statsRow(icon: "mountain.2", label: "Elevacao total", value: String(format: "%.0f m", totalElevation))
                    }
                    .listRowBackground(AthlyTheme.Color.surfaceDark)

                    // Training days section
                    Section {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Image(systemName: "calendar")
                                    .foregroundStyle(AthlyTheme.Color.primary)
                                Text("Dias disponíveis para treinar")
                                    .font(AthlyTheme.Typography.body())
                                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                            }

                            // Day toggle buttons
                            HStack(spacing: 8) {
                                ForEach(weekdays, id: \.key) { day in
                                    dayToggleButton(key: day.key, label: day.label)
                                }
                            }

                            // Selected count + save
                            HStack {
                                Text("\(selectedDays.count) dia\(selectedDays.count == 1 ? "" : "s") selecionado\(selectedDays.count == 1 ? "" : "s")")
                                    .font(AthlyTheme.Typography.body(13))
                                    .foregroundStyle(AthlyTheme.Color.textSecondary)

                                Spacer()

                                Button {
                                    Task { await saveDays() }
                                } label: {
                                    if isSavingDays {
                                        ProgressView()
                                            .tint(AthlyTheme.Color.primary)
                                            .scaleEffect(0.8)
                                    } else {
                                        Text("Salvar")
                                            .font(AthlyTheme.Typography.semibold(14))
                                            .foregroundStyle(AthlyTheme.Color.primary)
                                    }
                                }
                                .disabled(isSavingDays)
                            }

                            if showSaveConfirmation {
                                HStack(spacing: 4) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(AthlyTheme.Color.success)
                                    Text("Dias de treino salvos!")
                                        .font(AthlyTheme.Typography.body(13))
                                        .foregroundStyle(AthlyTheme.Color.success)
                                }
                                .transition(.opacity)
                            }

                            if let error = saveError {
                                Text(error)
                                    .font(AthlyTheme.Typography.body(13))
                                    .foregroundStyle(AthlyTheme.Color.error)
                            }
                        }
                        .padding(.vertical, 4)
                    } header: {
                        Text("Preferências de treino")
                    }
                    .listRowBackground(AthlyTheme.Color.surfaceDark)

                    // Account
                    Section("Conta") {
                        Button("Sair", role: .destructive) {
                            authViewModel.logout()
                        }
                        .foregroundStyle(AthlyTheme.Color.error)
                    }
                    .listRowBackground(AthlyTheme.Color.surfaceDark)

                    // Integração (teste HealthKit)
                    Section("Integracao") {
                        NavigationLink {
                            HealthKitRunsView()
                        } label: {
                            HStack {
                                Image(systemName: "heart.fill")
                                    .foregroundStyle(AthlyTheme.Color.primary)
                                    .frame(width: 28)
                                Text("Corridas do Apple Health")
                                    .font(AthlyTheme.Typography.body())
                                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                            }
                        }
                        .listRowBackground(AthlyTheme.Color.surfaceDark)
                    }

                    // Admin (whitelist por email)
                    if isAdminUser {
                        Section("Admin") {
                            NavigationLink {
                                AdminView()
                            } label: {
                                HStack {
                                    Image(systemName: "wrench.and.screwdriver.fill")
                                        .foregroundStyle(AthlyTheme.Color.primary)
                                        .frame(width: 28)
                                    Text("Relatório de dados/IA")
                                        .font(AthlyTheme.Typography.body())
                                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                                }
                            }
                            .listRowBackground(AthlyTheme.Color.surfaceDark)
                        }
                    }

                    // App info
                    Section("Sobre") {
                        HStack {
                            Text("Versao")
                                .font(AthlyTheme.Typography.body())
                                .foregroundStyle(AthlyTheme.Color.textPrimary)
                            Spacer()
                            Text("1.0.0")
                                .font(AthlyTheme.Typography.medium(16))
                                .foregroundStyle(AthlyTheme.Color.textSecondary)
                        }
                    }
                    .listRowBackground(AthlyTheme.Color.surfaceDark)
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Perfil")
            .task { await loadProfile() }
        }
    }

    // MARK: - Day Toggle Button

    private func dayToggleButton(key: String, label: String) -> some View {
        let isSelected = selectedDays.contains(key)
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) {
                if isSelected {
                    selectedDays.remove(key)
                } else {
                    selectedDays.insert(key)
                }
            }
            saveError = nil
            showSaveConfirmation = false
        } label: {
            Text(label)
                .font(AthlyTheme.Typography.semibold(13))
                .foregroundStyle(isSelected ? .white : AthlyTheme.Color.textSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(
                    isSelected
                        ? AthlyTheme.Gradient.brand
                        : LinearGradient(colors: [AthlyTheme.Color.glassBackground], startPoint: .top, endPoint: .bottom)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(
                            isSelected ? Color.clear : AthlyTheme.Color.glassBorder,
                            lineWidth: 1
                        )
                )
                .shadow(color: isSelected ? AthlyTheme.Color.primaryNeon.opacity(0.35) : .clear, radius: 6, y: 2)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Stats Row

    private func statsRow(icon: String, label: String, value: String) -> some View {
        HStack {
            Image(systemName: icon)
                .foregroundStyle(AthlyTheme.Color.primary)
                .frame(width: 28)

            Text(label)
                .font(AthlyTheme.Typography.body())
                .foregroundStyle(AthlyTheme.Color.textPrimary)

            Spacer()

            Text(value)
                .font(AthlyTheme.Typography.medium(16))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
        }
    }

    // MARK: - Actions

    private func loadProfile() async {
        do {
            let profile = try await APIClient.shared.getUserProfile()
            userProfile = profile
            if let days = profile.availableDays {
                selectedDays = Set(days)
            }
        } catch {
            // Silently ignore — stats still show from RunStore
        }
    }

    private func saveDays() async {
        isSavingDays = true
        saveError = nil
        showSaveConfirmation = false

        do {
            let request = UpdateProfileRequest(name: userProfile?.name, availableDays: Array(selectedDays))
            let updated = try await APIClient.shared.updateProfile(request)
            userProfile = updated
            selectedDays = Set(updated.availableDays ?? [])
            withAnimation {
                showSaveConfirmation = true
            }
            // Hide confirmation after 2s
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            withAnimation {
                showSaveConfirmation = false
            }
        } catch {
            saveError = error.localizedDescription
        }

        isSavingDays = false
    }

    // MARK: - Computed stats

    private var totalDistance: Double {
        allRuns.reduce(0) { $0 + $1.distanceKm }
    }

    private var totalTime: Double {
        allRuns.reduce(0) { $0 + $1.durationSeconds }
    }

    private var totalElevation: Double {
        allRuns.reduce(0) { $0 + $1.elevationGainMeters }
    }

    private var averagePace: Double {
        guard totalDistance > 0 else { return 0 }
        return totalTime / totalDistance
    }

    private func formatDuration(_ seconds: Double) -> String {
        let h = Int(seconds) / 3600
        let m = (Int(seconds) % 3600) / 60
        if h > 0 { return String(format: "%dh %dmin", h, m) }
        return String(format: "%dmin", m)
    }

    private func formatPace(_ pace: Double) -> String {
        guard pace > 0, pace.isFinite else { return "--:--" }
        return String(format: "%d:%02d /km", Int(pace) / 60, Int(pace) % 60)
    }
}
