package com.athly.runner.core.location

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.athly.runner.R
import com.athly.runner.core.common.Formatters
import com.athly.runner.domain.run.RunMetrics
import com.athly.runner.domain.run.RunTracker
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Foreground Service de tracking — equivalente ao `allowsBackgroundLocationUpdates` + Live Activity do
 * iOS. Mantém o [LocationDataSource] ativo para a corrida **sobreviver a screen lock/background** e
 * espelha a lock screen da Live Activity na notificação ongoing (prompt 11): título do treino (ou
 * "Corrida"), TEMPO · DISTÂNCIA · PACE atualizados ~1Hz a partir do [RunTracker] — `LiveActivityManager.
 * startActivity/updateActivity/endActivity` viram startForeground/notify/stopForeground. Dynamic Island
 * não tem equivalente Android (FUTURO: Ongoing Activity API / Wear OS).
 */
@AndroidEntryPoint
class RunLocationService : Service() {

    @Inject lateinit var locationDataSource: LocationDataSource
    @Inject lateinit var locationRepository: LocationRepository
    @Inject lateinit var runTracker: RunTracker

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var collectJob: Job? = null
    private var notifyJob: Job? = null
    private var workoutTitle: String? = null

    override fun onCreate() {
        super.onCreate()
        createChannel()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        workoutTitle = intent?.getStringExtra(EXTRA_WORKOUT_TITLE)?.takeIf { it.isNotBlank() }
        ServiceCompat.startForeground(
            this,
            NOTIF_ID,
            buildNotification(content = "Rastreando sua corrida"),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
        )
        if (collectJob == null) {
            collectJob = serviceScope.launch {
                locationDataSource.locationFlow().collect { locationRepository.publish(it) }
            }
        }
        if (notifyJob == null) {
            notifyJob = serviceScope.launch { observeMetrics() }
        }
        return START_STICKY
    }

    /**
     * Atualização ~1Hz espelhando `updateActivity` do iOS: o tracker publica 1×/s (tick); o
     * `distinctUntilChanged` no texto formatado garante `notify()` só quando algo visível muda.
     */
    private suspend fun observeMetrics() {
        runTracker.metrics
            .map { liveLine(it) }
            .distinctUntilChanged()
            .collect { line ->
                val manager = getSystemService(NotificationManager::class.java)
                manager.notify(NOTIF_ID, buildNotification(content = line))
            }
    }

    /** "TEMPO · DISTÂNCIA km · PACE /km" — formatters idênticos à Live Activity/UI in-app. */
    private fun liveLine(metrics: RunMetrics): String {
        val time = Formatters.duration(metrics.elapsedSeconds)
        val distance = Formatters.distanceKm(metrics.distanceMeters)
        val pace = Formatters.paceNoSuffix(metrics.currentPaceSecPerKm)
        return "$time · $distance · $pace /km"
    }

    override fun onDestroy() {
        serviceScope.cancel()
        collectJob = null
        notifyJob = null
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    private fun createChannel() {
        val manager = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(CHANNEL_ID, "Corrida em andamento", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Rastreamento de corrida em andamento"
            setShowBadge(false)
        }
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(content: String): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(workoutTitle ?: "Corrida")
            .setContentText(content)
            .setSubText("AO VIVO")
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setColor(NEON_ACCENT)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .setContentIntent(mainActivityIntent())
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .build()

    private fun mainActivityIntent(): PendingIntent {
        val launch = packageManager.getLaunchIntentForPackage(packageName)
            ?.apply { addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP) }
        return PendingIntent.getActivity(
            this,
            0,
            launch,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    companion object {
        private const val NOTIF_ID = 1001
        private const val CHANNEL_ID = "run_tracking"
        private const val EXTRA_WORKOUT_TITLE = "workout_title"

        /** Roxo neon `#bf40ff` da Live Activity iOS. */
        private val NEON_ACCENT = Color.parseColor("#BF40FF")

        fun start(context: Context, workoutTitle: String? = null) {
            ContextCompat.startForegroundService(
                context,
                Intent(context, RunLocationService::class.java)
                    .putExtra(EXTRA_WORKOUT_TITLE, workoutTitle),
            )
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, RunLocationService::class.java))
        }
    }
}
