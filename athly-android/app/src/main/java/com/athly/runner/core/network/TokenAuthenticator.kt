package com.athly.runner.core.network

import com.athly.runner.core.data.TokenStore
import com.athly.runner.data.remote.dto.RefreshRequest
import com.athly.runner.data.remote.dto.RefreshResponse
import kotlinx.serialization.json.Json
import okhttp3.Authenticator
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

/**
 * Em 401: renova os tokens via POST /auth/refresh e refaz a request com o access novo —
 * espelha o fluxo `execute` → `refreshTokens` do APIClient iOS.
 *
 * Sincronização: um lock único evita refresh concorrente; threads que chegam depois
 * comparam o token da request falhada com o atual e, se outro thread já renovou,
 * apenas refazem com o token novo (sem segundo refresh).
 *
 * Falha de refresh → limpa tokens + emite [SessionEvents.Event.SessionExpired]
 * (o AuthViewModel do prompt 04 observa para deslogar).
 */
@Singleton
class TokenAuthenticator @Inject constructor(
    private val tokenStore: TokenStore,
    private val sessionEvents: SessionEvents,
    private val json: Json,
    @Named("baseUrl") private val baseUrl: String,
) : Authenticator {

    private val lock = Any()

    // Client próprio, SEM este authenticator/interceptor — evita ciclo de DI e loop de 401
    // (espelha o iOS, que faz o refresh com URLSession "crua").
    private val refreshClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    override fun authenticate(route: Route?, response: Response): Request? {
        val path = response.request.url.encodedPath
        // 401 em login/register é credencial errada; em refresh, o próprio refresh falhou.
        // Nenhum dos casos deve disparar novo refresh (nem apagar tokens de outra sessão).
        if (AuthInterceptor.isAuthRoute(path)) return null
        // Já refizemos uma vez após refresh e o backend seguiu negando → desiste
        // (espelha o iOS, que lança unauthorized sem notificar nesse caminho).
        if (responseCount(response) >= 2) return null

        val failedToken = response.request.header("Authorization")?.removePrefix("Bearer ")

        synchronized(lock) {
            val current = tokenStore.accessToken()
            // Outro thread renovou enquanto esperávamos o lock → só refaz com o token novo.
            if (current != null && current != failedToken) {
                return response.request.newBuilder()
                    .header("Authorization", "Bearer $current")
                    .build()
            }

            val refreshToken = tokenStore.refreshToken()
            if (refreshToken == null) {
                expireSession()
                return null
            }

            val refreshed = requestRefresh(refreshToken)
            if (refreshed == null) {
                expireSession()
                return null
            }

            tokenStore.save(refreshed.accessToken, refreshed.refreshToken)
            sessionEvents.notifyTokensRefreshed()
            return response.request.newBuilder()
                .header("Authorization", "Bearer ${refreshed.accessToken}")
                .build()
        }
    }

    /** Chamada síncrona (estamos em thread de rede do OkHttp). Qualquer falha → null. */
    private fun requestRefresh(refreshToken: String): RefreshResponse? = runCatching {
        val body = json.encodeToString(RefreshRequest.serializer(), RefreshRequest(refreshToken))
            .toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url(baseUrl + "auth/refresh")
            .post(body)
            .build()
        refreshClient.newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) return@runCatching null
            val raw = resp.body?.string().orEmpty()
            if (raw.isBlank()) return@runCatching null
            json.decodeFromString(RefreshResponse.serializer(), raw)
        }
    }.getOrNull()

    private fun expireSession() {
        tokenStore.clear()
        sessionEvents.notifySessionExpired()
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }
}
