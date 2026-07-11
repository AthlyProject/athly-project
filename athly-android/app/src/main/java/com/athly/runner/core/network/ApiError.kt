package com.athly.runner.core.network

import java.io.IOException

/** Espelha o `APIError` do iOS (mensagens idênticas). */
sealed class ApiError(message: String, cause: Throwable? = null) : Exception(message, cause) {

    class Unauthorized : ApiError("Sessão expirada. Faça login novamente.")

    class NotFound : ApiError("Recurso não encontrado")

    class Server(val code: Int, val body: String) : ApiError("Erro $code: $body")

    class Network(cause: IOException) : ApiError("Falha de rede", cause)

    class Decode(cause: Throwable) : ApiError("Resposta inválida do servidor", cause)
}
