package com.athly.runner.core.network

import com.athly.runner.core.data.TokenStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * Valida o critério de aceite do prompt 02: em 401 o TokenAuthenticator renova e refaz;
 * refresh inválido → logout (tokens limpos + evento); sem refresh concorrente.
 */
class TokenAuthenticatorTest {

    private class FakeTokenStore : TokenStore {
        @Volatile private var access: String? = null
        @Volatile private var refresh: String? = null

        override fun save(access: String, refresh: String) {
            this.access = access
            this.refresh = refresh
        }

        override fun accessToken(): String? = access
        override fun refreshToken(): String? = refresh
        override fun clear() {
            access = null
            refresh = null
        }
    }

    private lateinit var server: MockWebServer
    private lateinit var store: FakeTokenStore
    private lateinit var events: SessionEvents
    private lateinit var client: OkHttpClient
    private lateinit var collectScope: CoroutineScope
    private val received = CopyOnWriteArrayList<SessionEvents.Event>()

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        store = FakeTokenStore()
        events = SessionEvents()
        // Dispatchers.Unconfined: o coletor roda inline na thread emissora → asserts determinísticos.
        collectScope = CoroutineScope(Dispatchers.Unconfined)
        collectScope.launch { events.events.collect { received.add(it) } }

        val authenticator = TokenAuthenticator(
            tokenStore = store,
            sessionEvents = events,
            json = AthlyJson.create(),
            baseUrl = server.url("/").toString(),
        )
        client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(store))
            .authenticator(authenticator)
            .build()
    }

    @After
    fun tearDown() {
        collectScope.cancel()
        server.shutdown()
    }

    private fun get(path: String): Response =
        client.newCall(Request.Builder().url(server.url(path)).build()).execute()

    @Test
    fun `em 401 renova os tokens e refaz a request com o access novo`() {
        store.save("old", "r1")
        server.enqueue(MockResponse().setResponseCode(401))
        server.enqueue(MockResponse().setBody("""{"accessToken":"new","refreshToken":"r2"}"""))
        server.enqueue(MockResponse().setBody("""{"id":"u1","email":"a@b.c"}"""))

        val response = get("/users/me")

        assertEquals(200, response.code)

        val original = server.takeRequest()
        assertEquals("Bearer old", original.getHeader("Authorization"))

        val refreshRequest = server.takeRequest()
        assertEquals("/auth/refresh", refreshRequest.path)
        assertTrue(refreshRequest.body.readUtf8().contains(""""refreshToken":"r1""""))

        val retry = server.takeRequest()
        assertEquals("Bearer new", retry.getHeader("Authorization"))

        assertEquals("new", store.accessToken())
        assertEquals("r2", store.refreshToken())
        assertTrue(received.contains(SessionEvents.Event.TokensRefreshed))
    }

    @Test
    fun `refresh invalido limpa tokens e emite sessao expirada`() {
        store.save("old", "r1")
        server.enqueue(MockResponse().setResponseCode(401))
        server.enqueue(MockResponse().setResponseCode(401)) // backend nega o refresh

        val response = get("/users/me")

        assertEquals(401, response.code)
        assertNull(store.accessToken())
        assertNull(store.refreshToken())
        assertTrue(received.contains(SessionEvents.Event.SessionExpired))
    }

    @Test
    fun `401 em rota de auth (senha errada) nao dispara refresh nem apaga tokens`() {
        store.save("old", "r1")
        server.enqueue(MockResponse().setResponseCode(401))

        val response = client.newCall(
            Request.Builder()
                .url(server.url("/auth/login"))
                .post("{}".toRequestBody("application/json".toMediaType()))
                .build(),
        ).execute()

        assertEquals(401, response.code)
        assertEquals(1, server.requestCount)
        assertEquals("old", store.accessToken())
        assertTrue(received.isEmpty())
    }

    @Test
    fun `varios 401 concorrentes fazem um unico refresh`() {
        store.save("old", "r1")
        val refreshCount = AtomicInteger(0)
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse = when {
                request.path == "/auth/refresh" -> {
                    refreshCount.incrementAndGet()
                    Thread.sleep(200) // segura o refresh para os outros 401 baterem no lock
                    MockResponse().setBody("""{"accessToken":"new","refreshToken":"r2"}""")
                }
                request.getHeader("Authorization") == "Bearer new" -> MockResponse().setBody("{}")
                else -> MockResponse().setResponseCode(401)
            }
        }

        val executor = Executors.newFixedThreadPool(4)
        val codes = (1..4)
            .map { executor.submit<Int> { get("/users/me").use { it.code } } }
            .map { it.get(15, TimeUnit.SECONDS) }
        executor.shutdown()

        assertTrue("todas as chamadas devem terminar em 200: $codes", codes.all { it == 200 })
        assertEquals(1, refreshCount.get())
        assertEquals("new", store.accessToken())
    }
}
