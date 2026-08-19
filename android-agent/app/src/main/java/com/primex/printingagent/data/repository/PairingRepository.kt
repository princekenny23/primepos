package com.primex.printingagent.data.repository

import com.primex.printingagent.data.api.PrinterApiService
import com.primex.printingagent.data.models.PairingRequest
import com.primex.printingagent.domain.DeviceManager
import timber.log.Timber
import kotlinx.coroutines.delay

class PairingRepository(
    private val apiService: PrinterApiService,
    private val deviceManager: DeviceManager
) {
    
    suspend fun requestPairingCode(
        baseUrl: String,
        printerIdentifier: String
    ): Result<String> {
        return try {
            val deviceId = deviceManager.getOrCreateDeviceId()
            
            val request = PairingRequest(
                deviceId = deviceId,
                channel = "mobile",
                printerIdentifier = printerIdentifier
            )

            val response = apiService.requestPairingCode(request)

            if (response.isSuccessful) {
                val body = response.body()
                if (body != null) {
                    Timber.d("Pairing code requested: ${body.pairingCode}")
                    Result.success(body.pairingCode)
                } else {
                    Result.failure(Exception("Empty response body"))
                }

                suspend fun waitForPairing(
                    pairingCode: String,
                    timeoutSeconds: Int = 600,
                    pollIntervalSeconds: Long = 3
                ): Result<String> {
                    return try {
                        val deviceId = deviceManager.getOrCreateDeviceId()
                        val attempts = (timeoutSeconds / pollIntervalSeconds).toInt().coerceAtLeast(1)

                        repeat(attempts) {
                            val response = apiService.getPairingStatus(
                                PairingStatusRequest(deviceId = deviceId, pairingCode = pairingCode)
                            )

                            if (!response.isSuccessful) {
                                return Result.failure(Exception("Pairing status failed: ${response.code()}"))
                            }

                            val body = response.body()
                            if (body?.apiKey != null) {
                                return Result.success(body.apiKey)
                            }
                            if (body?.status == "expired") {
                                return Result.failure(Exception("Pairing code expired"))
                            }
                            delay(pollIntervalSeconds * 1000)
                        }

                        Result.failure(Exception("Pairing timed out. Claim the code in PrimePOS and try again."))
                    } catch (e: Exception) {
                        Timber.e(e, "Error waiting for pairing")
                        Result.failure(e)
                    }
                }
            } else {
                val errorMsg = "Failed to request pairing code: ${response.code()} ${response.message()}"
                Timber.e(errorMsg)
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Timber.e(e, "Error requesting pairing code")
            Result.failure(e)
        }
    }

    suspend fun completePairing(
        baseUrl: String,
        printerIdentifier: String,
        apiKeyFromResponse: String
    ): Result<Boolean> {
        return try {
            // Save the API key
            deviceManager.saveApiKey(apiKeyFromResponse)
            deviceManager.savePrinterIdentifier(printerIdentifier)
            deviceManager.saveBaseUrl(baseUrl)
            
            Timber.d("Device pairing completed and configuration saved")
            Result.success(true)
        } catch (e: Exception) {
            Timber.e(e, "Error completing pairing")
            Result.failure(e)
        }
    }

    suspend fun registerDevice(
        deviceName: String,
        outletId: String,
        printerIdentifier: String,
        baseUrl: String
    ): Result<String> {
        return try {
            val deviceId = deviceManager.getOrCreateDeviceId()
            
            val request = com.primex.printingagent.data.models.DeviceRegistrationRequest(
                deviceId = deviceId,
                channel = "mobile",
                outletId = outletId,
                deviceName = deviceName,
                printerIdentifier = printerIdentifier,
                isActive = true
            )

            val response = apiService.registerDevice(request)

            if (response.isSuccessful) {
                val body = response.body()
                if (body != null && body.apiKey != null) {
                    Timber.d("Device registered: ${body.deviceId}")
                    deviceManager.saveApiKey(body.apiKey)
                    deviceManager.saveOutletId(outletId)
                    deviceManager.savePrinterIdentifier(printerIdentifier)
                    deviceManager.saveBaseUrl(baseUrl)
                    Result.success(body.apiKey)
                } else {
                    Result.failure(Exception("No API key in response"))
                }
            } else {
                val errorMsg = "Failed to register device: ${response.code()}"
                Timber.e(errorMsg)
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Timber.e(e, "Error registering device")
            Result.failure(e)
        }
    }
}
