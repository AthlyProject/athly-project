package com.athly.runner.core.location

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat

/** Checagens de permissão (sem UI) — espelham `hasPermission` / WhenInUse-vs-Always do iOS. */
object LocationPermissions {

    fun hasForegroundLocation(context: Context): Boolean =
        context.isGranted(Manifest.permission.ACCESS_FINE_LOCATION) ||
            context.isGranted(Manifest.permission.ACCESS_COARSE_LOCATION)

    /** Só existe em API 29+ (antes, o fine já cobre o background). */
    fun hasBackgroundLocation(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
            context.isGranted(Manifest.permission.ACCESS_BACKGROUND_LOCATION)

    /** Só é pedida em API 33+; antes, notificações não exigem runtime grant. */
    fun hasNotificationPermission(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            context.isGranted(Manifest.permission.POST_NOTIFICATIONS)

    private fun Context.isGranted(permission: String): Boolean =
        ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
}

/** Estado + ações do fluxo de permissões da corrida, para telas (prompt 08) consumirem. */
data class RunPermissionState(
    val hasForegroundLocation: Boolean,
    val hasBackgroundLocation: Boolean,
    val hasNotificationPermission: Boolean,
    /** true após um pedido de foreground negado — hora de mandar para os Ajustes (denied/restricted do iOS). */
    val foregroundDenied: Boolean,
    val requestForegroundLocation: () -> Unit,
    val requestBackgroundLocation: () -> Unit,
    val requestNotificationPermission: () -> Unit,
    val openAppSettings: () -> Unit,
) {
    /** Pronto para iniciar a corrida (fine concedido é o mínimo obrigatório). */
    val canStartRun: Boolean get() = hasForegroundLocation
}

/**
 * Fluxo de permissões **em etapas** (espelha os pedidos separados WhenInUse→Always do iOS):
 * 1) fine/coarse; 2) background (segundo pedido, API 29+ — não pode ir junto do fine, o sistema nega);
 * 3) POST_NOTIFICATIONS (API 33+, para a notificação do FGS). O caller orquestra a ordem.
 */
@Composable
fun rememberRunPermissionState(): RunPermissionState {
    val context = LocalContext.current

    var hasForeground by remember { mutableStateOf(LocationPermissions.hasForegroundLocation(context)) }
    var hasBackground by remember { mutableStateOf(LocationPermissions.hasBackgroundLocation(context)) }
    var hasNotifications by remember { mutableStateOf(LocationPermissions.hasNotificationPermission(context)) }
    var foregroundDenied by remember { mutableStateOf(false) }

    val foregroundLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) {
        hasForeground = LocationPermissions.hasForegroundLocation(context)
        if (!hasForeground) foregroundDenied = true
    }
    val backgroundLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) {
        hasBackground = LocationPermissions.hasBackgroundLocation(context)
    }
    val notificationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) {
        hasNotifications = LocationPermissions.hasNotificationPermission(context)
    }

    return RunPermissionState(
        hasForegroundLocation = hasForeground,
        hasBackgroundLocation = hasBackground,
        hasNotificationPermission = hasNotifications,
        foregroundDenied = foregroundDenied,
        openAppSettings = {
            context.startActivity(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.fromParts("package", context.packageName, null)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                },
            )
        },
        requestForegroundLocation = {
            foregroundLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                ),
            )
        },
        requestBackgroundLocation = {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                backgroundLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
            }
        },
        requestNotificationPermission = {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        },
    )
}
