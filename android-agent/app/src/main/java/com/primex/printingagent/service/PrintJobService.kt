package com.primex.printingagent.service

import android.app.Service
import android.content.Intent
import android.os.IBinder
import androidx.work.*
import com.primex.printingagent.data.api.ApiClient
import com.primex.printingagent.data.models.ClaimPrintJobRequest
import com.primex.printingagent.data.models.PrintCompleteRequest
import com.primex.printingagent.data.models.PrintJob
import com.primex.printingagent.domain.DeviceManager
import com.primex.printingagent.domain.PrinterManager
import com.primex.printingagent.domain.PrinterType
import kotlinx.coroutines.*
import timber.log.Timber
import java.util.concurrent.TimeUnit

/**
 * Service that manages print job polling and execution
 * Runs as a foreground service to maintain continuity
 */
class PrintJobService : Service() {
    private val scope = CoroutineScope(Dispatchers.Main + Job())
    private lateinit var deviceManager: DeviceManager
    private lateinit var printerManager: PrinterManager
    private var pollingJob: Job? = null
    private var selectedPrinter: PrinterType? = null

    companion object {
        private const val POLL_INTERVAL_SECONDS = 5L
        private const val CHANNEL = "mobile"
    }

    override fun onCreate() {
        super.onCreate()
        Timber.d("PrintJobService created")
        
        deviceManager = DeviceManager(this)
        printerManager = PrinterManager(this)
        
        startForegroundService()
        initializeAndStartPolling()
    }

    private fun startForegroundService() {
        val notification = NotificationHelper.buildServiceNotification(this)
        startForeground(NotificationHelper.NOTIFICATION_ID, notification)
    }

    private fun initializeAndStartPolling() {
        scope.launch {
            try {
                // Detect and select printer
                val printers = printerManager.detectAvailablePrinters()
                if (printers.isNotEmpty()) {
                    selectedPrinter = printers.first()
                    Timber.d("Selected printer: ${printerManager.getPrinterDisplayName(selectedPrinter!!)}")
                } else {
                    Timber.w("No printers detected")
                }

                // Get or check configuration
                val deviceId = deviceManager.getOrCreateDeviceId()
                val apiKey = deviceManager.getApiKey()
                val baseUrl = deviceManager.getBaseUrl()

                if (baseUrl == null) {
                    Timber.e("Base URL not configured")
                    return@launch
                }

                if (apiKey == null) {
                    Timber.w("API key not set, attempting pairing")
                    // Device needs pairing
                    return@launch
                }

                startPolling(deviceId, apiKey, baseUrl)
            } catch (e: Exception) {
                Timber.e(e, "Error initializing print service")
            }
        }
    }

    private fun startPolling(deviceId: String, apiKey: String, baseUrl: String) {
        // Cancel existing polling job
        pollingJob?.cancel()

        pollingJob = scope.launch {
            while (isActive) {
                try {
                    Timber.d("Polling for print jobs...")
                    
                    val apiService = ApiClient.getApiService(baseUrl, this@PrintJobService)
                    val authHeader = deviceManager.getAuthHeader(apiKey)
                    
                    val request = ClaimPrintJobRequest(
                        channel = CHANNEL,
                        deviceId = deviceId,
                        printerType = "receipt"
                    )

                    val response = apiService.claimNextPrintJob(request, authHeader)

                    if (response.isSuccessful) {
                        val printJob = response.body()
                        if (printJob != null) {
                            Timber.d("Print job claimed: ${printJob.id}")
                            processPrintJob(printJob, authHeader, apiService)
                        }
                    } else if (response.code() == 204) {
                        // No content - no pending jobs
                        Timber.v("No pending print jobs")
                    } else {
                        Timber.w("Failed to claim print job: ${response.code()}")
                    }

                    // Wait before next poll
                    delay(POLL_INTERVAL_SECONDS * 1000)
                } catch (e: Exception) {
                    Timber.e(e, "Error during polling")
                    delay(POLL_INTERVAL_SECONDS * 1000) // Retry after delay
                }
            }
        }
    }

    private suspend fun processPrintJob(
        printJob: PrintJob,
        authHeader: String,
        apiService: com.primex.printingagent.data.api.PrinterApiService
    ) {
        try {
            if (selectedPrinter == null) {
                Timber.e("No printer available for job ${printJob.id}")
                completePrintJob(printJob.id, "failed", "No printer available", authHeader, apiService)
                return
            }

            val payload = printJob.payload
            val success = when (selectedPrinter) {
                is PrinterType.Thermal -> {
                    printerManager.printToThermalPrinter(
                        (selectedPrinter as PrinterType.Thermal).path,
                        payload.contentBase64,
                        payload.copies
                    )
                }
                is PrinterType.USB -> {
                    printerManager.printToUSBPrinter(
                        (selectedPrinter as PrinterType.USB).device,
                        payload.contentBase64,
                        payload.copies
                    )
                }
                is PrinterType.AndroidPrint -> {
                    printerManager.printUsingAndroidPrintFramework(
                        payload.contentBase64,
                        payload.receiptNumber
                    )
                }
                else -> false
            }

            if (success) {
                Timber.d("Print job ${printJob.id} completed successfully")
                completePrintJob(printJob.id, "completed", "", authHeader, apiService)
            } else {
                val attempts = (printJob.attempts ?: 0) + 1
                val result = if (attempts >= printJob.maxAttempts) "failed_permanent" else "failed"
                Timber.w("Print job ${printJob.id} failed (attempt $attempts/${printJob.maxAttempts})")
                completePrintJob(printJob.id, result, "Print failed", authHeader, apiService)
            }
        } catch (e: Exception) {
            Timber.e(e, "Error processing print job ${printJob.id}")
            completePrintJob(printJob.id, "failed", e.message ?: "Unknown error", authHeader, apiService)
        }
    }

    private suspend fun completePrintJob(
        jobId: String,
        result: String,
        errorMessage: String,
        authHeader: String,
        apiService: com.primex.printingagent.data.api.PrinterApiService
    ) {
        try {
            val request = PrintCompleteRequest(result = result, errorMessage = errorMessage)
            val response = apiService.completePrintJob(jobId, request, authHeader)

            if (response.isSuccessful) {
                Timber.d("Print job $jobId marked as $result")
            } else {
                Timber.e("Failed to complete print job $jobId: ${response.code()}")
            }
        } catch (e: Exception) {
            Timber.e(e, "Error completing print job $jobId")
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Timber.d("PrintJobService onStartCommand")
        return START_STICKY // Restart if killed
    }

    override fun onDestroy() {
        Timber.d("PrintJobService destroyed")
        pollingJob?.cancel()
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
