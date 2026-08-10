package com.primex.printingagent.data.local

import androidx.room.*
import java.util.*

@Entity(
    tableName = "offline_print_jobs",
    indices = [
        Index(value = ["status", "created_at"]),
        Index(value = ["device_id"])
    ]
)
data class OfflinePrintJob(
    @PrimaryKey(autoGenerate = true)
    val localId: Long = 0,
    
    @ColumnInfo(name = "remote_id")
    val remoteId: String? = null,  // Will be populated after sync
    
    @ColumnInfo(name = "device_id")
    val deviceId: String,
    
    @ColumnInfo(name = "printer_type")
    val printerType: String,  // receipt, kitchen, bar
    
    @ColumnInfo(name = "content_base64")
    val contentBase64: String,
    
    @ColumnInfo(name = "receipt_number")
    val receiptNumber: String,
    
    @ColumnInfo(name = "copies")
    val copies: Int = 1,
    
    @ColumnInfo(name = "status")
    val status: String,  // pending, synced, completed, failed
    
    @ColumnInfo(name = "attempts")
    val attempts: Int = 0,
    
    @ColumnInfo(name = "max_attempts")
    val maxAttempts: Int = 3,
    
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis(),
    
    @ColumnInfo(name = "error_message")
    val errorMessage: String? = null
) {
    companion object {
        const val STATUS_PENDING = "pending"
        const val STATUS_SYNCED = "synced"
        const val STATUS_COMPLETED = "completed"
        const val STATUS_FAILED = "failed"
    }
}

@Entity(
    tableName = "sync_queue",
    indices = [
        Index(value = ["status", "created_at"])
    ]
)
data class SyncQueueItem(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    
    @ColumnInfo(name = "print_job_id")
    val printJobId: Long,
    
    @ColumnInfo(name = "operation")
    val operation: String,  // create, update, complete
    
    @ColumnInfo(name = "status")
    val status: String,  // pending, syncing, synced, failed
    
    @ColumnInfo(name = "attempts")
    val attempts: Int = 0,
    
    @ColumnInfo(name = "max_attempts")
    val maxAttempts: Int = 5,
    
    @ColumnInfo(name = "payload")
    val payload: String,  // JSON
    
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis(),
    
    @ColumnInfo(name = "error_message")
    val errorMessage: String? = null
) {
    companion object {
        const val OPERATION_CREATE = "create"
        const val OPERATION_UPDATE = "update"
        const val OPERATION_COMPLETE = "complete"
        
        const val STATUS_PENDING = "pending"
        const val STATUS_SYNCING = "syncing"
        const val STATUS_SYNCED = "synced"
        const val STATUS_FAILED = "failed"
    }
}
