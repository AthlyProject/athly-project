import SwiftUI
import RevenueCatUI

struct ProfileView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @EnvironmentObject var runStore: RunStore
    @EnvironmentObject var planVM: TrainingPlanViewModel

    @State private var userProfile: UserProfile?
    @State private var selectedDays: Set<String> = []
    @State private var isSavingDays = false
    @State private var saveError: String?
    @State private var showSaveConfirmation = false
    @State private var showDeleteConfirmation = false
    @State private var isDeletingAccount = false
    @State private var deleteError: String?
    @State private var weightText: String = ""
    @State private var isSavingWeight = false
    @State private var weightError: String?
    @State private var remindersEnabled = true
    @State private var showCustomerCenter = false

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

                    // Lembretes (notificações locais)
                    Section("Lembretes") {
                        Toggle(isOn: $remindersEnabled) {
                            HStack {
                                Image(systemName: "bell.badge")
                                    .foregroundStyle(AthlyTheme.Color.primary)
                                    .frame(width: 28)
                                Text("Lembretes de treino")
                                    .font(AthlyTheme.Typography.body())
                                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                            }
                        }
                        .tint(AthlyTheme.Color.primary)
                        .onChange(of: remindersEnabled) { newValue in
                            Task { await NotificationService.shared.setEnabled(newValue, workouts: planVM.allWorkouts) }
                        }
                    }
                    .listRowBackground(AthlyTheme.Color.surfaceDark)

                    // Perfil (peso → estimativa de calorias)
                    Section("Perfil") {
                        HStack {
                            Image(systemName: "scalemass")
                                .foregroundStyle(AthlyTheme.Color.primary)
                                .frame(width: 28)
                            Text("Peso (kg)")
                                .font(AthlyTheme.Typography.body())
                                .foregroundStyle(AthlyTheme.Color.textPrimary)
                            Spacer()
                            TextField("70", text: $weightText)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                                .frame(width: 70)
                                .foregroundStyle(AthlyTheme.Color.textPrimary)
                            Button {
                                Task { await saveWeight() }
                            } label: {
                                if isSavingWeight {
                                    ProgressView()
                                        .tint(AthlyTheme.Color.primary)
                                        .scaleEffect(0.8)
                                } else {
                                    Text("Salvar")
                                        .font(AthlyTheme.Typography.semibold(14))
                                        .foregroundStyle(AthlyTheme.Color.primary)
                                }
                            }
                            .disabled(isSavingWeight)
                        }
                        if let weightError {
                            Text(weightError)
                                .font(AthlyTheme.Typography.body(13))
                                .foregroundStyle(AthlyTheme.Color.error)
                        }
                    }
                    .listRowBackground(AthlyTheme.Color.surfaceDark)

                    // Assinatura (Customer Center do RevenueCat: gerenciar/cancelar/restaurar)
                    Section("Assinatura") {
                        Button {
                            showCustomerCenter = true
                        } label: {
                            HStack {
                                Image(systemName: "crown.fill")
                                    .foregroundStyle(AthlyTheme.Color.primary)
                                    .frame(width: 28)
                                Text("Gerenciar assinatura")
                                    .font(AthlyTheme.Typography.body())
                                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                            }
                        }
                    }
                    .listRowBackground(AthlyTheme.Color.surfaceDark)

                    // Account
                    Section("Conta") {
                        Button("Sair", role: .destructive) {
                            authViewModel.logout()
                        }
                        .foregroundStyle(AthlyTheme.Color.error)

                        Button(role: .destructive) {
                            showDeleteConfirmation = true
                        } label: {
                            HStack {
                                Text("Excluir conta")
                                if isDeletingAccount {
                                    Spacer()
                                    ProgressView()
                                        .tint(AthlyTheme.Color.error)
                                        .scaleEffect(0.8)
                                }
                            }
                        }
                        .foregroundStyle(AthlyTheme.Color.error)
                        .disabled(isDeletingAccount)

                        if let deleteError {
                            Text(deleteError)
                                .font(AthlyTheme.Typography.body(13))
                                .foregroundStyle(AthlyTheme.Color.error)
                        }
                    }
                    .listRowBackground(AthlyTheme.Color.surfaceDark)

                    // Integração (teste HealthKit)
                    Section("Integracao") {
                        NavigationLink {
                            HealthKitRunsView(showsPlanTab: false)
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
                            Text(Bundle.main.appVersionDisplay)
                                .font(AthlyTheme.Typography.medium(16))
                                .foregroundStyle(AthlyTheme.Color.textSecondary)
                        }

                        NavigationLink {
                            PrivacyPolicyView()
                        } label: {
                            Text("Política de Privacidade")
                                .font(AthlyTheme.Typography.body())
                                .foregroundStyle(AthlyTheme.Color.textPrimary)
                        }

                        NavigationLink {
                            SupportView()
                        } label: {
                            Text("Suporte")
                                .font(AthlyTheme.Typography.body())
                                .foregroundStyle(AthlyTheme.Color.textPrimary)
                        }

                        Link(destination: URL(string: "https://athlyproject.app/terms")!) {
                            Text("Termos de Uso")
                                .font(AthlyTheme.Typography.body())
                                .foregroundStyle(AthlyTheme.Color.textPrimary)
                        }
                    }
                    .listRowBackground(AthlyTheme.Color.surfaceDark)
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
                .athlyTabBarContentClearance()
            }
            .navigationTitle("Perfil")
            .task { await loadProfile() }
            .alert("Excluir conta", isPresented: $showDeleteConfirmation) {
                Button("Cancelar", role: .cancel) {}
                Button("Excluir", role: .destructive) {
                    Task { await deleteAccount() }
                }
            } message: {
                Text("Isso apaga permanentemente sua conta e todos os seus dados (plano, treinos e histórico). Esta ação não pode ser desfeita.")
            }
            .sheet(isPresented: $showCustomerCenter) {
                CustomerCenterView()
            }
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
        remindersEnabled = NotificationService.shared.isEnabled
        do {
            let profile = try await APIClient.shared.getUserProfile()
            userProfile = profile
            if let days = profile.availableDays {
                selectedDays = Set(days)
            }
            if let w = profile.weight {
                UserMetrics.weightKg = w
                weightText = String(format: "%.0f", w)
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
            let request = UpdateProfileRequest(name: userProfile?.name, weight: nil, availableDays: Array(selectedDays))
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

    private func saveWeight() async {
        let normalized = weightText.replacingOccurrences(of: ",", with: ".")
        guard let kg = Double(normalized), kg > 0, kg < 400 else {
            weightError = "Informe um peso válido em kg."
            return
        }
        isSavingWeight = true
        weightError = nil
        do {
            let request = UpdateProfileRequest(name: userProfile?.name, weight: kg, availableDays: nil)
            let updated = try await APIClient.shared.updateProfile(request)
            userProfile = updated
            let saved = updated.weight ?? kg
            UserMetrics.weightKg = saved
            weightText = String(format: "%.0f", saved)
        } catch {
            weightError = error.localizedDescription
        }
        isSavingWeight = false
    }

    private func deleteAccount() async {
        isDeletingAccount = true
        deleteError = nil
        let ok = await authViewModel.deleteAccount()
        isDeletingAccount = false
        if !ok {
            deleteError = authViewModel.errorMessage ?? "Não foi possível excluir a conta. Tente novamente."
        }
        // Em caso de sucesso, authViewModel.isAuthenticated vira false e a RootView volta ao login.
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
