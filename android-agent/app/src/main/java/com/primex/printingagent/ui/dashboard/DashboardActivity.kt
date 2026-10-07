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
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.tooling.preview.Preview
import com.primex.printingagent.data.api.ApiClient
import com.primex.printingagent.domain.DeviceManager
import com.primex.printingagent.domain.PrinterManager
import com.primex.printingagent.domain.PrinterType
import com.primex.printingagent.service.PrintJobService
import com.primex.printingagent.ui.pairing.PairingActivity
import com.primex.printingagent.ui.settings.SettingsActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
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

        // Request necessary permissions for Android 14 Foreground Service if configured
        lifecycleScope.launch {
            val apiKey = deviceManager.getApiKey()
            val baseUrl = deviceManager.getBaseUrl()
            if (apiKey != null && baseUrl != null) {
                try {
                    val serviceIntent = Intent(this@DashboardActivity, PrintJobService::class.java)
                    startForegroundService(serviceIntent)
                    Timber.d("PrintJobService started from Dashboard Activity")
                } catch (e: Exception) {
                    Timber.e(e, "Failed to start service from dashboard")
                }
            }
        }

        setContent {
            // Explicitly define a light color scheme to avoid any M3 default issues
            val colorScheme = lightColorScheme(
                primary = androidx.compose.ui.graphics.Color(0xFF3F51B5),
                background = androidx.compose.ui.graphics.Color.White,
                surface = androidx.compose.ui.graphics.Color.White
            )

            MaterialTheme(colorScheme = colorScheme) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = colorScheme.background
                ) {
                    Box(modifier = Modifier.fillMaxSize()) {
                        DashboardScreen(
                            deviceManager = deviceManager,
                            printerManager = printerManager,
                            onSettingsClick = { navigateToSettings() },
                            onSetupClick = { navigateToPairing() }
                        )

                        // Debug indicator to verify rendering
                        Text(
                            text = "v1.0.1-ready",
                            modifier = Modifier.align(Alignment.BottomEnd).padding(4.dp),
                            style = MaterialTheme.typography.labelSmall,
                            color = androidx.compose.ui.graphics.Color.LightGray
                        )
                    }
                }
            }
        }
    }

    private fun navigateToSettings() {
        startActivity(Intent(this, SettingsActivity::class.java))
    }

    private fun navigateToPairing() {
        startActivity(Intent(this, PairingActivity::class.java))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    deviceManager: DeviceManager,
    printerManager: PrinterManager,
    onSettingsClick: () -> Unit,
    onSetupClick: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var deviceId by remember { mutableStateOf<String?>(null) }
    var apiKey by remember { mutableStateOf<String?>(null) }
    var baseUrl by remember { mutableStateOf<String?>(null) }
    var outletId by remember { mutableStateOf<String?>(null) }
    var printerInfo by remember { mutableStateOf<String?>(null) }
    var detectedPrinters by remember { mutableStateOf<List<PrinterType>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    val isServiceRunning by PrintJobService.isRunning.collectAsState()
    val isPolling by PrintJobService.isPolling.collectAsState()
    val lastPollTime by PrintJobService.lastPollTime.collectAsState()

    // Request permissions launcher for Android 13+ Notifications
    val permissionLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        contract = androidx.activity.result.contract.ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted && apiKey != null && baseUrl != null) {
            try {
                val serviceIntent = Intent(context, PrintJobService::class.java)
                context.startForegroundService(serviceIntent)
            } catch (e: Exception) {
                Timber.e(e, "Failed to start service after permission grant")
            }
        }
    }

    LaunchedEffect(Unit) {
        try {
            isLoading = true

            // Move DataStore configuration loading off the main thread to ensure no lockups
            withContext(Dispatchers.IO) {
                deviceId = deviceManager.getOrCreateDeviceId()
                apiKey = deviceManager.getApiKey()
                baseUrl = deviceManager.getBaseUrl()
                outletId = deviceManager.getOutletId()
            }

            // Move printer hardware discovery entirely off the main thread
            val printers = printerManager.detectAvailablePrinters()
            detectedPrinters = printers
            if (printers.isNotEmpty()) {
                printerInfo = printerManager.getPrinterDisplayName(printers.first())
            } else {
                printerInfo = "No printer detected"
            }

            // Request Notification Permission on Android 13+ if configured
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && apiKey != null && baseUrl != null) {
                permissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
            }

            Timber.d("Dashboard loaded - Device: $deviceId")
        } catch (e: Exception) {
            Timber.e(e, "Error loading dashboard")
        } finally {
            isLoading = false
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
            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize().padding(paddingValues), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    if (apiKey == null) {
                        SetupNeededCard(onSetupClick = onSetupClick)
                    }

                    // Device Status Card
                    DeviceStatusCard(
                        deviceId = deviceId,
                        isConfigured = apiKey != null && baseUrl != null,
                        isServiceRunning = isServiceRunning && isPolling
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
                        isRunning = isServiceRunning && isPolling,
                        lastPollTime = lastPollTime
                    )

                    // Action Buttons
                    ActionButtonsSection(
                        printerManager = printerManager,
                        detectedPrinters = detectedPrinters
                    )
                }
            }
        }
    }
}

@Composable
fun SetupNeededCard(onSetupClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Setup Required", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text("This device is not paired with a PrimePOS outlet.")
            Button(onClick = onSetupClick, modifier = Modifier.fillMaxWidth()) {
                Text("Start Pairing")
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
                Text(deviceId?.take(20)?.let { it + "..." } ?: "Generating...")
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

            ConfigRow("Backend URL", baseUrl?.take(30)?.let { it + "..." } ?: "Not set")
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
                Text("✗ Service not running. Pair device to start.", color = MaterialTheme.colorScheme.error)
            }
        }
    }
}

@Composable
fun ActionButtonsSection(
    printerManager: PrinterManager,
    detectedPrinters: List<PrinterType>
) {
    val scope = rememberCoroutineScope()
    var isPrintingTest by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Button(
            onClick = {
                if (detectedPrinters.isNotEmpty()) {
                    scope.launch {
                        isPrintingTest = true
                        try {
                            printerManager.testPrint(detectedPrinters.first())
                        } finally {
                            isPrintingTest = false
                        }
                    }
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
            shape = RoundedCornerShape(8.dp),
            enabled = !isPrintingTest && detectedPrinters.isNotEmpty()
        ) {
            if (isPrintingTest) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary)
            } else {
                Icon(Icons.Default.Print, contentDescription = null, modifier = Modifier.padding(end = 8.dp))
                Text("Send Test Print")
            }
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

@Preview(showBackground = true)
@Composable
fun DashboardPreview() {
    MaterialTheme {
        Surface {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                SetupNeededCard(onSetupClick = {})

                DeviceStatusCard(
                    deviceId = "ANDROID_TEST_123456",
                    isConfigured = false,
                    isServiceRunning = false
                )

                ConfigurationCard(
                    baseUrl = null,
                    outletId = null,
                    printerInfo = "No printer detected",
                    isConfigured = false
                )

                PrinterCard(printerInfo = "No printer detected")

                ServiceStatusCard(
                    isRunning = false,
                    lastPollTime = null
                )
            }
        }
    }
}
