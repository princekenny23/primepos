package com.primex.printingagent

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.primex.printingagent.domain.DeviceManager
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DeviceManagerTest {
    
    private lateinit var context: Context
    private lateinit var deviceManager: DeviceManager
    
    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        deviceManager = DeviceManager(context)
    }
    
    @Test
    fun testGetOrCreateDeviceId() = runTest {
        // First call should generate ID
        val deviceId1 = deviceManager.getOrCreateDeviceId()
        assertNotNull(deviceId1)
        assertTrue(deviceId1.contains("ANDROID"))
        
        // Second call should return same ID
        val deviceId2 = deviceManager.getOrCreateDeviceId()
        assertEquals(deviceId1, deviceId2)
    }
    
    @Test
    fun testApiKeyStorage() = runTest {
        val testKey = "test_api_key_12345"
        
        // Initially null
        var savedKey = deviceManager.getApiKey()
        assertNull(savedKey)
        
        // Save key
        deviceManager.saveApiKey(testKey)
        
        // Should be retrievable
        savedKey = deviceManager.getApiKey()
        assertEquals(testKey, savedKey)
    }
    
    @Test
    fun testOutletIdStorage() = runTest {
        val testOutletId = "outlet_123"
        
        // Initially null
        var outletId = deviceManager.getOutletId()
        assertNull(outletId)
        
        // Save outlet ID
        deviceManager.saveOutletId(testOutletId)
        
        // Should be retrievable
        outletId = deviceManager.getOutletId()
        assertEquals(testOutletId, outletId)
    }
    
    @Test
    fun testAuthHeaderGeneration() {
        val apiKey = "my_secret_key"
        val header = deviceManager.getAuthHeader(apiKey)
        
        assertTrue(header.startsWith("Bearer "))
        assertTrue(header.contains(apiKey))
    }
    
    @Test
    fun testApiKeyHashing() {
        val rawKey = "raw_password_123"
        val hash1 = deviceManager.hashApiKey(rawKey)
        val hash2 = deviceManager.hashApiKey(rawKey)
        
        // Same input should produce same hash
        assertEquals(hash1, hash2)
        
        // Different input should produce different hash
        val hash3 = deviceManager.hashApiKey("different_password")
        assertNotEquals(hash1, hash3)
    }
    
    @Test
    fun testClearAllData() = runTest {
        val testKey = "test_key"
        val testOutlet = "test_outlet"
        
        // Save some data
        deviceManager.saveApiKey(testKey)
        deviceManager.saveOutletId(testOutlet)
        
        // Verify data exists
        assertEquals(testKey, deviceManager.getApiKey())
        assertEquals(testOutlet, deviceManager.getOutletId())
        
        // Clear all
        deviceManager.clearAllData()
        
        // Verify data is cleared
        assertNull(deviceManager.getApiKey())
        assertNull(deviceManager.getOutletId())
    }
}
