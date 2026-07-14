package com.athly.runner.core.di

import android.content.Context
import androidx.room.Room
import com.athly.runner.core.data.db.AthlyDatabase
import com.athly.runner.core.data.db.RunSessionDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AthlyDatabase =
        Room.databaseBuilder(context, AthlyDatabase::class.java, "athly.db").build()

    @Provides
    fun provideRunSessionDao(db: AthlyDatabase): RunSessionDao = db.runSessionDao()
}
