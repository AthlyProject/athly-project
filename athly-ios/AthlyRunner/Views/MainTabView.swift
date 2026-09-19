import SwiftUI
import UIKit

struct MainTabView: View {
    @EnvironmentObject var planVM: TrainingPlanViewModel
    @EnvironmentObject var locationManager: LocationManager
    @EnvironmentObject var runStore: RunStore
    @State private var selectedTab: AppTab = .dashboard
    @State private var isRunInProgress = false
    @State private var pendingWorkout: WorkoutModel?

    /// Corrida do Apple Health ainda não reivindicada, detectada ao abrir o app.
    @State private var detectedRun: HealthKitRunItem?
    @State private var isDetecting = false

    var body: some View {
        Group {
            switch selectedTab {
            case .dashboard:
                DashboardView(
                    selectedTab: $selectedTab,
                    pendingWorkout: $pendingWorkout,
                    onOpenPlanCalendar: {
                        withAnimation(.easeInOut(duration: 0.2)) { selectedTab = .plan }
                    }
                )
            case .plan:
                PlanView(onStartWorkout: { workout in
                    pendingWorkout = workout
                    withAnimation(.easeInOut(duration: 0.2)) { selectedTab = .run }
                })
            case .run:
                RunStartView(isRunInProgress: $isRunInProgress, pendingWorkout: $pendingWorkout)
            case .history:
                HistoryView()
            case .profile:
                ProfileView()
            }
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
        .task { await detectUnclaimedRun() }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in
            Task { await detectUnclaimedRun() }
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
            await planVM.loadData(reportErrors: false)
        }

        guard let run = await DetectedRunService.detect(localSessions: runStore.sessions) else { return }
        guard !isRunInProgress, detectedRun == nil else { return }
        detectedRun = run
    }
}
