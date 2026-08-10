package com.primex.printingagent.data.repository

import com.primex.printingagent.data.api.PrinterApiService
import com.primex.printingagent.data.local.OfflinePrintJob
import com.primex.printingagent.data.local.OfflinePrintJobDao
import com.primex.printingagent.data.local.SyncQueueDao
import com.primex.printingagent.data.local.SyncQueueItem
import com.primex.printingagent.data.models.PrintCompleteRequest
import timber.log.Timber

/**
 * Repository for handling offline sync of print jobs
 * Manages local queue persistence and backend synchronization
 */
class OfflineSyncRepository(
    private val apiService: PrinterApiService,
    private val jobDao: OfflinePrintJobDao,
    private val syncQueueDao: SyncQueueDao
) {
    
    /**
     * Queue a print job locally (offline)
     */
    suspend fun queuePrintJobOffline(
        deviceId: String,
        printerType: String,
        contentBase64: String,
        receiptNumber: String,
        copies: Int = 1
    ): Long {
        return try {
            val job = OfflinePrintJob(
                deviceId = deviceId,
                printerType = printerType,
                contentBase64 = contentBase64,
                receiptNumber = receiptNumber,
                copies = copies,
                status = OfflinePrintJob.STATUS_PENDING
            )
            
            val jobId = jobDao.insertJob(job)
            Timber.d("Queued print job offline: $jobId")
            
            // Add to sync queue
            val syncItem = SyncQueueItem(
                printJobId = jobId,
                operation = SyncQueueItem.OPERATION_CREATE,
                status = SyncQueueItem.STATUS_PENDING,
                payload = convertJobToJson(job)
            )
            syncQueueDao.insertItem(syncItem)
            
            jobId
        } catch (e: Exception) {
            Timber.e(e, "Error queueing print job offline")
            throw e
        }
    }
    
    /**
     * Sync pending jobs with backend
     */
    suspend fun syncPendingJobs(
        authHeader: String,
        baseUrl: String
    ): Result<Int> {
        return try {
            var syncedCount = 0
            
            val pendingJobs = jobDao.getJobsByStatus(OfflinePrintJob.STATUS_PENDING, 100)
            Timber.d("Syncing ${pendingJobs.size} pending jobs")
            
            for (job in pendingJobs) {
                try {
                    // If job has remote ID, update status
                    if (job.remoteId != null) {
                        val completeRequest = PrintCompleteRequest(
                            result = if (job.status == OfflinePrintJob.STATUS_COMPLETED) 
                                "completed" else "failed",
                            errorMessage = job.errorMessage ?: ""
                        )
                        
                        val response = apiService.completePrintJob(
                            job.remoteId!!,
                            completeRequest,
                            authHeader
                        )
                        
                        if (response.isSuccessful) {
                            jobDao.updateJobStatus(job.localId, OfflinePrintJob.STATUS_SYNCED)
                            syncedCount++
                            Timber.d("Synced job ${job.remoteId}")
                        }
                    }
                } catch (e: Exception) {
                    Timber.e(e, "Error syncing job ${job.localId}")
                    // Continue with next job
                }
            }
            
            Result.success(syncedCount)
        } catch (e: Exception) {
            Timber.e(e, "Error syncing pending jobs")
            Result.failure(e)
        }
    }
    
    /**
     * Get pending jobs for local printing
     */
    suspend fun getPendingJobsForPrinting(): List<OfflinePrintJob> {
        return try {
            jobDao.getJobsByStatus(OfflinePrintJob.STATUS_PENDING, 50)
        } catch (e: Exception) {
            Timber.e(e, "Error getting pending jobs")
            emptyList()
        }
    }
    
    /**
     * Mark a local job as completed
     */
    suspend fun markJobCompleted(jobId: Long, errorMessage: String? = null) {
        try {
            jobDao.updateJobStatus(jobId, OfflinePrintJob.STATUS_COMPLETED)
            Timber.d("Marked job $jobId as completed")
        } catch (e: Exception) {
            Timber.e(e, "Error marking job as completed")
        }
    }
    
    /**
     * Mark a local job as failed
     */
    suspend fun markJobFailed(jobId: Long, errorMessage: String) {
        try {
            val job = jobDao.getJobById(jobId)
            if (job != null) {
                if (job.attempts >= job.maxAttempts) {
                    jobDao.updateJobStatus(jobId, OfflinePrintJob.STATUS_FAILED)
                } else {
                    jobDao.updateJobStatus(jobId, OfflinePrintJob.STATUS_PENDING)
                }
            }
            Timber.d("Marked job $jobId as failed (attempt ${job?.attempts}/${job?.maxAttempts})")
        } catch (e: Exception) {
            Timber.e(e, "Error marking job as failed")
        }
    }
    
    /**
     * Get job queue statistics
     */
    suspend fun getQueueStats(): QueueStats {
        return try {
            val totalJobs = jobDao.getTotalJobCount()
            val pendingJobs = jobDao.getJobsByStatus(OfflinePrintJob.STATUS_PENDING)
            val completedJobs = jobDao.getJobsByStatus(OfflinePrintJob.STATUS_COMPLETED)
            val failedJobs = jobDao.getJobsByStatus(OfflinePrintJob.STATUS_FAILED)
            
            QueueStats(
                total = totalJobs,
                pending = pendingJobs.size,
                completed = completedJobs.size,
                failed = failedJobs.size
            )
        } catch (e: Exception) {
            Timber.e(e, "Error getting queue stats")
            QueueStats(0, 0, 0, 0)
        }
    }
    
    /**
     * Clean up old jobs
     */
    suspend fun cleanupOldJobs(olderThanDays: Int = 7) {
        try {
            val timestamp = System.currentTimeMillis() - (olderThanDays * 24 * 60 * 60 * 1000L)
            jobDao.deleteJobsOlderThan(timestamp)
            Timber.d("Cleaned up jobs older than $olderThanDays days")
        } catch (e: Exception) {
            Timber.e(e, "Error cleaning up old jobs")
        }
    }
    
    private fun convertJobToJson(job: OfflinePrintJob): String {
        // Simple JSON representation
        return """{
            "device_id": "${job.deviceId}",
            "printer_type": "${job.printerType}",
            "content_base64": "${job.contentBase64}",
            "receipt_number": "${job.receiptNumber}",
            "copies": ${job.copies}
        }"""
    }
}

data class QueueStats(
    val total: Int,
    val pending: Int,
    val completed: Int,
    val failed: Int
)
