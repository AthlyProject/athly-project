package com.athly.runner.core.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * TokenStore sobre EncryptedSharedPreferences (Jetpack Security) — equivalente Android do
 * Keychain iOS (`kSecAttrAccessibleAfterFirstUnlock`). O nome do arquivo espelha o service
 * do KeychainHelper: `app.athly.runner.tokens`.
 */
@Singleton
class EncryptedTokenStore @Inject constructor(
    @ApplicationContext context: Context,
) : TokenStore {

    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            PREFS_FILE,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    // commit() síncrono de propósito: o TokenAuthenticator roda em thread de rede e precisa
    // que outras threads leiam o token novo imediatamente após o refresh.
    @Synchronized
    override fun save(access: String, refresh: String) {
        prefs.edit()
            .putString(KEY_ACCESS, access)
            .putString(KEY_REFRESH, refresh)
            .commit()
    }

    override fun accessToken(): String? = prefs.getString(KEY_ACCESS, null)

    override fun refreshToken(): String? = prefs.getString(KEY_REFRESH, null)

    @Synchronized
    override fun clear() {
        prefs.edit().clear().commit()
    }

    private companion object {
        const val PREFS_FILE = "app.athly.runner.tokens"
        const val KEY_ACCESS = "accessToken"
        const val KEY_REFRESH = "refreshToken"
    }
}
