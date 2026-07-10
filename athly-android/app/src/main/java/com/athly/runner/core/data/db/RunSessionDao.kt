package com.athly.runner.core.data.db

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

/** DAO das corridas locais — `observeAll` ordenado por data desc espelha `sortedSessions` do iOS. */
@Dao
interface RunSessionDao {

    @Query("SELECT * FROM run_sessions ORDER BY startDateMillis DESC")
    fun observeAll(): Flow<List<RunSessionEntity>>

    @Query("SELECT * FROM run_sessions WHERE id = :id")
    suspend fun findById(id: String): RunSessionEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: RunSessionEntity)

    @Update
    suspend fun update(entity: RunSessionEntity)

    @Delete
    suspend fun delete(entity: RunSessionEntity)
}
