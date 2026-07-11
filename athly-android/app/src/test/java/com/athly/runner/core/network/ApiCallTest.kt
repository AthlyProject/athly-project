package com.athly.runner.core.network

import com.athly.runner.core.common.AthlyResult
import com.athly.runner.data.remote.dto.TrainingPlanDto
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.coroutines.runBlocking
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.http.DELETE
import retrofit2.http.GET

/**
 * Valida o espelhamento do execute/executeOptional do iOS: corpo `null`/vazio e 404 viram
 * Success(null) nas rotas opcionais; erros HTTP mapeiam para ApiError.
 */
class ApiCallTest {

    private interface TestService {
        @GET("training-plans/me")
        suspend fun plan(): Response<TrainingPlanDto>

        @DELETE("users/me")
        suspend fun delete(): Response<Unit>
    }

    private lateinit var server: MockWebServer
    private lateinit var service: TestService

    private val planJson = """
        {"id":"tp1","startDate":"2026-07-01","objective":"10k sub 50",
         "createdAt":"2026-07-01T10:00:00Z","updatedAt":"2026-07-01T10:00:00Z"}
    """.trimIndent()

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        service = Retrofit.Builder()
            .baseUrl(server.url("/"))
            .addConverterFactory(NullOnEmptyConverterFactory())
            .addConverterFactory(AthlyJson.create().asConverterFactory("application/json".toMediaType()))
            .build()
            .create(TestService::class.java)
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `200 com corpo valido decodifica`() = runBlocking<Unit> {
        server.enqueue(MockResponse().setBody(planJson))
        val result = apiCall { service.plan() }
        assertTrue(result is AthlyResult.Success)
        assertEquals("tp1", (result as AthlyResult.Success).data.id)
    }

    @Test
    fun `200 com corpo null literal vira Success(null) na rota opcional`() = runBlocking<Unit> {
        server.enqueue(MockResponse().setBody("null"))
        val result = apiCallOptional { service.plan() }
        assertNull((result as AthlyResult.Success).data)
    }

    @Test
    fun `200 com corpo vazio vira Success(null) na rota opcional`() = runBlocking<Unit> {
        server.enqueue(MockResponse())
        val result = apiCallOptional { service.plan() }
        assertNull((result as AthlyResult.Success).data)
    }

    @Test
    fun `404 vira Success(null) na rota opcional e NotFound na obrigatoria`() = runBlocking<Unit> {
        server.enqueue(MockResponse().setResponseCode(404))
        server.enqueue(MockResponse().setResponseCode(404))

        val optional = apiCallOptional { service.plan() }
        assertNull((optional as AthlyResult.Success).data)

        val required = apiCall { service.plan() }
        assertTrue((required as AthlyResult.Failure).error is ApiError.NotFound)
    }

    @Test
    fun `erro de servidor mapeia codigo e corpo`() = runBlocking<Unit> {
        server.enqueue(MockResponse().setResponseCode(500).setBody("boom"))
        val result = apiCall { service.plan() }
        val error = (result as AthlyResult.Failure).error as ApiError.Server
        assertEquals(500, error.code)
        assertEquals("boom", error.body)
    }

    @Test
    fun `401 mapeia para Unauthorized`() = runBlocking<Unit> {
        server.enqueue(MockResponse().setResponseCode(401))
        val result = apiCall { service.plan() }
        assertTrue((result as AthlyResult.Failure).error is ApiError.Unauthorized)
    }

    @Test
    fun `endpoint Unit ignora corpo vazio`() = runBlocking<Unit> {
        server.enqueue(MockResponse().setResponseCode(200))
        val result = apiCallUnit { service.delete() }
        assertTrue(result is AthlyResult.Success)
    }
}
