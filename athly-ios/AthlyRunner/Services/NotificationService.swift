import Foundation
import UserNotifications
import UIKit

/// Lembretes locais de treino (sem backend). Agenda uma notificação na manhã de cada treino
/// agendado futuro, com base no plano. Reagendado sempre que o plano muda.
@MainActor
final class NotificationService {
    static let shared = NotificationService()
    private init() {}

    private let enabledKey = "athly_workout_reminders_enabled"
    /// Horário do lembrete no dia do treino.
    private let reminderHour = 7
    /// Limite de notificações pendentes (iOS permite no máx. 64; ficamos bem abaixo).
    private let maxScheduled = 12
    private var remoteDeviceToken: String?

    /// Default: ligado (a permissão do sistema ainda gate o agendamento de fato).
    var isEnabled: Bool {
        get { UserDefaults.standard.object(forKey: enabledKey) as? Bool ?? true }
        set { UserDefaults.standard.set(newValue, forKey: enabledKey) }
    }

    @discardableResult
    func requestAuthorization() async -> Bool {
        let granted = (try? await UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        if granted {
            UIApplication.shared.registerForRemoteNotifications()
        }
        return granted
    }

    /// Pede permissão apenas se ainda não foi decidida (bom para o onboarding após gerar o 1º plano).
    func requestAuthorizationIfNeeded() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        if settings.authorizationStatus == .notDetermined {
            _ = await requestAuthorization()
        } else if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    /// A Apple recomenda registrar a cada lançamento; o token não é persistido em disco.
    func registerForRemoteNotificationsIfAuthorized() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    func receiveRemoteDeviceToken(_ data: Data) async {
        remoteDeviceToken = data.map { String(format: "%02x", $0) }.joined()
        await syncRemoteDeviceTokenIfAvailable()
    }

    func syncRemoteDeviceTokenIfAvailable() async {
        guard let remoteDeviceToken,
              await APIClient.shared.isAuthenticated else { return }
        #if DEBUG
        let environment = "sandbox"
        #else
        let environment = "production"
        #endif
        try? await APIClient.shared.registerPushDevice(
            token: remoteDeviceToken,
            environment: environment
        )
    }

    /// Liga/desliga os lembretes. Ao ligar, pede permissão e agenda; ao desligar, cancela tudo.
    func setEnabled(_ enabled: Bool, workouts: [WorkoutModel]) async {
        isEnabled = enabled
        if enabled {
            if await requestAuthorization() {
                await reschedule(workouts: workouts)
            }
        } else {
            cancelAll()
        }
    }

    /// Cancela os lembretes e reagenda para os próximos treinos agendados (futuros).
    func reschedule(workouts: [WorkoutModel]) async {
        let center = UNUserNotificationCenter.current()
        cancelAll()
        guard isEnabled else { return }

        let status = await center.notificationSettings().authorizationStatus
        guard status == .authorized || status == .provisional else { return }

        let now = Date()
        let calendar = Calendar.current

        var pending: [(workout: WorkoutModel, date: Date)] = []
        for workout in workouts {
            guard workout.status == .scheduled, workout.sportType != .other else { continue }
            guard let fireDate = reminderDate(for: workout, calendar: calendar), fireDate > now else { continue }
            pending.append((workout: workout, date: fireDate))
        }
        pending.sort { $0.date < $1.date }
        let upcoming = pending.prefix(maxScheduled)

        for (workout, fireDate) in upcoming {
            let content = UNMutableNotificationContent()
            content.title = "Treino de hoje"
            content.body = workout.title
            content.sound = .default

            let comps = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: fireDate)
            let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
            let request = UNNotificationRequest(
                identifier: "workout-\(workout.id)",
                content: content,
                trigger: trigger
            )
            try? await center.add(request)
        }
    }

    func cancelAll() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    }

    private func reminderDate(for workout: WorkoutModel, calendar: Calendar) -> Date? {
        var comps = calendar.dateComponents([.year, .month, .day], from: workout.parsedDate)
        comps.hour = reminderHour
        comps.minute = 0
        return calendar.date(from: comps)
    }
}
