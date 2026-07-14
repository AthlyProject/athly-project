package com.athly.runner.core.notifications

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Posta a notificação do lembrete — "Treino de hoje" + título do workout (espelha o iOS). */
class ReminderReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val workoutId = intent.getStringExtra(EXTRA_WORKOUT_ID) ?: return
        val title = intent.getStringExtra(EXTRA_TITLE) ?: return

        WorkoutReminderScheduler.createChannel(context)

        val contentIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
            PendingIntent.getActivity(
                context,
                0,
                it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }

        val notification = NotificationCompat.Builder(context, WorkoutReminderScheduler.CHANNEL_ID)
            .setContentTitle("Treino de hoje")
            .setContentText(title)
            .setSmallIcon(com.athly.runner.R.drawable.ic_launcher_foreground)
            .setAutoCancel(true)
            .setContentIntent(contentIntent)
            .build()

        context.getSystemService(NotificationManager::class.java)
            .notify("workout-$workoutId".hashCode(), notification)
    }

    companion object {
        const val EXTRA_WORKOUT_ID = "workout_id"
        const val EXTRA_TITLE = "title"
    }
}

/** Rearma os lembretes após reboot (alarms não sobrevivem ao restart). */
@AndroidEntryPoint
class ReminderBootReceiver : BroadcastReceiver() {

    @Inject lateinit var scheduler: WorkoutReminderScheduler

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val pending = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.Default).launch {
            try {
                scheduler.rearmAfterBoot()
            } finally {
                pending.finish()
            }
        }
    }
}
