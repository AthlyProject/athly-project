import SwiftUI
import CoreLocation

/// S1 · Revelação de uma corrida do Apple Health que o Athly não iniciou.
/// Pergunta "este treino estava no seu plano?" e encaminha para corrida livre ou vínculo.
struct DetectedRunView: View {
    @StateObject private var viewModel: DetectedRunViewModel

    @EnvironmentObject private var planVM: TrainingPlanViewModel
    @EnvironmentObject private var runStore: RunStore

    /// Chamado quando o fluxo termina (salvou, vinculou ou ignorou).
    let onFinish: () -> Void
    /// Abre o treino vinculado no Plano.
    var onOpenPlan: (() -> Void)?

    init(run: HealthKitRunItem, onFinish: @escaping () -> Void, onOpenPlan: (() -> Void)? = nil) {
        _viewModel = StateObject(wrappedValue: DetectedRunViewModel(run: run))
        self.onFinish = onFinish
        self.onOpenPlan = onOpenPlan
    }

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark
                .ignoresSafeArea()

            switch viewModel.step {
            case .reveal:
                revealContent
            case .linked:
                DetectedRunLinkedView(
                    run: viewModel.run,
                    workout: viewModel.linkedWorkout,
                    onOpenPlan: {
                        onFinish()
                        onOpenPlan?()
                    },
                    onDismiss: onFinish
                )
            }
        }
        .task { await viewModel.loadDetail() }
        .sheet(isPresented: $viewModel.isShowingLinkSheet) {
            DetectedRunLinkSheet(viewModel: viewModel)
                .environmentObject(planVM)
                .environmentObject(runStore)
        }
    }

    // MARK: - S1 · Reveal

    private var revealContent: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: 0) {
                    header
                    hero
                        .padding(.horizontal, AthlyTheme.Spacing.sm)
                    stats
                        .padding(.horizontal, AthlyTheme.Spacing.sm)
                        .padding(.top, 12)
                    question
                    options
                    if let errorMessage = viewModel.errorMessage {
                        Text(errorMessage)
                            .font(AthlyTheme.Typography.body(12))
                            .foregroundStyle(AthlyTheme.Color.error)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, AthlyTheme.Spacing.sm)
                            .padding(.top, 12)
                    }
                }
                .padding(.bottom, AthlyTheme.Spacing.sm)
            }
            .scrollContentBackground(.hidden)

            footer
        }
    }

    private var header: some View {
        VStack(spacing: 4) {
            HStack(spacing: 5) {
                Image(systemName: "sparkles")
                    .font(.system(size: 10, weight: .semibold))
                Text("Athly detectou")
                    .font(AthlyTheme.Typography.semibold(9))
                    .textCase(.uppercase)
                    .tracking(1)
            }
            .foregroundStyle(AthlyTheme.Color.primary)

            Text("Nova atividade encontrada")
                .font(AthlyTheme.Typography.heading(17))
                .foregroundStyle(AthlyTheme.Color.textPrimary)

            Text(formattedRunDate)
                .font(AthlyTheme.Typography.mono(10))
                .foregroundStyle(AthlyTheme.Color.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, AthlyTheme.Spacing.sm)
        .padding(.top, 8)
        .padding(.bottom, 12)
    }

    private var hero: some View {
        ZStack {
            if let coordinates = routeCoordinates {
                SummaryMapView(coordinates: coordinates)
                    .allowsHitTesting(false)
            } else {
                heroPlaceholder
            }

            // Scrim para a legenda permanecer legível sobre o mapa ou o gradiente.
            VStack {
                Spacer()
                LinearGradient(
                    colors: [Color.clear, AthlyTheme.Color.backgroundDark.opacity(0.86)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 88)
            }

            VStack {
                HStack {
                    sourceBadge
                    Spacer()
                    detectedBadge
                }
                Spacer()
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Corrida ao ar livre")
                            .font(AthlyTheme.Typography.semibold(9))
                            .textCase(.uppercase)
                            .tracking(1)
                            .foregroundStyle(AthlyTheme.Color.primary)
                        Text(runTitle)
                            .font(AthlyTheme.Typography.heading(20))
                            .foregroundStyle(AthlyTheme.Color.textPrimary)
                    }
                    Spacer()
                }
            }
            .padding(12)
        }
        .frame(height: 186)
        .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous)
                .stroke(AthlyTheme.Color.borderMid, lineWidth: 1)
        )
    }

    /// Fundo usado quando a corrida não tem rota (esteira, Garmin/Nike sem GPS exportado).
    private var heroPlaceholder: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(hex: "#0B2740"),
                    Color(hex: "#12143A"),
                    Color(hex: "#2A1250")
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            GeometryReader { geo in
                Path { path in
                    let step: CGFloat = 22
                    var x: CGFloat = 0
                    while x <= geo.size.width {
                        path.move(to: CGPoint(x: x, y: 0))
                        path.addLine(to: CGPoint(x: x, y: geo.size.height))
                        x += step
                    }
                    var y: CGFloat = 0
                    while y <= geo.size.height {
                        path.move(to: CGPoint(x: 0, y: y))
                        path.addLine(to: CGPoint(x: geo.size.width, y: y))
                        y += step
                    }
                }
                .stroke(Color.white.opacity(0.05), lineWidth: 1)
            }

            if viewModel.isLoadingDetail {
                ProgressView()
                    .tint(AthlyTheme.Color.primary)
            } else {
                Image(systemName: "figure.run")
                    .font(.system(size: 40, weight: .light))
                    .foregroundStyle(Color.white.opacity(0.18))
            }
        }
    }

    private var sourceBadge: some View {
        HStack(spacing: 5) {
            Image(systemName: "heart.fill")
                .font(.system(size: 9))
                .foregroundStyle(Color(hex: "#FF4B5C"))
            Text("Apple Saúde")
                .font(AthlyTheme.Typography.semibold(9))
                .foregroundStyle(AthlyTheme.Color.textPrimary)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 4)
        .background(AthlyTheme.Color.backgroundDark.opacity(0.62))
        .clipShape(Capsule())
        .overlay(Capsule().stroke(AthlyTheme.Color.borderMid, lineWidth: 1))
    }

    private var detectedBadge: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(AthlyTheme.Color.success)
                .frame(width: 5, height: 5)
            Text("Detectada")
                .font(AthlyTheme.Typography.semibold(9))
        }
        .foregroundStyle(AthlyTheme.Color.success)
        .padding(.horizontal, 9)
        .padding(.vertical, 4)
        .background(AthlyTheme.Color.success.opacity(0.16))
        .clipShape(Capsule())
        .overlay(Capsule().stroke(AthlyTheme.Color.success.opacity(0.22), lineWidth: 1))
    }

    private var stats: some View {
        DetectedRunStatsRow {
            DetectedRunStatCell(value: viewModel.run.formattedDuration, key: "Tempo")
            DetectedRunStatDivider()
            DetectedRunStatCell(value: viewModel.run.formattedDistance, unit: "km", key: "Distância")
            DetectedRunStatDivider()
            DetectedRunStatCell(value: viewModel.run.formattedPace, key: "Pace /km")
            DetectedRunStatDivider()
            DetectedRunStatCell(
                value: viewModel.averageHeartRate.map(String.init) ?? "--",
                key: "FC média"
            )
        }
    }

    private var question: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("Este treino estava no seu plano?")
                .font(AthlyTheme.Typography.semibold(12))
                .textCase(.uppercase)
                .tracking(0.5)
                .foregroundStyle(AthlyTheme.Color.textSecondary)
            Text("Vincule a um treino planejado ou marque como corrida livre.")
                .font(AthlyTheme.Typography.body(10))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, AthlyTheme.Spacing.sm)
        .padding(.top, 18)
    }

    private var options: some View {
        VStack(spacing: 9) {
            DetectedRunOptionCard(
                systemImage: "heart.fill",
                iconTint: AthlyTheme.Color.warning,
                title: "Corri por conta própria",
                subtitle: "Fora do plano — mas todo quilômetro conta pra sua evolução.",
                isSelected: viewModel.choice == .freeRun,
                showsChevron: false,
                action: { viewModel.choice = .freeRun }
            )

            DetectedRunOptionCard(
                systemImage: "calendar",
                iconTint: AthlyTheme.Color.primary,
                title: "Vincular a um treino",
                subtitle: "Escolha o treino planejado no calendário.",
                isSelected: viewModel.choice == .linkToWorkout,
                showsChevron: true,
                action: {
                    viewModel.choice = .linkToWorkout
                    viewModel.isShowingLinkSheet = true
                }
            )
        }
        .padding(.horizontal, AthlyTheme.Spacing.sm)
        .padding(.top, 12)
    }

    private var footer: some View {
        VStack(spacing: 11) {
            Button {
                Task { await primaryAction() }
            } label: {
                HStack(spacing: 7) {
                    if viewModel.isSubmitting {
                        ProgressView().tint(.white).scaleEffect(0.85)
                    }
                    Text("Continuar")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(AthlyGradientButtonStyle())
            .disabled(viewModel.isSubmitting)

            Button {
                viewModel.ignore()
                onFinish()
            } label: {
                Text("Ignorar esta atividade")
                    .font(AthlyTheme.Typography.semibold(11))
                    .underline()
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
            }
            .buttonStyle(.plain)
            .disabled(viewModel.isSubmitting)
        }
        .padding(.horizontal, AthlyTheme.Spacing.sm)
        .padding(.top, 14)
        .padding(.bottom, 14)
        .background(AthlyTheme.Color.backgroundDark)
    }

    // MARK: - Ações

    private func primaryAction() async {
        switch viewModel.choice {
        case .freeRun:
            if await viewModel.saveAsFreeRun(runStore: runStore) {
                onFinish()
            }
        case .linkToWorkout:
            // Sem treino escolhido ainda, "Continuar" reabre o calendário.
            if let workout = viewModel.selectedWorkout {
                _ = await viewModel.link(to: workout, planVM: planVM, runStore: runStore)
            } else {
                viewModel.isShowingLinkSheet = true
            }
        }
    }

    // MARK: - Helpers

    private var routeCoordinates: [CLLocationCoordinate2D]? {
        guard let detail = viewModel.routeDetail, detail.hasRoute else { return nil }
        return detail.coordinates.map {
            CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude)
        }
    }

    /// "Quarta · 9 de setembro"
    private var formattedRunDate: String {
        let weekday = DateFormatter()
        weekday.locale = .current
        weekday.dateFormat = "EEEE"

        let day = DateFormatter()
        day.locale = .current
        day.setLocalizedDateFormatFromTemplate("dMMMM")

        return "\(weekday.string(from: viewModel.run.startDate).capitalized) · \(day.string(from: viewModel.run.startDate))"
    }

    /// "Corrida da manhã" / "da tarde" / "da noite", pelo horário de início.
    private var runTitle: String {
        let hour = Calendar.current.component(.hour, from: viewModel.run.startDate)
        switch hour {
        case 5..<12:  return String(localized: "Corrida da manhã")
        case 12..<18: return String(localized: "Corrida da tarde")
        default:      return String(localized: "Corrida da noite")
        }
    }
}
