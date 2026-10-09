import SwiftUI
import UIKit

struct MainTabView: View {
    @EnvironmentObject var planVM: TrainingPlanViewModel
    @EnvironmentObject var runStore: RunStore
    @State private var selectedTab: AppTab = .dashboard
    @State private var isRunInProgress = false
    @State private var pendingWorkout: WorkoutModel?

    /// Corrida do Apple Health ainda não reivindicada, detectada ao abrir o app.
    @State private var detectedRun: HealthKitRunItem?
    @State private var isDetecting = false

    var body: some View {
        TabView(selection: $selectedTab) {
            DashboardView(selectedTab: $selectedTab, pendingWorkout: $pendingWorkout,
                          onOpenPlanCalendar: { selectedTab = .plan })
                .environment(\.isAppTabActive, selectedTab == .dashboard)
                .toolbar(.hidden, for: .tabBar)
                .tag(AppTab.dashboard)
            PlanView(onStartWorkout: { workout in
                pendingWorkout = workout
                selectedTab = .run
            })
                .environment(\.isAppTabActive, selectedTab == .plan)
                .toolbar(.hidden, for: .tabBar)
                .tag(AppTab.plan)
            RunStartView(isRunInProgress: $isRunInProgress, pendingWorkout: $pendingWorkout)
                .environment(\.isAppTabActive, selectedTab == .run)
                .toolbar(.hidden, for: .tabBar)
                .tag(AppTab.run)
            HistoryView()
                .environment(\.isAppTabActive, selectedTab == .history)
                .toolbar(.hidden, for: .tabBar)
                .tag(AppTab.history)
            ProfileView()
                .environment(\.isAppTabActive, selectedTab == .profile)
                .toolbar(.hidden, for: .tabBar)
                .tag(AppTab.profile)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if !isRunInProgress {
                VStack(spacing: 0) {
                    Color.clear
                        .frame(height: AthlyTheme.Layout.floatingTabBarTopClearance)
                        .allowsHitTesting(false)

                    FloatingTabBar(selectedTab: $selectedTab)
                        .padding(.bottom, AthlyTheme.Layout.floatingTabBarBottomPadding)
                }
            }
        }
        .overlay(alignment: .top) {
            if planVM.showNextWeekNotice || planVM.generationErrorMessage != nil {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "sparkles")
                        .foregroundStyle(AthlyTheme.Color.primary)
                    VStack(alignment: .leading, spacing: 8) {
                        Text(planVM.generationErrorMessage ?? String(localized: "Seus treinos estão sendo preparados. Avisaremos quando estiverem prontos."))
                            .font(AthlyTheme.Typography.body(14))
                        if planVM.canRetryGeneration {
                            Button("Tentar novamente") {
                                Task { await planVM.refreshAutomaticGeneration(retryFailed: true) }
                            }
                            .disabled(planVM.isResumingPlan)
                        }
                    }
                    Button {
                        planVM.showNextWeekNotice = false
                        planVM.generationErrorMessage = nil
                    } label: {
                        Image(systemName: "xmark")
                    }
                    .accessibilityLabel(Text("Fechar"))
                }
                .padding(AthlyTheme.Spacing.sm)
                .athlyCard()
                .padding(.horizontal, AthlyTheme.Spacing.sm)
                .accessibilityElement(children: .combine)
            }
        }
        .ignoresSafeArea(.keyboard)
        .alert("Erro", isPresented: Binding(
            get: { planVM.errorMessage != nil },
            set: { if !$0 { planVM.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) { planVM.errorMessage = nil }
        } message: {
            Text(planVM.errorMessage ?? "")
        }
        .fullScreenCover(item: $detectedRun) { run in
            DetectedRunView(
                run: run,
                onFinish: { detectedRun = nil },
                onOpenPlan: {
                    withAnimation(.easeInOut(duration: 0.2)) { selectedTab = .plan }
                }
            )
            .environmentObject(planVM)
            .environmentObject(runStore)
        }
        .onChange(of: planVM.confirmedWorkoutsRevision) { _ in
            runStore.reconcileConfirmedWorkouts(planVM.allWorkouts)
        }
        .task {
            await LocalStoresBootstrap.prepare()
            await runStore.loadIfNeeded()
            if planVM.confirmedWorkoutsRevision > 0 { runStore.reconcileConfirmedWorkouts(planVM.allWorkouts) }
            await detectUnclaimedRun()
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.significantTimeChangeNotification)) { _ in
            planVM.refreshCalendar()
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name.NSSystemTimeZoneDidChange)) { _ in
            planVM.refreshCalendar()
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in
            planVM.refreshCalendar()
            Task { await planVM.loadIfNeeded(); await detectUnclaimedRun() }
        }
    }

    /// Procura uma corrida do Apple Health que o Athly não iniciou nem vinculou.
    /// Oportunista: nunca bloqueia a abertura do app e nunca mostra erro.
    private func detectUnclaimedRun() async {
        // Não interromper uma corrida em andamento, nem empilhar detecções/telas.
        guard !isRunInProgress, !isDetecting, detectedRun == nil else { return }
        isDetecting = true
        defer { isDetecting = false }

        // O caminho "vincular a um treino" precisa do plano carregado para ter candidatos.
        if planVM.allWorkouts.isEmpty {
            await planVM.loadData(reportErrors: false, force: false)
        }

        guard let run = await DetectedRunService.detect(localSessions: runStore.sessions) else { return }
        guard !isRunInProgress, detectedRun == nil else { return }
        detectedRun = run
    }
}

private struct AppTabActiveKey: EnvironmentKey {
    static let defaultValue = true
}

extension EnvironmentValues {
    var isAppTabActive: Bool {
        get { self[AppTabActiveKey.self] }
        set { self[AppTabActiveKey.self] = newValue }
    }
}
