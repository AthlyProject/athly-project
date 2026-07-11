package com.athly.runner.core.network

import com.athly.runner.core.common.AthlyResult
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.SerializationException
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.Response
import java.io.IOException

/*
 * Espelham o `execute`/`executeOptional` do APIClient iOS: mapeiam status HTTP → ApiError
 * e envolvem o resultado em AthlyResult. O 401 que chega aqui já passou pelo
 * TokenAuthenticator (refresh falhou ou não havia tokens).
 */

/** Chamada cujo corpo é obrigatório — corpo nulo em 2xx vira erro de decode (como no iOS). */
suspend fun <T> apiCall(call: suspend () -> Response<T>): AthlyResult<T> = runApi {
    val response = call()
    if (!response.isSuccessful) return@runApi failure(response.toApiError())
    val body = response.body()
        ?: return@runApi failure(ApiError.Decode(IllegalStateException("Corpo vazio em resposta 2xx")))
    AthlyResult.Success(body)
}

/** Espelha `executeOptional`: 404 ou corpo vazio/`null` → Success(null) em vez de erro. */
suspend fun <T> apiCallOptional(call: suspend () -> Response<T>): AthlyResult<T?> = runApi {
    val response = call()
    when {
        response.isSuccessful -> AthlyResult.Success(response.body())
        response.code() == 404 -> AthlyResult.Success(null)
        else -> failure(response.toApiError())
    }
}

/** Endpoints sem corpo de resposta (DELETE /users/me, feedback, etc.). */
suspend fun apiCallUnit(call: suspend () -> Response<Unit>): AthlyResult<Unit> = runApi {
    val response = call()
    if (response.isSuccessful) AthlyResult.Success(Unit) else failure(response.toApiError())
}

/** Corpo vazio com Content-Type json — espelha o PATCH sem httpBody do iOS (OkHttp exige corpo em PATCH). */
fun emptyJsonBody(): RequestBody = "".toRequestBody("application/json".toMediaType())

private inline fun <T> runApi(block: () -> AthlyResult<T>): AthlyResult<T> = try {
    block()
} catch (e: CancellationException) {
    throw e
} catch (e: IOException) {
    failure(ApiError.Network(e))
} catch (e: SerializationException) {
    failure(ApiError.Decode(e))
}

private fun <T> Response<T>.toApiError(): ApiError = when (code()) {
    401 -> ApiError.Unauthorized()
    404 -> ApiError.NotFound()
    else -> ApiError.Server(code(), errorBody()?.string().orEmpty().ifBlank { "Unknown error" })
}

private fun failure(error: ApiError): AthlyResult.Failure = AthlyResult.Failure(error, error.message)
