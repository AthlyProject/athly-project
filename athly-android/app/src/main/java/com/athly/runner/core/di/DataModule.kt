package com.athly.runner.core.di

import com.athly.runner.core.data.EncryptedTokenStore
import com.athly.runner.core.data.TokenStore
import com.athly.runner.core.health.HealthConnectHealthRepository
import com.athly.runner.data.repository.HealthRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class DataModule {

    @Binds
    @Singleton
    abstract fun bindTokenStore(impl: EncryptedTokenStore): TokenStore

    @Binds
    @Singleton
    abstract fun bindHealthRepository(impl: HealthConnectHealthRepository): HealthRepository
}
