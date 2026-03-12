import Foundation
import SwiftUI

@MainActor
final class TrainingPlanViewModel: ObservableObject {
    @Published var trainingPlanResponse: TrainingPlanResponse?
    @Published var weeks: [Week] = []
    @Published var todayWorkout: WorkoutModel?
    @Published var allWorkouts: [WorkoutModel] = []
    @Published var weeklyGoals: [WeeklyGoalResponse] = []
    @Published var selectedWeekIndex: Int = 0
    @Published var isLoading: Bool = false
    @Published var isGenerating: Bool = false
    @Published var errorMessage: String?

    // MARK: - Computed Properties

    var currentWeekWorkouts: [WorkoutModel] {
        guard selectedWeekIndex < weeks.count else { return [] }
        return weeks[selectedWeekIndex].workouts
    }

    var completedThisWeek: Int {
        currentWeekWorkouts.filter { $0.status == .done }.count
    }

    var totalThisWeek: Int {
        currentWeekWorkouts.count
    }

    var weeklyProgress: Double {
        guard totalThisWeek > 0 else { return 0 }
        return Double(completedThisWeek) / Double(totalThisWeek)
    }

    var nextWorkout: WorkoutModel? {
        currentWeekWorkouts.first { $0.status == .scheduled }
    }

    // MARK: - Load Data

    func loadData() async {
        isLoading = true
        errorMessage = nil

        do {
            let plan = try await APIClient.shared.getMyTrainingPlan()
            trainingPlanResponse = plan

            async let goalsTask = APIClient.shared.getWeeklyGoals(trainingPlanId: plan.id)
            async let workoutsTask = APIClient.shared.getWorkoutsByTrainingPlan(trainingPlanId: plan.id)
            async let todayTask = APIClient.shared.getTodayWorkout()

            let (goals, workouts, today) = try await (goalsTask, workoutsTask, todayTask)

            weeklyGoals = goals.sorted { $0.parsedStartDate < $1.parsedStartDate }
            allWorkouts = workouts
            todayWorkout = today

            weeks = buildWeeks(goals: weeklyGoals, workouts: allWorkouts)

            // Select current week by default
            selectedWeekIndex = currentWeekIndex()
        } catch APIError.notFound {
            // User has no training plan yet
            trainingPlanResponse = nil
            weeks = []
            allWorkouts = []
            weeklyGoals = []
            todayWorkout = nil
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Generate Next Week

    func generateNextWeek() async {
        isGenerating = true
        errorMessage = nil

        do {
            let request = PlanNextWeekRequest(numberOfRuns: nil, weekStartDate: nil)
            _ = try await APIClient.shared.planNextWeek(request)
            await loadData()
        } catch {
            errorMessage = error.localizedDescription
        }

        isGenerating = false
    }

    // MARK: - Complete / Skip

    func completeWorkout(_ workout: WorkoutModel) async {
        do {
            let updated = try await APIClient.shared.completeWorkout(workoutId: workout.id)
            replaceWorkout(updated)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func skipWorkout(_ workout: WorkoutModel) async {
        do {
            let updated = try await APIClient.shared.skipWorkout(workoutId: workout.id)
            replaceWorkout(updated)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Private Helpers

    private func buildWeeks(goals: [WeeklyGoalResponse], workouts: [WorkoutModel]) -> [Week] {
        goals.enumerated().map { index, goal in
            let weekWorkouts = workouts
                .filter { $0.weeklyGoalId == goal.id }
                .sorted { $0.parsedDate < $1.parsedDate }
            return Week(id: goal.id, number: index + 1, weeklyGoal: goal, workouts: weekWorkouts)
        }
    }

    private func currentWeekIndex() -> Int {
        let today = Date()
        for (index, week) in weeks.enumerated() {
            guard let goal = week.weeklyGoal else { continue }
            if today >= goal.parsedStartDate && today <= goal.parsedEndDate {
                return index
            }
        }
        // Default to last week
        return max(0, weeks.count - 1)
    }

    private func replaceWorkout(_ updated: WorkoutModel) {
        allWorkouts = allWorkouts.map { $0.id == updated.id ? updated : $0 }
        if todayWorkout?.id == updated.id {
            todayWorkout = updated
        }
        weeks = buildWeeks(goals: weeklyGoals, workouts: allWorkouts)
    }
}
