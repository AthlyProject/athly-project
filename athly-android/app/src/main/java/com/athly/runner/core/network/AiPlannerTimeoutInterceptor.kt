package com.athly.runner.core.network

import okhttp3.Interceptor
import okhttp3.Response
import java.util.concurrent.TimeUnit

/**
 * O `plan-from-health` síncrono demora (geração de plano pela IA): 120s de timeout,
 * espelhando o `timeout: 120` do APIClient iOS. Demais rotas mantêm o padrão de 30s.
 */
class AiPlannerTimeoutInterceptor : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        return if (request.url.encodedPath.endsWith("/ai-planner/plan-from-health")) {
            chain
                .withReadTimeout(EXTENDED_TIMEOUT_SEC, TimeUnit.SECONDS)
                .withWriteTimeout(EXTENDED_TIMEOUT_SEC, TimeUnit.SECONDS)
                .proceed(request)
        } else {
            chain.proceed(request)
        }
    }

    private companion object {
        const val EXTENDED_TIMEOUT_SEC = 120
    }
}
