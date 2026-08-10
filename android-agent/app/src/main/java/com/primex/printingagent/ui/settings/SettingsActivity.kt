package com.primex.printingagent.ui.settings

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.primex.printingagent.domain.DeviceManager
import kotlinx.coroutines.launch
import timber.log.Timber

class SettingsActivity : ComponentActivity() {
    private lateinit var deviceManager: DeviceManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        deviceManager = DeviceManager(this)

        setContent {
            SettingsScreen(
                deviceManager = deviceManager,
                onBack = { finish() }
            )
        }
    }
}

@Composable
fun SettingsScreen(
    deviceManager: DeviceManager,
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var apiKey by remember { mutableStateOf<String?>(null) }
    var baseUrl by remember { mutableStateOf<String?>(null) }
    var outletId by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        scope.launch {
            try {
                apiKey = deviceManager.getApiKey()
                baseUrl = deviceManager.getBaseUrl()
                outletId = deviceManager.getOutletId()
            } catch (e: Exception) {
                Timber.e(e, "Error loading settings")
            }
        }
    }

    MaterialTheme {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text("Settings") },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                        }
                    }
                )
            }
        ) { paddingValues ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = "Device Configuration",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )

                SettingItem(label = "API Key", value = apiKey?.take(20) + "..." ?: "Not configured")
                SettingItem(label = "Backend URL", value = baseUrl ?: "Not configured")
                SettingItem(label = "Outlet ID", value = outletId ?: "Not configured")

                Divider(modifier = Modifier.padding(vertical = 8.dp))

                Text(
                    text = "Actions",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )

                Button(
                    onClick = { 
                        scope.launch {
                            deviceManager.clearAllData()
                            Timber.d("Device data cleared")
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Icon(Icons.Default.Delete, contentDescription = null, modifier = Modifier.padding(end = 8.dp))
                    Text("Clear Configuration")
                }

                Divider(modifier = Modifier.padding(vertical = 8.dp))

                Text(
                    text = "About",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )

                SettingItem(label = "Version", value = "1.0.0")
                SettingItem(label = "App Name", value = "PrimePOS Print Agent")
            }
        }
    }
}

@Composable
fun SettingItem(label: String, value: String) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                label,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                value,
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}
