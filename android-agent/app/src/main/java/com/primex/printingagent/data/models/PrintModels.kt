package com.primex.printingagent.data.models

import com.google.gson.annotations.SerializedName

data class PrintJob(
    @SerializedName("id")
    val id: String,
    @SerializedName("tenant")
    val tenantId: String,
    @SerializedName("outlet")
    val outletId: String,
    @SerializedName("device_id")
    val deviceId: String,
    @SerializedName("printer_type")
    val printerType: String, // receipt, kitchen, bar
    @SerializedName("channel")
    val channel: String, // mobile, agent
    @SerializedName("status")
    val status: String, // pending, claimed, completed, failed_permanent
    @SerializedName("payload")
    val payload: PrintPayload,
    @SerializedName("printer_identifier")
    val printerIdentifier: String?,
    @SerializedName("attempts")
    val attempts: Int = 0,
    @SerializedName("max_attempts")
    val maxAttempts: Int = 3,
    @SerializedName("created_at")
    val createdAt: String,
    @SerializedName("claimed_at")
    val claimedAt: String?,
    @SerializedName("completed_at")
    val completedAt: String?
) {
    companion object {
        const val STATUS_PENDING = "pending"
        const val STATUS_CLAIMED = "claimed"
        const val STATUS_COMPLETED = "completed"
        const val STATUS_FAILED_PERMANENT = "failed_permanent"
    }
}

data class PrintPayload(
    @SerializedName("content_base64")
    val contentBase64: String,
    @SerializedName("receipt_number")
    val receiptNumber: String,
    @SerializedName("copies")
    val copies: Int = 1
)

data class PrintJobResponse(
    @SerializedName("detail")
    val detail: String?
)

data class PrintCompleteRequest(
    @SerializedName("result")
    val result: String, // completed, failed, failed_permanent, cancelled
    @SerializedName("error_message")
    val errorMessage: String = ""
)

data class DeviceRegistrationRequest(
    @SerializedName("device_id")
    val deviceId: String,
    @SerializedName("channel")
    val channel: String = "mobile",
    @SerializedName("outlet_id")
    val outletId: String,
    @SerializedName("device_name")
    val deviceName: String,
    @SerializedName("printer_identifier")
    val printerIdentifier: String,
    @SerializedName("is_active")
    val isActive: Boolean = true
)

data class DeviceRegistrationResponse(
    @SerializedName("registered")
    val registered: Boolean,
    @SerializedName("created")
    val created: Boolean,
    @SerializedName("device_id")
    val deviceId: String,
    @SerializedName("api_key")
    val apiKey: String?,
    @SerializedName("device")
    val device: DeviceInfo?
)

data class DeviceInfo(
    @SerializedName("id")
    val id: String,
    @SerializedName("device_id")
    val deviceId: String,
    @SerializedName("name")
    val name: String,
    @SerializedName("channel")
    val channel: String,
    @SerializedName("printer_identifier")
    val printerIdentifier: String,
    @SerializedName("is_active")
    val isActive: Boolean,
    @SerializedName("last_seen_at")
    val lastSeenAt: String?
)

data class PairingRequest(
    @SerializedName("device_id")
    val deviceId: String,
    @SerializedName("channel")
    val channel: String = "mobile",
    @SerializedName("printer_identifier")
    val printerIdentifier: String
)

data class PairingResponse(
    @SerializedName("device_id")
    val deviceId: String,
    @SerializedName("pairing_code")
    val pairingCode: String,
    @SerializedName("expires_at")
    val expiresAt: String,
    @SerializedName("message")
    val message: String
)

data class ClaimPrintJobRequest(
    @SerializedName("channel")
    val channel: String = "mobile",
    @SerializedName("device_id")
    val deviceId: String,
    @SerializedName("printer_type")
    val printerType: String = ""
)
