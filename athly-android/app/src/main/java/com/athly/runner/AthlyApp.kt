package com.athly.runner

import android.app.Application
import android.util.Log
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class AthlyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // Confirma a resolução do BASE_URL (de local.properties / DEV_API_URL). Critério de aceite da fatia 00.
        Log.i(TAG, "BASE_URL = ${BuildConfig.BASE_URL}")
    }

    companion object {
        private const val TAG = "Athly"
    }
}
