package com.primex.printingagent.ui.pairing

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.primex.printingagent.data.api.ApiClient
import com.primex.printingagent.data.repository.PairingRepository
import com.primex.printingagent.domain.DeviceManager
import com.primex.printingagent.domain.PrinterManager
import com.primex.printingagent.domain.PrinterType
import kotlinx.coroutines.launch
import timber.log.Timber

class PairingActivity : ComponentActivity() {
    private lateinit var deviceManager: DeviceManager
    private lateinit var printerManager: PrinterManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        deviceManager = DeviceManager(this)
        printerManager = PrinterManager(this)

        setContent {
            PairingScreen(
                deviceManager = deviceManager,
                printerManager = printerManager,
                onPairingComplete = { 
                    startMainActivity()
                }
            )
        }
    }

    private fun startMainActivity() {
        startService(Intent(this, PrintJobService::class.java))
        Timber.d("Pairing complete, navigating to main activity")
        finish()
    }
}

@Composable
fun PairingScreen(
    deviceManager: DeviceManager,
    printerManager: PrinterManager,
    onPairingComplete: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var baseUrl by remember { mutableStateOf("") }
    var outletId by remember { mutableStateOf("") }
    var detectedPrinters by remember { mutableStateOf<List<PrinterType>>(emptyList()) }
    var selectedPrinter by remember { mutableStateOf<PrinterType?>(null) }
    var pairingCode by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var step by remember { mutableStateOf(PairingStep.CONFIG) }

    LaunchedEffect(Unit) {
        scope.launch {
            try {
                isLoading = true
                val printers = printerManager.detectAvailablePrinters()
                detectedPrinters = printers
                if (printers.isNotEmpty()) {
                    selectedPrinter = printers.first()
                }
            } catch (e: Exception) {
                errorMessage = "Failed to detect printers: ${e.message}"
                Timber.e(e, "Error detecting printers")
            } finally {
                isLoading = false
            }
        }
    }

    Scaffold { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            when (step) {
                PairingStep.CONFIG -> {
                    ConfigStep(
                        baseUrl = baseUrl,
                        outletId = outletId,
                        onBaseUrlChange = { baseUrl = it },
                        onOutletIdChange = { outletId = it },
                        onNext = {
                            if (baseUrl.isNotEmpty() && outletId.isNotEmpty()) {
                                step = PairingStep.PRINTER_SELECTION
                            } else {
                                errorMessage = "Please fill in all fields"
                            }
                        }
                    )
                }

                PairingStep.PRINTER_SELECTION -> {
                    PrinterSelectionStep(
                        printers = detectedPrinters,
                        selectedPrinter = selectedPrinter,
                        onPrinterSelected = { selectedPrinter = it },
                        onNext = {
                            if (selectedPrinter != null) {
                                step = PairingStep.REQUEST_CODE
                            }
                        }
                    )
                }

                PairingStep.REQUEST_CODE -> {
                    RequestCodeStep(
                        baseUrl = baseUrl,
                        outletId = outletId,
                        selectedPrinter = selectedPrinter!!,
                        printerManager = printerManager,
                        deviceManager = deviceManager,
                        isLoading = isLoading,
                        onCodeReceived = { code ->
                            pairingCode = code
                            step = PairingStep.ENTER_CODE
                        },
                        onError = { error ->
                            errorMessage = error
                        },
                        onLoadingChange = { isLoading = it }
                    )
                }

                PairingStep.ENTER_CODE -> {
                    EnterCodeStep(
                        baseUrl = baseUrl,
                        pairingCode = pairingCode ?: "",
                        deviceManager = deviceManager,
                        outletId = outletId,
                        printerIdentifier = printerManager.getPrinterIdentifier(selectedPrinter!!),
                        onPairingComplete = onPairingComplete,
                        onError = { errorMessage = it }
                    )
                }
            }

            if (errorMessage != null) {
                Spacer(modifier = Modifier.height(16.dp))
                ErrorMessageBox(
                    message = errorMessage!!,
                    onDismiss = { errorMessage = null }
                )
            }
        }
    }
}

@Composable
fun ConfigStep(
    baseUrl: String,
    outletId: String,
    onBaseUrlChange: (String) -> Unit,
    onOutletIdChange: (String) -> Unit,
    onNext: () -> Unit
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = "PrimePOS Print Agent Setup",
            style = MaterialTheme.typography.headlineSmall,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(24.dp))

        TextField(
            value = baseUrl,
            onValueChange = onBaseUrlChange,
            label = { Text("Backend URL") },
            placeholder = { Text("https://api.primepos.com") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )
        Spacer(modifier = Modifier.height(16.dp))

        TextField(
            value = outletId,
            onValueChange = onOutletIdChange,
            label = { Text("Outlet ID") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )
        Spacer(modifier = Modifier.height(24.dp))

        Button(onClick = onNext, modifier = Modifier.fillMaxWidth()) {
            Text("Next")
        }
    }
}

@Composable
fun PrinterSelectionStep(
    printers: List<PrinterType>,
    selectedPrinter: PrinterType?,
    onPrinterSelected: (PrinterType) -> Unit,
    onNext: () -> Unit
) {
    val printerManager = PrinterManager(androidx.compose.ui.platform.LocalContext.current)

    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = "Select Printer",
            style = MaterialTheme.typography.headlineSmall
        )
        Spacer(modifier = Modifier.height(24.dp))

        if (printers.isEmpty()) {
            Text("No printers detected", color = MaterialTheme.colorScheme.error)
        } else {
            printers.forEach { printer ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    RadioButton(
                        selected = printer == selectedPrinter,
                        onClick = { onPrinterSelected(printer) }
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(printerManager.getPrinterDisplayName(printer))
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
        Button(onClick = onNext, modifier = Modifier.fillMaxWidth()) {
            Text("Next")
        }
    }
}

@Composable
fun RequestCodeStep(
    baseUrl: String,
    outletId: String,
    selectedPrinter: PrinterType,
    printerManager: PrinterManager,
    deviceManager: DeviceManager,
    isLoading: Boolean,
    onCodeReceived: (String) -> Unit,
    onError: (String) -> Unit,
    onLoadingChange: (Boolean) -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()

    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = "Request Pairing Code",
            style = MaterialTheme.typography.headlineSmall
        )
        Spacer(modifier = Modifier.height(24.dp))

        Text("Selected Printer: ${printerManager.getPrinterDisplayName(selectedPrinter)}")
        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = {
                scope.launch {
                    onLoadingChange(true)
                    try {
                        val apiService = ApiClient.getApiService(baseUrl, context)
                        val repository = PairingRepository(apiService, deviceManager)
                        val result = repository.requestPairingCode(
                            baseUrl,
                            printerManager.getPrinterIdentifier(selectedPrinter)
                        )
                        result.onSuccess { code ->
                            onCodeReceived(code)
                        }
                        result.onFailure { error ->
                            onError(error.message ?: "Unknown error")
                        }
                    } finally {
                        onLoadingChange(false)
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = !isLoading
        ) {
            if (isLoading) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp))
            } else {
                Text("Request Code")
            }
        }
    }
}

@Composable
fun EnterCodeStep(
    baseUrl: String,
    pairingCode: String,
    deviceManager: DeviceManager,
    outletId: String,
    printerIdentifier: String,
    onPairingComplete: () -> Unit,
    onError: (String) -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    var isWaiting by remember { mutableStateOf(true) }

    LaunchedEffect(pairingCode) {
        if (pairingCode.isBlank()) return@LaunchedEffect
        scope.launch {
            val apiService = ApiClient.getApiService(baseUrl, context)
            val result = PairingRepository(apiService, deviceManager).waitForPairing(pairingCode)
            result.onSuccess { apiKey ->
                deviceManager.saveApiKey(apiKey)
                deviceManager.saveBaseUrl(baseUrl)
                deviceManager.saveOutletId(outletId)
                deviceManager.savePrinterIdentifier(printerIdentifier)
                isWaiting = false
                onPairingComplete()
            }.onFailure { error ->
                isWaiting = false
                onError(error.message ?: "Pairing failed")
            }
        }
    }

    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = "Pairing Code",
            style = MaterialTheme.typography.headlineSmall
        )
        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = pairingCode,
            style = MaterialTheme.typography.displayMedium,
            modifier = Modifier.padding(16.dp)
        )

        Spacer(modifier = Modifier.height(24.dp))
        Text(
            text = "Enter this code in the PrimePOS system to complete pairing",
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(24.dp))

        if (isWaiting) {
            CircularProgressIndicator()
            Text("Waiting for PrimePOS to approve this device")
        } else {
            Button(onClick = onPairingComplete, modifier = Modifier.fillMaxWidth()) {
                Text("Continue")
            }
        }
    }
}

@Composable
fun ErrorMessageBox(message: String, onDismiss: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(message, modifier = Modifier.weight(1f))
            Button(onClick = onDismiss) {
                Text("Dismiss")
            }
        }
    }
}

enum class PairingStep {
    CONFIG,
    PRINTER_SELECTION,
    REQUEST_CODE,
    ENTER_CODE
}
