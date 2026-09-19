import Foundation
import SwiftUI

/// Estado do fluxo "nova atividade detectada": revelação da corrida lida do Apple Health,
/// escolha entre corrida livre e vínculo com um treino planejado, e confirmação
/// planejado × realizado.
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

    let run: HealthKitRunItem

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
        self.selectedDay = Calendar.current.startOfDay(for: run.startDate)
    }

    // MARK: - Carregamento

    func loadDetail() async {
        isLoadingDetail = true
        defer { isLoadingDetail = false }
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

        runStore.upsert(healthRun: run, detail: routeDetail)
        DetectedRunAckStore.shared.acknowledge(healthKitUUID: run.id)
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

        let outcome = await planVM.completeWorkoutSelection(
            workout,
            selection: .healthKit(run),
            runStore: runStore
        )

        switch outcome {
        case .success:
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
        DetectedRunAckStore.shared.acknowledge(healthKitUUID: run.id)
    }
}
