import Foundation
import SwiftUI

/// Estado do fluxo "nova atividade detectada": revelação da corrida (lida do Apple Health ou
/// enviada pelo campo de dados do Garmin), escolha entre corrida livre e vínculo com um treino
/// planejado, e confirmação planejado × realizado.
@MainActor
final class DetectedRunViewModel: ObservableObject {
    enum Step {
        case reveal
        case linked
    }

    /// Resposta à pergunta "este treino estava no seu plano?".
    enum Choice {
        case freeRun
        case linkToWorkout
    }

    /// Resumo exibido. Numa corrida do Garmin é derivado do `ImportedWorkout`.
    let run: HealthKitRunItem
    /// Presente quando a corrida veio do campo de dados do Garmin.
    let garmin: GarminDetectedRun?

    @Published var step: Step = .reveal
    @Published var choice: Choice = .freeRun
    @Published var routeDetail: RunRouteDetail?
    @Published var isLoadingDetail = true
    @Published var isSubmitting = false
    @Published var errorMessage: String?

    /// Folha de calendário para escolher o treino planejado.
    @Published var isShowingLinkSheet = false
    @Published var selectedDay: Date
    @Published var selectedWorkout: WorkoutModel?

    /// Treino efetivamente vinculado — alimenta a tela de comparação.
    @Published private(set) var linkedWorkout: WorkoutModel?

    init(run: HealthKitRunItem) {
        self.run = run
        self.garmin = nil
        self.selectedDay = Calendar.current.startOfDay(for: run.startDate)
    }

    init(candidate: DetectedRunCandidate) {
        self.run = candidate.summary
        if case .garmin(let garmin) = candidate {
            self.garmin = garmin
        } else {
            self.garmin = nil
        }
        self.selectedDay = Calendar.current.startOfDay(for: candidate.summary.startDate)
    }

    // MARK: - Carregamento

    func loadDetail() async {
        isLoadingDetail = true
        defer { isLoadingDetail = false }
        if let garmin {
            routeDetail = garmin.imported.routeDetail
            return
        }
        #if targetEnvironment(simulator)
        routeDetail = nil
        #else
        routeDetail = await HealthKitService().fetchRunDetail(workoutUUID: run.id)
        #endif
    }

    /// Frequência cardíaca média, quando o Health tiver amostras para esta corrida.
    var averageHeartRate: Int? {
        guard let avg = routeDetail?.avgHR, avg > 0 else { return nil }
        return Int(avg.rounded())
    }

    /// Corrida feita com um treino no app Athly do relógio: já escolhe esse treino para vincular.
    /// Só antes de o atleta mexer na escolha, e só se o treino ainda estiver pendente.
    func preselectPlannedWorkout(from workouts: [WorkoutModel]) {
        guard selectedWorkout == nil,
              let plannedId = garmin?.plannedWorkoutId,
              let workout = workouts.first(where: { $0.id == plannedId && $0.status == .scheduled })
        else { return }
        selectedWorkout = workout
        selectedDay = Calendar.current.startOfDay(for: workout.parsedDate)
        choice = .linkToWorkout
    }

    // MARK: - Candidatos a vínculo

    /// Treinos de corrida ainda pendentes, agrupados por dia — origem das opções do calendário.
    func candidateWorkouts(from workouts: [WorkoutModel], on day: Date) -> [WorkoutModel] {
        let calendar = Calendar.current
        return workouts
            .filter { $0.sportType == .running && $0.status == .scheduled }
            .filter { calendar.isDate($0.parsedDate, inSameDayAs: day) }
            .sorted { $0.title < $1.title }
    }

    /// Dias da semana visível que têm ao menos um treino planejado (ponto colorido na faixa).
    func daysWithWorkouts(from workouts: [WorkoutModel], in week: [Date]) -> Set<Date> {
        let calendar = Calendar.current
        var result: Set<Date> = []
        for day in week where !candidateWorkouts(from: workouts, on: day).isEmpty {
            result.insert(calendar.startOfDay(for: day))
        }
        return result
    }

    // MARK: - Ações

    /// "Corri por conta própria": grava a corrida como sessão local do Athly e marca a
    /// atividade como resolvida para não perguntar de novo.
    func saveAsFreeRun(runStore: RunStore) async -> Bool {
        guard !isSubmitting else { return false }
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        await runStore.loadIfNeeded()
        if let garmin {
            runStore.upsert(imported: garmin.imported, athlyWorkoutId: nil)
        } else {
            runStore.upsert(healthRun: run, detail: routeDetail)
        }
        do { try await runStore.flush() } catch {
            errorMessage = error.localizedDescription
            return false
        }
        acknowledge(resolution: .freeRun)
        return true
    }

    /// "Vincular a um treino": delega para o caminho de conclusão já existente, que vincula no
    /// `RunWorkoutLinkStore`, monta os detalhes de execução e conclui o treino no servidor.
    func link(
        to workout: WorkoutModel,
        planVM: TrainingPlanViewModel,
        runStore: RunStore
    ) async -> Bool {
        guard !isSubmitting else { return false }
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        let outcome = await complete(workout, planVM: planVM, runStore: runStore)

        switch outcome {
        case .success:
            // Corrida do Health vinculada já sai da detecção pelo `RunWorkoutLinkStore` (e volta se o
            // treino for desvinculado); a do Garmin precisa ser encerrada no backend.
            if garmin != nil { acknowledge(resolution: .linked, workoutId: workout.id) }
            linkedWorkout = planVM.allWorkouts.first { $0.id == workout.id } ?? workout
            isShowingLinkSheet = false
            step = .linked
            return true
        case .failure(let message), .healthKitFallbackRequired(let message):
            errorMessage = message
            return false
        }
    }

    /// "Ignorar esta atividade": não perguntar mais sobre esta corrida.
    func ignore() {
        acknowledge(resolution: .dismissed)
    }

    /// Corrida do Garmin segue o caminho de um FIT importado: reconstrói os segmentos, salva no
    /// Apple Health e anexa a rota ao registro que o Garmin Connect tenha criado. Se esse registro
    /// sumiu do Health, conclui só com os dados no Athly em vez de perguntar no meio do pop-up.
    private func complete(
        _ workout: WorkoutModel,
        planVM: TrainingPlanViewModel,
        runStore: RunStore
    ) async -> WorkoutCompletionOutcome {
        guard let garmin else {
            return await planVM.completeWorkoutSelection(workout, selection: .healthKit(run), runStore: runStore)
        }
        let selection = WorkoutCompletionSelection.imported(garmin.imported, saveToHealthKit: true)
        let outcome = await planVM.completeWorkoutSelection(workout, selection: selection, runStore: runStore)
        guard case .healthKitFallbackRequired = outcome else { return outcome }
        return await planVM.completeWorkoutSelection(
            workout,
            selection: selection,
            fallback: .localOnly,
            runStore: runStore
        )
    }

    /// Marca a corrida como resolvida para não perguntar de novo. Numa corrida do Garmin também
    /// avisa o backend e dispensa a cópia do Apple Health.
    private func acknowledge(resolution: GarminActivityResolution, workoutId: String? = nil) {
        guard let garmin else {
            DetectedRunAckStore.shared.acknowledge(healthKitUUID: run.id)
            return
        }
        DetectedRunAckStore.shared.acknowledge(healthKitUUID: garmin.ackKey)
        for uuid in garmin.matchingHealthKitUUIDs {
            DetectedRunAckStore.shared.acknowledge(healthKitUUID: uuid)
        }
        let activityId = garmin.activityId
        Task {
            try? await APIClient.shared.resolveGarminActivity(id: activityId, resolution: resolution, workoutId: workoutId)
        }
    }
}
