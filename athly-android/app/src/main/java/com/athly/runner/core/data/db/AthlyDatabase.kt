package com.athly.runner.core.data.db

import androidx.room.Database
import androidx.room.RoomDatabase

/** Banco Room do app. Por enquanto só as corridas locais (histórico); cresce nos próximos prompts. */
@Database(entities = [RunSessionEntity::class], version = 1, exportSchema = false)
abstract class AthlyDatabase : RoomDatabase() {
    abstract fun runSessionDao(): RunSessionDao
}
