package com.athly.runner.core.network

import com.athly.runner.core.data.TokenStore
import okhttp3.Interceptor
import okhttp3.Response
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Adiciona `Authorization: Bearer <access>` a toda request, exceto rotas de auth
 * (login/register/refresh) — espelha o `buildRequest(authenticated:)` do APIClient iOS.
 * Também envia o header de correlação `X-Athly-Session-Id` (espelha o OTelClient iOS;
 * o backend loga para ligar spans do app aos request logs do servidor).
 */
@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenStore: TokenStore,
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val builder = request.newBuilder()
            .header("X-Athly-Session-Id", sessionId)

        if (!isAuthRoute(request.url.encodedPath)) {
            tokenStore.accessToken()?.let { builder.header("Authorization", "Bearer $it") }
        }
        return chain.proceed(builder.build())
    }

    companion object {
        /** Id de sessão por processo, como o `OTelClient.sessionId` do iOS. */
        val sessionId: String = UUID.randomUUID().toString()

        fun isAuthRoute(encodedPath: String): Boolean =
            encodedPath.endsWith("/auth/login") ||
                encodedPath.endsWith("/auth/register") ||
                encodedPath.endsWith("/auth/refresh")
    }
}
