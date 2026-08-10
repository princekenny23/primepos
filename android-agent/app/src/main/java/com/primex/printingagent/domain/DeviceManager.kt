package com.primex.printingagent.domain

import android.content.Context
import android.os.Build
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import timber.log.Timber
import java.security.MessageDigest
import java.util.*

private val Context.dataStore by preferencesDataStore(name = "printer_prefs")

class DeviceManager(private val context: Context) {
    companion object {
        private val DEVICE_ID_KEY = stringPreferencesKey("device_id")
        private val API_KEY_KEY = stringPreferencesKey("api_key")
        private val OUTLET_ID_KEY = stringPreferencesKey("outlet_id")
        private val PRINTER_IDENTIFIER_KEY = stringPreferencesKey("printer_identifier")
        private val BASE_URL_KEY = stringPreferencesKey("base_url")
    }

    suspend fun getOrCreateDeviceId(): String {
        return try {
            val preferences = context.dataStore.data.first()
            val existing = preferences[DEVICE_ID_KEY]
            
            if (existing != null) {
                existing
            } else {
                val generated = generateDeviceId()
                context.dataStore.edit { prefs ->
                    prefs[DEVICE_ID_KEY] = generated
                }
                generated
            }
        } catch (e: Exception) {
            Timber.e(e, "Error getting device ID")
            generateDeviceId()
        }
    }

    private fun generateDeviceId(): String {
        val serial = Build.SERIAL
        val deviceName = Build.DEVICE
        val timestamp = System.currentTimeMillis()
        return "ANDROID_${deviceName}_${serial}_$timestamp".take(100)
    }

    suspend fun saveApiKey(apiKey: String) {
        try {
            context.dataStore.edit { prefs ->
                prefs[API_KEY_KEY] = apiKey
            }
            Timber.d("API key saved successfully")
        } catch (e: Exception) {
            Timber.e(e, "Error saving API key")
        }
    }

    suspend fun getApiKey(): String? {
        return try {
            val preferences = context.dataStore.data.first()
            preferences[API_KEY_KEY]
        } catch (e: Exception) {
            Timber.e(e, "Error retrieving API key")
            null
        }
    }

    suspend fun saveOutletId(outletId: String) {
        try {
            context.dataStore.edit { prefs ->
                prefs[OUTLET_ID_KEY] = outletId
            }
        } catch (e: Exception) {
            Timber.e(e, "Error saving outlet ID")
        }
    }

    suspend fun getOutletId(): String? {
        return try {
            val preferences = context.dataStore.data.first()
            preferences[OUTLET_ID_KEY]
        } catch (e: Exception) {
            Timber.e(e, "Error retrieving outlet ID")
            null
        }
    }

    suspend fun savePrinterIdentifier(identifier: String) {
        try {
            context.dataStore.edit { prefs ->
                prefs[PRINTER_IDENTIFIER_KEY] = identifier
            }
        } catch (e: Exception) {
            Timber.e(e, "Error saving printer identifier")
        }
    }

    suspend fun getPrinterIdentifier(): String? {
        return try {
            val preferences = context.dataStore.data.first()
            preferences[PRINTER_IDENTIFIER_KEY]
        } catch (e: Exception) {
            Timber.e(e, "Error retrieving printer identifier")
            null
        }
    }

    suspend fun saveBaseUrl(baseUrl: String) {
        try {
            context.dataStore.edit { prefs ->
                prefs[BASE_URL_KEY] = baseUrl
            }
        } catch (e: Exception) {
            Timber.e(e, "Error saving base URL")
        }
    }

    suspend fun getBaseUrl(): String? {
        return try {
            val preferences = context.dataStore.data.first()
            preferences[BASE_URL_KEY]
        } catch (e: Exception) {
            Timber.e(e, "Error retrieving base URL")
            null
        }
    }

    fun getAuthHeader(apiKey: String): String = "Bearer $apiKey"

    suspend fun clearAllData() {
        try {
            context.dataStore.edit { prefs ->
                prefs.clear()
            }
            Timber.d("All data cleared")
        } catch (e: Exception) {
            Timber.e(e, "Error clearing data")
        }
    }

    fun hashApiKey(rawKey: String): String {
        val md = MessageDigest.getInstance("SHA-256")
        return md.digest(rawKey.toByteArray()).joinToString("") { "%02x".format(it) }
    }
}
