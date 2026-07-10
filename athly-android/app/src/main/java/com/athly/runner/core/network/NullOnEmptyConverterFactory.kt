package com.athly.runner.core.network

import okhttp3.ResponseBody
import okhttp3.ResponseBody.Companion.toResponseBody
import retrofit2.Converter
import retrofit2.Retrofit
import java.lang.reflect.Type

/**
 * Espelha o `executeOptional` do APIClient iOS: o backend responde 200 com corpo vazio ou
 * literal `null` quando não há recurso (ex.: /training-plans/me, /workouts/today, /goals/active).
 * Este factory converte esses corpos em `null` antes do kotlinx tentar (e falhar) desserializar.
 * Para `Unit` (endpoints sem retorno), o corpo é ignorado por completo.
 */
class NullOnEmptyConverterFactory : Converter.Factory() {

    override fun responseBodyConverter(
        type: Type,
        annotations: Array<out Annotation>,
        retrofit: Retrofit,
    ): Converter<ResponseBody, *> {
        val delegate = retrofit.nextResponseBodyConverter<Any>(this, type, annotations)
        return Converter<ResponseBody, Any?> { body ->
            val raw = body.string()
            when {
                type == Unit::class.java -> Unit
                raw.isBlank() || raw.trim() == "null" -> null
                else -> delegate.convert(raw.toResponseBody(body.contentType()))
            }
        }
    }
}
