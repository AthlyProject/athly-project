import SwiftUI
import os
import UniformTypeIdentifiers
import CoreLocation

struct WorkoutCompletionSheet: View {
    let workout: WorkoutModel
    var initialStep: Step = .healthKit
    let onComplete: (WorkoutCompletionSelection, ImportedWorkoutHealthKitFallback) async -> WorkoutCompletionOutcome
    let onDismiss: () -> Void

    // MARK: - Step machine

    enum Step {
        case healthKit
        case preview
        case feedback
        case completed
    }

    @State private var heartRateSuggestion: WorkoutHeartRateSuggestion?
    @State private var step: Step
    @State private var selection: WorkoutCompletionSelection = .none
    @State private var previewHealthRun: HealthKitRunItem?
    @State private var previewDetail: RunRouteDetail?
    @State private var previewSourceIsHealth = false
    @State private var isLoadingPreview = false
    @State private var feedbackOrigin: Step = .healthKit

    init(
        workout: WorkoutModel,
        initialStep: Step = .healthKit,
        onComplete: @escaping (WorkoutCompletionSelection, ImportedWorkoutHealthKitFallback) async -> WorkoutCompletionOutcome,
        onDismiss: @escaping () -> Void
    ) {
        self.workout = workout
        self.initialStep = initialStep
        self.onComplete = onComplete
        self.onDismiss = onDismiss
        _step = State(initialValue: initialStep)
    }

    // HealthKit loading
    @State private var windowHealthRuns: [HealthKitRunItem] = []
    @State private var zeppRuns: [ImportedWorkout] = []
    @State private var healthRoutes: [String: Bool] = [:]
    @State private var zeppConnected = false
    @State private var zeppLoading = false
    @State private var zeppError: String?
    @State private var zeppTask: Task<Void, Never>?
    @State private var todayRuns: [HealthKitRunItem] = []
    @State private var isLoading = true
    @State private var loadError: String?

    // Feedback form
    @State private var completed: Bool = true
    @State private var effort: Int = 5
    @State private var fatigue: Int = 5
    @State private var isSubmitting = false
    @State private var submitError: String?
    @State private var isCompleting = false

    // File import
    @State private var isShowingFileImporter = false
    @State private var isImportingFile = false
    @State private var importedCandidates: [ImportedWorkout] = []
    @State private var selectedImportedWorkout: ImportedWorkout?
    @State private var saveImportedToHealthKit = true
    @State private var importError: String?
    @State private var showOutsideDateConfirmation = false
    @State private var includeFeedbackAfterDateConfirmation = false
    @State private var showHealthKitFallback = false
    @State private var healthKitFallbackMessage: String?

    private var loadsCandidates = true
    private let calendar = Calendar.current
    private static let diagLogger = Logger(subsystem: "com.athly.healthkit.diag", category: "WorkoutQuery")

    #if DEBUG
    static func renderFixture(workout: WorkoutModel, activity: ImportedWorkout, showPreview: Bool) -> Self {
        var view = Self(workout: workout, onComplete: { _, _ in .success(nil) }, onDismiss: {})
        view.loadsCandidates = false
        view._isLoading = State(initialValue: false)
        view._zeppConnected = State(initialValue: true)
        view._zeppRuns = State(initialValue: [activity])
        if showPreview {
            view._selectedImportedWorkout = State(initialValue: activity)
            view._selection = State(initialValue: .imported(activity, saveToHealthKit: true))
            view._step = State(initialValue: .preview)
        }
        return view
    }
    #endif

    var body: some View {
        NavigationStack {
            ZStack {
                AthlyTheme.Color.backgroundDark
                    .ignoresSafeArea()

                if step == .completed {
                    ScrollView {
                        VStack(spacing: 20) {
                            Label("Treino concluído", systemImage: "checkmark.circle.fill").font(.title2)
                            if let suggestion = heartRateSuggestion { WorkoutHeartRateSuggestionCard(suggestion: suggestion) }
                            Button("Concluir", action: onDismiss).buttonStyle(AthlyPrimaryButtonStyle())
                        }.padding()
                    }
                } else if step == .healthKit {
                    healthKitContent
                } else if step == .preview {
                    activityPreview
                } else {
                    feedbackContent
                }
            }
            .navigationTitle(navigationTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    if step == .feedback || step == .preview {
                        Button("Voltar") { step = step == .feedback ? feedbackOrigin : .healthKit }
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                    } else {
                        Button(step == .completed ? String(localized: "Concluir") : String(localized: "Cancelar")) { onDismiss() }
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    if step == .healthKit {
                        Menu {
                            Button { isShowingFileImporter = true } label: {
                                Label("Importar FIT, TCX ou GPX", systemImage: "doc.badge.plus")
                            }
                            if zeppConnected {
                                Button { refreshZepp() } label: {
                                    Label("Atualizar atividades", systemImage: "arrow.clockwise")
                                }
                            }
                        } label: { Image(systemName: "ellipsis.circle") }
                        .accessibilityLabel("Mais opções")
                    }
                }
            }
            .disabled(isCompleting || isSubmitting)
        }
        .task {
            guard loadsCandidates else { return }
            zeppTask = Task { await loadZeppCandidates() }
            await loadCandidateRuns()
        }
        .onDisappear { zeppTask?.cancel() }
        .fileImporter(
            isPresented: $isShowingFileImporter,
            allowedContentTypes: supportedImportTypes,
            allowsMultipleSelection: false
        ) { result in
            handleFileImport(result)
        }
        .alert("A data não coincide com o treino", isPresented: $showOutsideDateConfirmation) {
            Button("Cancelar", role: .cancel) {}
            Button("Usar mesmo assim") { selectImportedForCompletion() }
        } message: {
            if let imported = selectedImportedWorkout {
                Text("A atividade é de \(imported.startDate.formatted(date: .abbreviated, time: .shortened)), fora da janela planejada. Confirme que é a corrida correta.")
            }
        }
        .confirmationDialog(
            "Não foi possível atualizar a corrida original",
            isPresented: $showHealthKitFallback,
            titleVisibility: .visible
        ) {
            Button("Manter somente no Athly") {
                Task { await finishCompletion(fallback: .localOnly) }
            }
            Button("Criar cópia completa no Apple Health") {
                Task { await finishCompletion(fallback: .createCopy) }
            }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text(healthKitFallbackMessage ?? String(localized: "O Apple Health recusou a associação da rota."))
                + Text(" Uma cópia não remove automaticamente o registro Garmin/Zepp.")
        }
    }

    // MARK: - Step 1: HealthKit selection

    private var healthKitContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(workout.title)
                        .font(AthlyTheme.Typography.semibold(17))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                    Text("Escolha uma corrida para conferir os dados antes de vincular.")
                        .font(AthlyTheme.Typography.body(14))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }
                .padding(.horizontal, AthlyTheme.Spacing.sm)

                if isLoading {
                    ProgressView("Buscando no Apple Health…").padding(.horizontal, AthlyTheme.Spacing.sm)
                } else if let error = loadError {
                    Text(error).font(.footnote).foregroundStyle(AthlyTheme.Color.textSecondary)
                        .padding(.horizontal, AthlyTheme.Spacing.sm)
                }
                if !visibleHealthRuns.isEmpty {
                    sourceHeading("Apple Health")
                    ForEach(visibleHealthRuns) { run in healthRunCard(run) }
                }
                if zeppConnected && !visibleZeppRuns.isEmpty {
                    sourceHeading("Zepp")
                    ForEach(visibleZeppRuns) { imported in
                        Button { selectZepp(imported) } label: { importedActivityRow(imported) }
                            .buttonStyle(.plain)
                            .padding(.horizontal, AthlyTheme.Spacing.sm)
                    }
                }
                if zeppConnected && zeppLoading && zeppRuns.isEmpty {
                    ProgressView("Buscando no Zepp…")
                        .font(.footnote).padding(.horizontal, AthlyTheme.Spacing.sm)
                }
                if let zeppError, zeppConnected {
                    Text(zeppError).font(.footnote).foregroundStyle(AthlyTheme.Color.textSecondary)
                        .padding(.horizontal, AthlyTheme.Spacing.sm)
                }
                if !isLoading && !zeppLoading && visibleHealthRuns.isEmpty && visibleZeppRuns.isEmpty {
                    VStack(spacing: 10) {
                        Image(systemName: "figure.run").font(.title)
                        Text("Nenhuma corrida disponível neste período")
                            .font(AthlyTheme.Typography.semibold(16))
                        Text("Buscamos no dia planejado e nos dois dias seguintes. Sincronize o relógio ou importe um arquivo em Mais opções.")
                            .font(AthlyTheme.Typography.body(14)).multilineTextAlignment(.center)
                    }.foregroundStyle(AthlyTheme.Color.textSecondary).padding()
                }
                if isImportingFile { ProgressView("Lendo atividade…").padding() }
                if let importError { Text(importError).font(.footnote).foregroundStyle(AthlyTheme.Color.error).padding() }
                if importedCandidates.count > 1 {
                    sourceHeading(String(localized: "Atividades do arquivo"))
                    ForEach(importedCandidates) { imported in
                        Button { openImportedPreview(imported) } label: { importedActivityRow(imported) }
                            .buttonStyle(.plain).padding(.horizontal, AthlyTheme.Spacing.sm)
                    }
                }
                if !isEnrichment {
                    Button("Concluir sem uma corrida") {
                        selection = .none
                        feedbackOrigin = .healthKit
                        step = .feedback
                    }
                    .font(AthlyTheme.Typography.body(14))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                    .frame(maxWidth: .infinity).padding(.vertical, 16)
                }
            }.padding(.vertical, 20)
        }
        .scrollContentBackground(.hidden)
    }

    private func sourceHeading(_ source: String) -> some View {
        Text(source).font(AthlyTheme.Typography.semibold(13))
            .foregroundStyle(AthlyTheme.Color.textSecondary)
            .padding(.horizontal, AthlyTheme.Spacing.sm)
    }

    private func refreshZepp() {
        zeppTask?.cancel()
        zeppTask = Task { await loadZeppCandidates() }
    }

    // MARK: - Optional feedback

    private var feedbackContent: some View {
        ScrollView {
            VStack(spacing: AthlyTheme.Spacing.sm) {
                // Header
                VStack(spacing: 8) {
                    Text(completed ? "🎉" : "💪")
                        .font(.system(size: 48))
                    Text(completed ? String(localized: "Parabéns!") : String(localized: "Bom trabalho!"))
                        .font(AthlyTheme.Typography.heading(22))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                    Text("Conta como foi o seu treino")
                        .font(AthlyTheme.Typography.body(14))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)

                // Status
                completionStatusCard

                // Effort
                effortCard

                // Fatigue
                fatigueCard

                // Submit
                VStack(spacing: 12) {
                    Button {
                        Task { await submitFeedback() }
                    } label: {
                        HStack {
                            if isSubmitting {
                                ProgressView().tint(.white).scaleEffect(0.85)
                            } else {
                                Image(systemName: "chart.bar.fill")
                            }
                            Text(isSubmitting ? String(localized: "Enviando…") : String(localized: "Enviar feedback"))
                        }
                    }
                    .buttonStyle(AthlyGradientButtonStyle())
                    .disabled(isSubmitting)

                    if let submitError {
                        Text(submitError)
                            .font(AthlyTheme.Typography.body(13))
                            .foregroundStyle(AthlyTheme.Color.error)
                            .multilineTextAlignment(.center)
                    }

                    Button {
                        Task { await finishCompletion() }
                    } label: {
                        Group {
                            if isCompleting {
                                ProgressView().tint(AthlyTheme.Color.textSecondary)
                            } else {
                                Text("Pular por agora")
                            }
                        }
                        .font(AthlyTheme.Typography.body(15))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                    }
                    .buttonStyle(.plain)
                    .disabled(isCompleting)
                }
                .padding(.horizontal, AthlyTheme.Spacing.sm)
                .padding(.top, 4)
            }
            .padding(AthlyTheme.Spacing.sm)
        }
        .scrollContentBackground(.hidden)
    }

    // MARK: - Completion Status Card

    private var completionStatusCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Conseguiu completar?")
                .font(AthlyTheme.Typography.semibold(15))
                .foregroundStyle(AthlyTheme.Color.textPrimary)

            HStack(spacing: 12) {
                completionButton(label: "Sim", emoji: "✓", selected: completed) {
                    completed = true
                }
                completionButton(label: "Não", emoji: "✗", selected: !completed) {
                    completed = false
                }
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyCard()
        .padding(.horizontal, AthlyTheme.Spacing.sm)
    }

    private func completionButton(label: LocalizedStringKey, emoji: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Text(emoji)
                    .font(.system(size: 28))
                Text(label)
                    .font(AthlyTheme.Typography.semibold(15))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                selected
                    ? AthlyTheme.Gradient.brand
                    : LinearGradient(colors: [AthlyTheme.Color.surfaceDark], startPoint: .leading, endPoint: .trailing)
            )
            .foregroundStyle(selected ? Color.white : AthlyTheme.Color.textSecondary)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous)
                    .stroke(selected ? Color.clear : AthlyTheme.Color.borderDark, lineWidth: 1)
            )
            .scaleEffect(selected ? 1.03 : 1.0)
            .animation(.spring(response: 0.3), value: selected)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Effort Card

    private var effortCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Nível de Esforço")
                .font(AthlyTheme.Typography.semibold(15))
                .foregroundStyle(AthlyTheme.Color.textPrimary)

            VStack(spacing: 8) {
                HStack {
                    Text(effortEmoji)
                        .font(.system(size: 36))
                    Spacer()
                    Text("\(effort)/10")
                        .font(.custom("SpaceGrotesk-Bold", size: 28))
                        .foregroundStyle(AthlyTheme.Color.primary)
                }

                Slider(value: Binding(
                    get: { Double(effort) },
                    set: { effort = Int($0) }
                ), in: 1...10, step: 1)
                .tint(AthlyTheme.Color.primary)

                HStack {
                    Text("Fácil")
                    Spacer()
                    Text("Moderado")
                    Spacer()
                    Text("Intenso")
                }
                .font(AthlyTheme.Typography.body(11))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyCard()
        .padding(.horizontal, AthlyTheme.Spacing.sm)
    }

    // MARK: - Fatigue Card

    private var fatigueCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Nível de Fadiga")
                .font(AthlyTheme.Typography.semibold(15))
                .foregroundStyle(AthlyTheme.Color.textPrimary)

            VStack(spacing: 8) {
                HStack {
                    Text(fatigueEmoji)
                        .font(.system(size: 36))
                    Spacer()
                    Text("\(fatigue)/10")
                        .font(.custom("SpaceGrotesk-Bold", size: 28))
                        .foregroundStyle(AthlyTheme.Color.secondary)
                }

                Slider(value: Binding(
                    get: { Double(fatigue) },
                    set: { fatigue = Int($0) }
                ), in: 1...10, step: 1)
                .tint(AthlyTheme.Color.secondary)

                HStack {
                    Text("Energizado")
                    Spacer()
                    Text("Normal")
                    Spacer()
                    Text("Exausto")
                }
                .font(AthlyTheme.Typography.body(11))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
            }
        }
        .padding(AthlyTheme.Spacing.sm)
        .athlyCard()
        .padding(.horizontal, AthlyTheme.Spacing.sm)
    }

    // MARK: - Submit

    private func submitFeedback() async {
        isSubmitting = true
        submitError = nil
        let feedback = WorkoutFeedbackRequest(completed: completed, effort: effort, fatigue: fatigue)
        do {
            try await APIClient.shared.submitWorkoutFeedback(workoutId: workout.id, feedback: feedback)
            isSubmitting = false
            await finishCompletion()
        } catch {
            isSubmitting = false
            submitError = String(localized: "Não foi possível enviar o feedback. Tente novamente ou use \"Pular por agora\".")
        }
    }

    private func finishCompletion(fallback: ImportedWorkoutHealthKitFallback = .ask) async {
        guard !isCompleting else { return }
        isCompleting = true
        submitError = nil
        let outcome = await onComplete(selection, fallback)
        isCompleting = false
        switch outcome {
        case .success(let suggestion):
            if let suggestion { heartRateSuggestion = suggestion; step = .completed }
            else { onDismiss() }
        case .failure(let message):
            submitError = message
        case .healthKitFallbackRequired(let message):
            healthKitFallbackMessage = message
            showHealthKitFallback = true
        }
    }

    // MARK: - HealthKit Run Card

    private func healthRunCard(_ run: HealthKitRunItem) -> some View {
        Button {
            previewHealthRun = run
            previewSourceIsHealth = true
            previewDetail = nil
            isLoadingPreview = true
            submitError = nil
            saveImportedToHealthKit = true
            if var imported = matchingZepp(run) {
                imported.preferredHealthKitUUID = run.id
                selectedImportedWorkout = imported
                selection = .imported(imported, saveToHealthKit: true)
            } else {
                selectedImportedWorkout = nil
                selection = .healthKit(run)
            }
            step = .preview
        } label: {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(run.startDate.formatted(date: .abbreviated, time: .shortened))
                            .font(AthlyTheme.Typography.semibold(14))
                            .foregroundStyle(AthlyTheme.Color.textPrimary)
                        Text("\(run.formattedDistance) km · \(run.formattedDuration)")
                            .font(AthlyTheme.Typography.body(14))
                            .foregroundStyle(AthlyTheme.Color.textSecondary)
                    }
                    Spacer()
                    Image(systemName: "chevron.right").foregroundStyle(AthlyTheme.Color.primary)
                }
                activityIndicators(hasRoute: healthRoutes[run.id], hasHeartRate: WorkoutCompletionSelection.healthKit(run).hasHeartRate || (matchingZepp(run).map { WorkoutCompletionSelection.imported($0, saveToHealthKit: true).hasHeartRate } ?? false))
            }
            .padding(14)
            .background(AthlyTheme.Color.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, AthlyTheme.Spacing.sm)
    }

    private func metricCell(value: String, label: LocalizedStringKey) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.custom("SpaceGrotesk-Bold", size: 16).monospacedDigit())
                .foregroundStyle(AthlyTheme.Color.textPrimary)
            Text(label)
                .font(AthlyTheme.Typography.body(11))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }

    private var metricDivider: some View {
        Rectangle()
            .fill(AthlyTheme.Color.borderDark)
            .frame(width: 1, height: 32)
    }

    // MARK: - Activity preview and file import

    private func activityIndicators(hasRoute: Bool?, hasHeartRate: Bool) -> some View {
        HStack(spacing: 16) {
            Label(hasRoute == true ? String(localized: "Com rota") : hasRoute == false ? String(localized: "Sem rota") : String(localized: "Rota não verificada"),
                  systemImage: hasRoute == true ? "map.fill" : "map")
            Label(hasHeartRate ? String(localized: "Com FC") : String(localized: "Sem FC"), systemImage: hasHeartRate ? "heart.fill" : "heart")
        }
        .font(AthlyTheme.Typography.body(12))
        .foregroundStyle(AthlyTheme.Color.textSecondary)
        .fixedSize(horizontal: false, vertical: true)
    }

    private func importedActivityRow(_ imported: ImportedWorkout) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(imported.startDate.formatted(date: .abbreviated, time: .shortened))
                        .font(AthlyTheme.Typography.semibold(14))
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                    Text("\(LocalizedFormatting.formattedDistanceKm(imported.distanceMeters / 1_000)) km · \(formatDuration(imported.activeDurationSeconds))")
                        .font(AthlyTheme.Typography.body(14))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(AthlyTheme.Color.primary)
            }
            activityIndicators(hasRoute: imported.hasRoute,
                hasHeartRate: WorkoutCompletionSelection.imported(imported, saveToHealthKit: false).hasHeartRate)
        }
        .padding(14)
        .background(AthlyTheme.Color.surfaceCard)
        .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.card, style: .continuous))
    }

    private var previewCoordinates: [CLLocationCoordinate2D] {
        if let detail = previewDetail, detail.hasRoute {
            return detail.coordinates.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
        }
        return selectedImportedWorkout?.route.map(\.coordinate) ?? []
    }

    private var previewHasHeartRate: Bool {
        selection.hasHeartRate || (previewHealthRun.map { WorkoutCompletionSelection.healthKit($0).hasHeartRate } ?? false)
            || (previewDetail?.avgHR.map { $0.isFinite && $0 > 0 } ?? false)
            || (previewDetail?.maxHR.map { $0.isFinite && $0 > 0 } ?? false)
    }

    private var activityPreview: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(previewSourceIsHealth ? "Apple Health" : selectedImportedWorkout?.zeppActivityId != nil ? "Zepp" : selectedImportedWorkout?.format.displayName ?? "")
                        .font(AthlyTheme.Typography.semibold(13)).foregroundStyle(AthlyTheme.Color.primary)
                    if let date = previewHealthRun?.startDate ?? selectedImportedWorkout?.startDate {
                        Text(date.formatted(date: .abbreviated, time: .shortened))
                            .font(AthlyTheme.Typography.heading(20))
                    }
                    Text("Treino: \(workout.title)").font(AthlyTheme.Typography.body(14))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                }
                if isLoadingPreview {
                    ProgressView("Carregando rota e frequência cardíaca…").frame(maxWidth: .infinity, minHeight: 180)
                } else if previewCoordinates.count >= 2 {
                    SummaryMapView(coordinates: previewCoordinates)
                        .allowsHitTesting(false).frame(height: 210)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                } else {
                    Label(previewRouteUnavailableText, systemImage: "map")
                        .font(AthlyTheme.Typography.body(14))
                        .foregroundStyle(AthlyTheme.Color.textSecondary)
                        .frame(maxWidth: .infinity, minHeight: 100)
                        .background(AthlyTheme.Color.surfaceCard)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                HStack(spacing: 0) {
                    metricCell(value: previewHealthRun?.formattedDistance ?? LocalizedFormatting.formattedDistanceKm((selectedImportedWorkout?.distanceMeters ?? 0) / 1_000), label: "km")
                    metricDivider
                    metricCell(value: previewHealthRun?.formattedDuration ?? formatDuration(selectedImportedWorkout?.activeDurationSeconds ?? 0), label: "tempo")
                    metricDivider
                    metricCell(value: previewHealthRun?.formattedPace ?? formatPace(selectedImportedWorkout?.averagePaceSecondsPerKm ?? 0), label: "pace/km")
                }.padding(.vertical, 8)
                if !isLoadingPreview {
                    let average = [previewHealthRun?.avgHR, previewDetail?.avgHR, selectedImportedWorkout?.averageHeartRate]
                        .compactMap { $0 }.first { $0.isFinite && $0 > 0 }
                    let maximum = [previewHealthRun?.maxHR, previewDetail?.maxHR, selectedImportedWorkout?.maximumHeartRate]
                        .compactMap { $0 }.first { $0.isFinite && $0 > 0 }
                    if previewHasHeartRate {
                        HStack {
                            Label("Frequência cardíaca", systemImage: "heart.fill")
                                .foregroundStyle(AthlyTheme.Color.primary)
                            Spacer()
                            VStack(alignment: .trailing, spacing: 4) {
                                if let average, average.isFinite, average > 0 { Text("Média: \(Int(average)) bpm") }
                                if let maximum, maximum.isFinite, maximum > 0 { Text("Máxima: \(Int(maximum)) bpm") }
                            }
                        }.font(AthlyTheme.Typography.body(14))
                    } else {
                        Label("Esta corrida não tem frequência cardíaca disponível.", systemImage: "heart")
                            .font(AthlyTheme.Typography.body(14)).foregroundStyle(AthlyTheme.Color.textSecondary)
                    }
                }
                if let imported = selectedImportedWorkout {
                    if !previewSourceIsHealth {
                        Toggle("Salvar também no Apple Health", isOn: $saveImportedToHealthKit)
                            .font(AthlyTheme.Typography.body(14)).tint(AthlyTheme.Color.primary)
                    }
                    ForEach(imported.warnings, id: \.self) { warning in
                        Label(warning, systemImage: "exclamationmark.triangle").font(.footnote)
                            .foregroundStyle(AthlyTheme.Color.warning)
                    }
                }
                if let submitError {
                    Text(submitError).font(.footnote).foregroundStyle(AthlyTheme.Color.error)
                }
                Button { requestPreviewConfirmation() } label: {
                    Text(isEnrichment ? String(localized: "Adicionar dados ao treino") : previewHasHeartRate ? String(localized: "Vincular e concluir") : String(localized: "Continuar"))
                }
                .buttonStyle(AthlyGradientButtonStyle())
                .disabled(isLoadingPreview || isCompleting || isSubmitting)
                if !isEnrichment && previewHasHeartRate {
                    Button("Adicionar como me senti (opcional)") { requestPreviewConfirmation(includeFeedback: true) }
                        .font(AthlyTheme.Typography.body(14))
                        .foregroundStyle(AthlyTheme.Color.textSecondary).frame(maxWidth: .infinity)
                        .disabled(isLoadingPreview || isCompleting || isSubmitting)
                }
                if isCompleting { ProgressView("Salvando…").frame(maxWidth: .infinity) }
            }.padding(20)
        }
        .foregroundStyle(AthlyTheme.Color.textPrimary)
        .task { await loadPreviewDetail() }
    }

    private var previewRouteUnavailableText: String {
        if let run = previewHealthRun, healthRoutes[run.id] != false {
            return String(localized: "Não foi possível confirmar a rota no Apple Health.")
        }
        return String(localized: "Esta corrida não tem rota disponível.")
    }

    private func loadPreviewDetail() async {
        guard let run = previewHealthRun else { isLoadingPreview = false; return }
        isLoadingPreview = true
        defer { isLoadingPreview = false }
        let detail = await HealthKitService().fetchRunDetail(workoutUUID: run.id)
        guard !Task.isCancelled else { return }
        previewDetail = detail
    }

    private func openImportedPreview(_ imported: ImportedWorkout) {
        selectedImportedWorkout = imported
        previewHealthRun = nil
        previewDetail = nil
        previewSourceIsHealth = false
        isLoadingPreview = false
        submitError = nil
        selection = .imported(imported, saveToHealthKit: saveImportedToHealthKit)
        step = .preview
    }

    private func confirmPreview(includeFeedback: Bool = false) {
        submitError = nil
        if let imported = selectedImportedWorkout {
            if saveImportedToHealthKit && !previewSourceIsHealth && todayRuns.filter({ Self.matches(imported, $0) }).count > 1 {
                submitError = String(localized: "Há mais de uma corrida equivalente no Apple Health. Escolha o registro na lista Apple Health ou desative Salvar também no Apple Health.")
                return
            }
            selection = .imported(imported, saveToHealthKit: saveImportedToHealthKit)
        }
        if isEnrichment || (previewHasHeartRate && !includeFeedback) {
            Task { await finishCompletion() }
        } else {
            feedbackOrigin = .preview
            step = .feedback
        }
    }

    private var supportedImportTypes: [UTType] {
        ["fit", "tcx", "gpx"].compactMap { UTType(filenameExtension: $0) }
    }

    private func handleFileImport(_ result: Result<[URL], Error>) {
        importError = nil
        guard case .success(let urls) = result, let url = urls.first else {
            if case .failure(let error) = result { importError = error.localizedDescription }
            return
        }
        isImportingFile = true
        Task {
            defer { isImportingFile = false }
            do {
                let activities = try await Task.detached(priority: .userInitiated) {
                    try WorkoutImportService().importActivities(from: url)
                }.value
                importedCandidates = activities
                saveImportedToHealthKit = true
                if activities.count == 1 { openImportedPreview(activities[0]) }
            } catch {
                importError = error.localizedDescription
                importedCandidates = []
                selectedImportedWorkout = nil
            }
        }
    }

    private func selectImportedForCompletion() {
        confirmPreview(includeFeedback: includeFeedbackAfterDateConfirmation)
    }

    private func requestPreviewConfirmation(includeFeedback: Bool = false) {
        includeFeedbackAfterDateConfirmation = includeFeedback
        if let imported = selectedImportedWorkout, isOutsideWorkoutWindow(imported.startDate) {
            showOutsideDateConfirmation = true
        } else { confirmPreview(includeFeedback: includeFeedback) }
    }

    private func isOutsideWorkoutWindow(_ date: Date) -> Bool {
        let start = calendar.startOfDay(for: workout.parsedDate)
        guard let end = calendar.date(byAdding: .day, value: 3, to: start) else { return true }
        return date < start || date >= end
    }

    // MARK: - Load HealthKit

    /// Janela: dia do treino + 2 dias depois (D, D+1, D+2). Esconde corridas já linkadas a outros treinos.
    private func loadCandidateRuns() async {
        isLoading = true
        defer { isLoading = false }

        let service: any HealthKitRunningWorkoutsProviding = {
            #if targetEnvironment(simulator)
            return MockHealthKitService()
            #else
            return HealthKitService()
            #endif
        }()

        guard service.isHealthDataAvailable else {
            loadError = String(localized: "Apple Health não disponível neste dispositivo.")
            return
        }

        do {
            try await service.requestReadAuthorization()

            let windowStart = calendar.startOfDay(for: workout.parsedDate)
            guard let windowEnd = calendar.date(byAdding: .day, value: 3, to: windowStart) else {
                todayRuns = []
                return
            }

            let df = ISO8601DateFormatter()
            Self.diagLogger.debug("[ConcluirTreino] workoutId=\(workout.id) title=\(workout.title) parsedDate=\(df.string(from: workout.parsedDate)) windowStart=\(df.string(from: windowStart)) windowEnd=\(df.string(from: windowEnd))")

            let allRuns: [HealthKitRunItem]
            #if targetEnvironment(simulator)
            allRuns = try await service.fetchLatestRunningWorkouts(limit: 30)
            #else
            allRuns = try await HealthKitService().runningWorkouts(start: windowStart, end: windowEnd)
            #endif
            Self.diagLogger.debug("[ConcluirTreino] fetchLatestRunningWorkouts(limit:30) retornou \(allRuns.count) corrida(s)")
            for r in allRuns {
                Self.diagLogger.debug("  [fetch] id=\(r.id) start=\(df.string(from: r.startDate)) distM=\(String(format: "%.0f", r.distanceMeters))")
            }

            let inWindow = allRuns.filter { $0.startDate >= windowStart && $0.startDate < windowEnd }
            windowHealthRuns = inWindow
            Self.diagLogger.debug("[ConcluirTreino] após filtro de janela: \(inWindow.count) corrida(s)")
            for r in inWindow {
                Self.diagLogger.debug("  [inWindow] id=\(r.id) start=\(df.string(from: r.startDate))")
            }

            let orphanIds = Set(RunWorkoutLinkStore.shared.completionCandidates(healthKitUUIDs: inWindow.map { $0.id }, workoutId: workout.id))
            let linkedOut = inWindow.filter { !orphanIds.contains($0.id) }
            if !linkedOut.isEmpty {
                for r in linkedOut {
                    let linkedTo = RunWorkoutLinkStore.shared.athlyWorkoutId(for: r.id) ?? "?"
                    Self.diagLogger.debug("  [filtrado-por-link] id=\(r.id) já linkada ao athlyWorkoutId=\(linkedTo)")
                }
            }

            todayRuns = inWindow
                .filter { orphanIds.contains($0.id) }
                .sorted { $0.startDate < $1.startDate }
            Self.diagLogger.debug("[ConcluirTreino] todayRuns final: \(todayRuns.count) corrida(s)")

            for run in todayRuns {
                try Task.checkCancellation()
                healthRoutes[run.id] = await HealthKitService().routeAvailability(workoutUUID: run.id)
            }
            await service.diagnose(windowStart: windowStart, windowEnd: windowEnd, contextLabel: "ConcluirTreino:\(workout.id)")
        } catch {
            loadError = error.localizedDescription
            Self.diagLogger.debug("[ConcluirTreino] ERRO: \(error.localizedDescription)")
        }
    }

    private func matchingZepp(_ run: HealthKitRunItem) -> ImportedWorkout? {
        let matches = zeppRuns.filter { Self.matches($0, run) }
        return matches.count == 1 ? matches.first : nil
    }
    private static func matches(_ imported: ImportedWorkout, _ run: HealthKitRunItem) -> Bool {
        ImportedWorkoutMatch.evaluate(imported: imported, healthStartDate: run.startDate, healthDurationSeconds: run.durationSeconds, healthDistanceMeters: run.distanceMeters).isMatch
    }
    private var visibleHealthRuns: [HealthKitRunItem] {
        todayRuns.filter { run in
            guard let imported = matchingZepp(run), todayRuns.filter({ Self.matches(imported, $0) }).count == 1 else { return true }
            return CompletionSourcePreference.prefersZepp(healthHasRoute: healthRoutes[run.id], zeppHasRoute: imported.hasRoute) != true
        }
    }
    private var visibleZeppRuns: [ImportedWorkout] {
        zeppRuns.filter { imported in
            if windowHealthRuns.contains(where: { run in
                guard Self.matches(imported, run), let linked = RunWorkoutLinkStore.shared.athlyWorkoutId(for: run.id) else { return false }
                return linked != workout.id
            }) { return false }
            let matches = todayRuns.filter { Self.matches(imported, $0) }
            guard matches.count == 1, let run = matches.first, matchingZepp(run) != nil else { return true }
            guard let route = healthRoutes[run.id] else { return true }
            return !route && imported.hasRoute
        }
    }
    private func selectZepp(_ imported: ImportedWorkout) {
        var imported = imported
        let matches = todayRuns.filter { Self.matches(imported, $0) }
        imported.preferredHealthKitUUID = matches.count == 1 ? matches.first?.id : nil
        openImportedPreview(imported)
        if matches.count == 1 {
            previewHealthRun = matches.first
            isLoadingPreview = true
        }
    }
    @MainActor private func loadZeppCandidates() async {
        guard FeatureFlags.zeppSync else { return }
        zeppLoading = true
        defer { zeppLoading = false }
        let start = calendar.startOfDay(for: workout.parsedDate)
        guard let end = calendar.date(byAdding: .day, value: 3, to: start) else { return }
        let session = await APIClient.shared.heartRateSessionIdentifier
        do {
            let status = try await APIClient.shared.zeppStatus()
            try Task.checkCancellation()
            guard session == (await APIClient.shared.heartRateSessionIdentifier) else { return }
            zeppConnected = status.connected
            guard status.connected && status.enabled else { return }
            zeppError = nil
            await readZeppCandidates(start: start, end: end, session: session)
            try Task.checkCancellation()
            guard start < Date(), session == (await APIClient.shared.heartRateSessionIdentifier) else { return }
            try await APIClient.shared.requestZeppHistory(start: start, end: min(end.addingTimeInterval(-1), Date()))
            try Task.checkCancellation()
            guard session == (await APIClient.shared.heartRateSessionIdentifier) else { return }
            // The receipt is not a completed import. Show progress while polling; keep available runs visible.
            for _ in 0..<12 {
                try await Task.sleep(nanoseconds: 5_000_000_000)
                try Task.checkCancellation()
                guard session == (await APIClient.shared.heartRateSessionIdentifier) else { return }
                await readZeppCandidates(start: start, end: end, session: session)
            }
        } catch is CancellationError { }
        catch { if !Task.isCancelled, session == (await APIClient.shared.heartRateSessionIdentifier) { zeppError = error.localizedDescription } }
    }
    @MainActor private func readZeppCandidates(start: Date, end: Date, session: UUID) async {
        do {
            let candidates = try await APIClient.shared.zeppCandidates(workoutId: workout.id, start: start, end: end)
            var loaded: [ImportedWorkout] = []
            for candidate in candidates {
                try Task.checkCancellation()
                if let cached = zeppRuns.first(where: { $0.zeppActivityId == candidate.id }) { loaded.append(cached) }
                else {
                    do { loaded.append(try await APIClient.shared.importZeppActivity(id: candidate.id)) }
                    catch { if !Task.isCancelled { zeppError = String(localized: "Uma atividade Zepp não pôde ser carregada. Tente atualizar novamente.") } }
                }
            }
            guard !Task.isCancelled, session == (await APIClient.shared.heartRateSessionIdentifier) else { return }
            zeppRuns = loaded
        } catch { if !Task.isCancelled, session == (await APIClient.shared.heartRateSessionIdentifier) { zeppError = error.localizedDescription } }
    }

    // MARK: - Helpers

    private var isEnrichment: Bool {
        workout.status == .done || workout.status == .partial
    }

    private var navigationTitle: String {
        if step == .completed { return String(localized: "Treino concluído") }
        if step == .feedback { return String(localized: "Como foi o treino?") }
        if step == .preview { return String(localized: "Prévia da corrida") }
        return isEnrichment ? String(localized: "Adicionar dados") : String(localized: "Concluir Treino")
    }

    private var effortEmoji: String {
        switch effort {
        case ...3: return "😌"
        case 4...6: return "💪"
        case 7...8: return "🔥"
        default: return "😤"
        }
    }

    private var fatigueEmoji: String {
        switch fatigue {
        case ...3: return "⚡"
        case 4...6: return "😅"
        case 7...8: return "😰"
        default: return "😵"
        }
    }

    private func timeString(_ date: Date) -> String {
        let df = DateFormatter()
        df.dateFormat = "HH:mm"
        return df.string(from: date)
    }

    private func formatDuration(_ seconds: Double) -> String {
        let total = Int(seconds)
        if total >= 3_600 {
            return String(format: "%d:%02d:%02d", total / 3_600, (total % 3_600) / 60, total % 60)
        }
        return String(format: "%02d:%02d", total / 60, total % 60)
    }

    private func formatPace(_ seconds: Double) -> String {
        guard seconds > 0, seconds.isFinite else { return "--:--" }
        return String(format: "%d:%02d", Int(seconds) / 60, Int(seconds) % 60)
    }

    /// Mostra "+1 dia" / "+2 dias" quando a corrida não é do mesmo dia do treino prescrito.
    /// Retorna nil quando é o próprio dia (caso comum, evita poluir o card).
    private func relativeDayLabel(for runStart: Date) -> String? {
        let workoutDay = calendar.startOfDay(for: workout.parsedDate)
        let runDay = calendar.startOfDay(for: runStart)
        let days = calendar.dateComponents([.day], from: workoutDay, to: runDay).day ?? 0
        switch days {
        case 1, 2: return String(localized: "+\(days) dia")
        default: return nil
        }
    }
}
