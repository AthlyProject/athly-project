package com.athly.runner.core.network

import kotlinx.serialization.json.Json

/**
 * Configuração única do kotlinx.serialization (produção e testes).
 *
 * Casing: o backend usa camelCase em requests e responses (verificado no athly-backend);
 * NENHUMA naming strategy — os nomes de propriedade Kotlin são o contrato.
 * `explicitNulls = false` omite nulos no encode (paridade com o encodeIfPresent do iOS).
 * `coerceInputValues = true` tolera `null` do backend em campos com default.
 */
object AthlyJson {
    fun create(): Json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
        explicitNulls = false
    }
}
