package com.athly.runner.core.notifications

import android.Manifest
import android.app.AlarmManager
import android.app.PendingIntent
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.athly.runner.core.network.AthlyJson
import com.athly.runner.data.mapper.parsedLocalDate
import com.athly.runner.data.remote.dto.SportType
import com.athly.runner.data.remote.dto.WorkoutDto
import com.athly.runner.data.remote.dto.WorkoutStatus
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import java.time.Instant
import java.time.ZoneId
import javax.inject.Inject
import javax.inject.Singleton

private val Context.reminderDataStore by preferencesDataStore(name = "workout_reminders")

/**
 * Lembretes locais de treino — porta do `NotificationService.swift`: notificação às 07:00 local de
 * cada dia de treino agendado futuro (status SCHEDULED, sem `other`), máx. 12 pendentes, flag
 * persistida (default ligado). AlarmManager exato (`setExactAndAllowWhileIdle`) com fallback
 * inexato quando o usuário revoga exact alarms; a lista agendada é persistida para o
 * [ReminderBootReceiver] rearmar após reboot.
 */
@Singleton
class WorkoutReminderScheduler @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val json = AthlyJson.create()
    private val enabledKey = booleanPreferencesKey("athly_workout_reminders_enabled")
    private val scheduledKey = stringPreferencesKey("scheduled_reminders_json")
    private val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    @Serializable
    data class ScheduledReminder(val workoutId: String, val fireAtMillis: Long, val title: String)

    init {
        createChannel(context)
    }

    /** Flag persistida — default `true` como o iOS. */
    val isEnabled: Flow<Boolean> = context.reminderDataStore.data.map { it[enabledKey] ?: true }

    suspend fun setEnabled(enabled: Boolean, workouts: List<WorkoutDto>) {
        context.reminderDataStore.edit { it[enabledKey] = enabled }
        if (enabled) reschedule(workouts) else cancelAll()
    }

    /** Cancela tudo e reagenda (idempotente) — espelha `reschedule` do iOS. */
    suspend fun reschedule(workouts: List<WorkoutDto>) {
        cancelAll()
        if (!isEnabled.first()) return
        if (!hasNotificationPermission()) return

        val zone = ZoneId.systemDefault()
        val now = Instant.now()
        val reminders = workouts
            .filter { it.status == WorkoutStatus.SCHEDULED && it.sportType != SportType.OTHER }
            .map { workout ->
                val fireAt = workout.parsedLocalDate.atTime(REMINDER_HOUR, 0).atZone(zone).toInstant()
                ScheduledReminder(workout.id, fireAt.toEpochMilli(), workout.title)
            }
            .filter { Instant.ofEpochMilli(it.fireAtMillis) > now }
            .sortedBy { it.fireAtMillis }
            .take(MAX_SCHEDULED)

        reminders.forEach { schedule(it) }
        persistScheduled(reminders)
    }

    suspend fun cancelAll() {
        loadScheduled().forEach { reminder ->
            pendingIntent(reminder)?.let(alarmManager::cancel)
        }
        persistScheduled(emptyList())
    }

    /** Rearma os alarms persistidos ainda futuros (chamado no BOOT_COMPLETED — alarms não persistem). */
    suspend fun rearmAfterBoot() {
        if (!isEnabled.first() || !hasNotificationPermission()) return
        val now = Instant.now()
        val future = loadScheduled().filter { Instant.ofEpochMilli(it.fireAtMillis) > now }
        future.forEach { schedule(it) }
        persistScheduled(future)
    }

    private fun schedule(reminder: ScheduledReminder) {
        val intent = pendingIntent(reminder) ?: return
        val canExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()
        if (canExact) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, reminder.fireAtMillis, intent)
        } else {
            // Exact alarm revogado pelo usuário → inexato (pode atrasar alguns minutos).
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, reminder.fireAtMillis, intent)
        }
    }

    private fun pendingIntent(reminder: ScheduledReminder): PendingIntent? =
        PendingIntent.getBroadcast(
            context,
            "workout-${reminder.workoutId}".hashCode(),
            Intent(context, ReminderReceiver::class.java)
                .putExtra(ReminderReceiver.EXTRA_WORKOUT_ID, reminder.workoutId)
                .putExtra(ReminderReceiver.EXTRA_TITLE, reminder.title),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    fun hasNotificationPermission(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED

    private suspend fun loadScheduled(): List<ScheduledReminder> {
        val raw = context.reminderDataStore.data.first()[scheduledKey] ?: return emptyList()
        return runCatching {
            json.decodeFromString(ListSerializer(ScheduledReminder.serializer()), raw)
        }.getOrDefault(emptyList())
    }

    private suspend fun persistScheduled(reminders: List<ScheduledReminder>) {
        context.reminderDataStore.edit {
            it[scheduledKey] = json.encodeToString(ListSerializer(ScheduledReminder.serializer()), reminders)
        }
    }

    companion object {
        const val REMINDER_HOUR = 7
        const val MAX_SCHEDULED = 12
        const val CHANNEL_ID = "workout_reminders"

        fun createChannel(context: Context) {
            val manager = context.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Lembretes de treino", NotificationManager.IMPORTANCE_DEFAULT),
            )
        }
    }
}
