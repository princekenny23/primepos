package com.primex.printingagent.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface OfflinePrintJobDao {
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertJob(job: OfflinePrintJob): Long
    
    @Update
    suspend fun updateJob(job: OfflinePrintJob)
    
    @Delete
    suspend fun deleteJob(job: OfflinePrintJob)
    
    @Query("SELECT * FROM offline_print_jobs WHERE localId = :id")
    suspend fun getJobById(id: Long): OfflinePrintJob?
    
    @Query("SELECT * FROM offline_print_jobs WHERE remote_id = :remoteId")
    suspend fun getJobByRemoteId(remoteId: String): OfflinePrintJob?
    
    @Query("""
        SELECT * FROM offline_print_jobs 
        WHERE status = :status 
        ORDER BY created_at ASC 
        LIMIT :limit
    """)
    suspend fun getJobsByStatus(status: String, limit: Int = 10): List<OfflinePrintJob>
    
    @Query("""
        SELECT * FROM offline_print_jobs 
        WHERE status = 'pending' AND attempts < max_attempts
        ORDER BY created_at ASC 
        LIMIT :limit
    """)
    fun getPendingJobs(limit: Int = 10): Flow<List<OfflinePrintJob>>
    
    @Query("SELECT * FROM offline_print_jobs ORDER BY created_at DESC LIMIT :limit")
    fun getRecentJobs(limit: Int = 20): Flow<List<OfflinePrintJob>>
    
    @Query("""
        SELECT * FROM offline_print_jobs 
        WHERE created_at > :timestamp 
        ORDER BY created_at DESC
    """)
    suspend fun getJobsCreatedAfter(timestamp: Long): List<OfflinePrintJob>
    
    @Query("SELECT COUNT(*) FROM offline_print_jobs WHERE status = 'pending'")
    fun getPendingJobCount(): Flow<Int>
    
    @Query("SELECT COUNT(*) FROM offline_print_jobs")
    suspend fun getTotalJobCount(): Int
    
    @Query("DELETE FROM offline_print_jobs WHERE status = 'completed'")
    suspend fun deleteCompletedJobs()
    
    @Query("""
        DELETE FROM offline_print_jobs 
        WHERE created_at < :timestamp
    """)
    suspend fun deleteJobsOlderThan(timestamp: Long)
    
    @Query("""
        UPDATE offline_print_jobs 
        SET status = :newStatus, attempts = attempts + 1, updated_at = :timestamp
        WHERE localId = :id
    """)
    suspend fun updateJobStatus(id: Long, newStatus: String, timestamp: Long = System.currentTimeMillis())
    
    @Query("""
        UPDATE offline_print_jobs 
        SET status = :newStatus, remote_id = :remoteId, updated_at = :timestamp
        WHERE localId = :id
    """)
    suspend fun markJobSynced(id: Long, remoteId: String, newStatus: String, timestamp: Long = System.currentTimeMillis())
}

@Dao
interface SyncQueueDao {
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertItem(item: SyncQueueItem): Long
    
    @Update
    suspend fun updateItem(item: SyncQueueItem)
    
    @Delete
    suspend fun deleteItem(item: SyncQueueItem)
    
    @Query("SELECT * FROM sync_queue WHERE id = :id")
    suspend fun getItemById(id: Long): SyncQueueItem?
    
    @Query("""
        SELECT * FROM sync_queue 
        WHERE status = 'pending' AND attempts < max_attempts
        ORDER BY created_at ASC 
        LIMIT :limit
    """)
    suspend fun getPendingSyncItems(limit: Int = 5): List<SyncQueueItem>
    
    @Query("""
        SELECT * FROM sync_queue 
        WHERE print_job_id = :printJobId 
        ORDER BY created_at DESC
    """)
    suspend fun getItemsByPrintJob(printJobId: Long): List<SyncQueueItem>
    
    @Query("""
        SELECT * FROM sync_queue 
        WHERE status = 'synced'
        ORDER BY created_at DESC 
        LIMIT :limit
    """)
    fun getSyncedItems(limit: Int = 20): Flow<List<SyncQueueItem>>
    
    @Query("SELECT COUNT(*) FROM sync_queue WHERE status = 'pending'")
    fun getPendingSyncCount(): Flow<Int>
    
    @Query("""
        UPDATE sync_queue 
        SET status = :newStatus, attempts = attempts + 1, updated_at = :timestamp
        WHERE id = :id
    """)
    suspend fun updateItemStatus(id: Long, newStatus: String, timestamp: Long = System.currentTimeMillis())
    
    @Query("""
        UPDATE sync_queue 
        SET status = :newStatus, error_message = :error, updated_at = :timestamp
        WHERE id = :id
    """)
    suspend fun updateItemStatusWithError(id: Long, newStatus: String, error: String?, timestamp: Long = System.currentTimeMillis())
    
    @Query("""
        DELETE FROM sync_queue 
        WHERE status = 'synced' AND created_at < :timestamp
    """)
    suspend fun deleteSyncedItemsOlderThan(timestamp: Long)
    
    @Query("DELETE FROM sync_queue")
    suspend fun clearQueue()
}
