package com.primex.printingagent.data.api

import com.primex.printingagent.data.models.*
import retrofit2.Response
import retrofit2.http.*

interface PrinterApiService {
    
    @POST("api/devices/pairing/request/")
    suspend fun requestPairingCode(
        @Body request: PairingRequest
    ): Response<PairingResponse>

    @POST("api/devices/pairing/status/")
    suspend fun getPairingStatus(
        @Body request: PairingStatusRequest
    ): Response<PairingStatusResponse>

    @POST("api/devices/register-device/")
    suspend fun registerDevice(
        @Body request: DeviceRegistrationRequest,
        @Header("Authorization") authHeader: String? = null
    ): Response<DeviceRegistrationResponse>

    @POST("api/print-jobs/claim-next/")
    suspend fun claimNextPrintJob(
        @Body request: ClaimPrintJobRequest,
        @Header("Authorization") authHeader: String
    ): Response<PrintJob>

    @POST("api/print-jobs/{jobId}/complete/")
    suspend fun completePrintJob(
        @Path("jobId") jobId: String,
        @Body request: PrintCompleteRequest,
        @Header("Authorization") authHeader: String
    ): Response<PrintJob>

    @GET("api/print-jobs/")
    suspend fun getPrintJobs(
        @Query("device_id") deviceId: String,
        @Query("status") status: String,
        @Header("Authorization") authHeader: String
    ): Response<PrintJob>

    @POST("api/print-jobs/test-print/")
    suspend fun testPrint(
        @Body request: Map<String, Any>,
        @Header("Authorization") authHeader: String
    ): Response<PrintJob>
}
