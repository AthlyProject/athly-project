package com.athly.runner.core.di

import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

/**
 * Gancho de DI a nível de aplicação. Provedores reais (OkHttp/Retrofit, DataStore, Room,
 * repositories, HealthConnect, etc.) entram a partir do prompt 02.
 */
@Module
@InstallIn(SingletonComponent::class)
object AppModule
