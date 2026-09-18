import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var planVM: TrainingPlanViewModel
    @EnvironmentObject var locationManager: LocationManager
    @State private var selectedTab: AppTab = .dashboard
    @State private var isRunInProgress = false
    @State private var pendingWorkout: WorkoutModel?

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
    }
}
