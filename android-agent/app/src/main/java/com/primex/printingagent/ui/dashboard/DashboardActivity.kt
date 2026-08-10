package com.primex.printingagent.ui.dashboard

import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
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
import com.primex.printingagent.data.api.ApiClient
import com.primex.printingagent.domain.DeviceManager
import com.primex.printingagent.domain.PrinterManager
import com.primex.printingagent.service.PrintJobService
import kotlinx.coroutines.launch
import timber.log.Timber
import java.text.SimpleDateFormat
import java.util.*

class DashboardActivity : ComponentActivity() {
    private lateinit var deviceManager: DeviceManager
    private lateinit var printerManager: PrinterManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        deviceManager = DeviceManager(this)
        printerManager = PrinterManager(this)

        setContent {
            DashboardScreen(
                deviceManager = deviceManager,
                printerManager = printerManager,
                onSettingsClick = { navigateToSettings() }
            )
        }
    }

    private fun navigateToSettings() {
        startActivity(Intent(this, SettingsActivity::class.java))
    }
}

@Composable
fun DashboardScreen(
    deviceManager: DeviceManager,
    printerManager: PrinterManager,
    onSettingsClick: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var deviceId by remember { mutableStateOf<String?>(null) }
    var apiKey by remember { mutableStateOf<String?>(null) }
    var baseUrl by remember { mutableStateOf<String?>(null) }
    var outletId by remember { mutableStateOf<String?>(null) }
    var printerInfo by remember { mutableStateOf<String?>(null) }
    var isServiceRunning by remember { mutableStateOf(false) }
    var lastPollTime by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        scope.launch {
            try {
                deviceId = deviceManager.getOrCreateDeviceId()
                apiKey = deviceManager.getApiKey()
                baseUrl = deviceManager.getBaseUrl()
                outletId = deviceManager.getOutletId()
                
                // Detect printer
                val printers = printerManager.detectAvailablePrinters()
                if (printers.isNotEmpty()) {
                    printerInfo = printerManager.getPrinterDisplayName(printers.first())
                } else {
                    printerInfo = "No printer detected"
                }
                
                Timber.d("Dashboard loaded - Device: $deviceId")
            } catch (e: Exception) {
                Timber.e(e, "Error loading dashboard")
            }
        }
    }

    MaterialTheme {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text("PrimePOS Print Agent") },
                    actions = {
                        IconButton(onClick = onSettingsClick) {
                            Icon(Icons.Default.Settings, contentDescription = "Settings")
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
                // Device Status Card
                DeviceStatusCard(
                    deviceId = deviceId,
                    isConfigured = apiKey != null && baseUrl != null,
                    isServiceRunning = isServiceRunning
                )

                // Configuration Card
                ConfigurationCard(
                    baseUrl = baseUrl,
                    outletId = outletId,
                    printerInfo = printerInfo,
                    isConfigured = apiKey != null
                )

                // Printer Card
                PrinterCard(printerInfo = printerInfo)

                // Service Status Card
                ServiceStatusCard(
                    isRunning = isServiceRunning,
                    lastPollTime = lastPollTime
                )

                // Action Buttons
                ActionButtonsSection()
            }
        }
    }
}

@Composable
fun DeviceStatusCard(
    deviceId: String?,
    isConfigured: Boolean,
    isServiceRunning: Boolean
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isConfigured) MaterialTheme.colorScheme.surfaceVariant 
                           else MaterialTheme.colorScheme.errorContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Device Status",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                
                StatusBadge(
                    status = if (isConfigured) "Configured" else "Not Configured",
                    color = if (isConfigured) MaterialTheme.colorScheme.onSurfaceVariant 
                           else MaterialTheme.colorScheme.onErrorContainer
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Device ID:", fontWeight = FontWeight.SemiBold)
                Text(deviceId?.take(20) + "..." ?: "Generating...")
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Service:", fontWeight = FontWeight.SemiBold)
                StatusBadge(
                    status = if (isServiceRunning) "Running" else "Stopped",
                    color = if (isServiceRunning) MaterialTheme.colorScheme.primary 
                           else MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

@Composable
fun ConfigurationCard(
    baseUrl: String?,
    outletId: String?,
    printerInfo: String?,
    isConfigured: Boolean
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Configuration",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            ConfigRow("Backend URL", baseUrl?.take(30) + "..." ?: "Not set")
            ConfigRow("Outlet ID", outletId ?: "Not set")
            ConfigRow("Status", if (isConfigured) "✓ Ready" else "✗ Not Ready")
        }
    }
}

@Composable
fun PrinterCard(printerInfo: String?) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Printer",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Icon(Icons.Default.Print, contentDescription = "Printer", tint = MaterialTheme.colorScheme.primary)
            }
            
            Text(printerInfo ?: "Detecting...", style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
fun ServiceStatusCard(
    isRunning: Boolean,
    lastPollTime: String?
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isRunning) MaterialTheme.colorScheme.primaryContainer 
                           else MaterialTheme.colorScheme.errorContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Print Service",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = if (isRunning) MaterialTheme.colorScheme.primary 
                           else MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(16.dp)
                ) {}
            }

            if (isRunning) {
                Text("✓ Listening for print jobs (5s poll interval)")
                if (lastPollTime != null) {
                    Text("Last poll: $lastPollTime", style = MaterialTheme.typography.bodySmall)
                }
            } else {
                Text("✗ Service not running. Tap Settings to configure.", color = MaterialTheme.colorScheme.error)
            }
        }
    }
}

@Composable
fun ActionButtonsSection() {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Button(
            onClick = { /* TODO: Send test print */ },
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
            shape = RoundedCornerShape(8.dp)
        ) {
            Icon(Icons.Default.Print, contentDescription = null, modifier = Modifier.padding(end = 8.dp))
            Text("Send Test Print")
        }

        Button(
            onClick = { /* TODO: View recent jobs */ },
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
            shape = RoundedCornerShape(8.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.secondary
            )
        ) {
            Icon(Icons.Default.Info, contentDescription = null, modifier = Modifier.padding(end = 8.dp))
            Text("Recent Jobs")
        }
    }
}

@Composable
fun StatusBadge(status: String, color: androidx.compose.ui.graphics.Color) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = color.copy(alpha = 0.2f)
    ) {
        Text(
            status,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            color = color,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
fun ConfigRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
        Text(value, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f, false), textAlign = androidx.compose.ui.text.style.TextAlign.End)
    }
}
