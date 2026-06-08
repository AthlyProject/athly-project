package com.athly.runner.core.common

/**
 * Wrapper simples de resultado (espelha o tratamento de sucesso/erro do APIClient iOS).
 * Refinado/estendido no prompt 02 (mapeamento de erros HTTP, 401, etc.).
 */
sealed interface AthlyResult<out T> {
    data class Success<T>(val data: T) : AthlyResult<T>
    data class Failure(val error: Throwable, val message: String? = null) : AthlyResult<Nothing>
}

inline fun <T> AthlyResult<T>.onSuccess(block: (T) -> Unit): AthlyResult<T> {
    if (this is AthlyResult.Success) block(data)
    return this
}

inline fun <T> AthlyResult<T>.onFailure(block: (Throwable) -> Unit): AthlyResult<T> {
    if (this is AthlyResult.Failure) block(error)
    return this
}
