package com.athly.runner.core.network

import com.athly.runner.BuildConfig
import com.athly.runner.data.remote.ApiService
import com.athly.runner.data.remote.FakeApiService
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import dagger.Lazy
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit
import javax.inject.Named
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideJson(): Json = AthlyJson.create()

    /** BASE_URL do BuildConfig normalizada com barra final (exigência do Retrofit). */
    @Provides
    @Singleton
    @Named("baseUrl")
    fun provideBaseUrl(): String = BuildConfig.BASE_URL.trimEnd('/') + "/"

    @Provides
    @Singleton
    fun provideOkHttpClient(
        authInterceptor: AuthInterceptor,
        tokenAuthenticator: TokenAuthenticator,
    ): OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .addInterceptor(authInterceptor)
        .addInterceptor(AiPlannerTimeoutInterceptor())
        .authenticator(tokenAuthenticator)
        .apply {
            if (BuildConfig.DEBUG) {
                addInterceptor(
                    HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC },
                )
            }
        }
        .build()

    @Provides
    @Singleton
    fun provideRetrofit(
        okHttpClient: OkHttpClient,
        json: Json,
        @Named("baseUrl") baseUrl: String,
    ): Retrofit = Retrofit.Builder()
        .baseUrl(baseUrl)
        .client(okHttpClient)
        .addConverterFactory(NullOnEmptyConverterFactory())
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    /**
     * Seam único de rede (espelha o swap do iOS por `#if targetEnvironment(simulator)`).
     * Com `MOCK_BACKEND=true` (só debug, opt-in em local.properties) devolve o [FakeApiService]
     * 100% offline — o emulador roda sem backend nem credenciais. Caso contrário, cria o
     * `ApiService` real; `Lazy<Retrofit>` garante que a stack OkHttp/Retrofit nem é construída no mock.
     */
    @Provides
    @Singleton
    fun provideApiService(retrofit: Lazy<Retrofit>): ApiService =
        if (BuildConfig.MOCK_BACKEND) {
            FakeApiService()
        } else {
            retrofit.get().create(ApiService::class.java)
        }
}
