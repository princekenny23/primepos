package com.primex.printingagent.domain

import android.annotation.SuppressLint
import android.content.Context
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import android.print.PrintAttributes
import android.print.PrintManager
import timber.log.Timber
import java.io.BufferedWriter
import java.io.File
import java.io.OutputStreamWriter
import java.util.concurrent.Executors

sealed class PrinterType {
    data class Thermal(val path: String) : PrinterType()
    data class Bluetooth(val address: String, val name: String) : PrinterType()
    data class USB(val device: UsbDevice) : PrinterType()
    object AndroidPrint : PrinterType()
}

class PrinterManager(private val context: Context) {
    private val usbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager
    private val executor = Executors.newSingleThreadExecutor()

    /**
     * Detects available printers on the device
     */
    @SuppressLint("NewApi")
    suspend fun detectAvailablePrinters(): List<PrinterType> {
        val printers = mutableListOf<PrinterType>()

        try {
            // Check for thermal printer device
            val thermalPaths = listOf(
                "/dev/lp0", "/dev/lp1",        // Linux device paths
                "/dev/ttyUSB0", "/dev/ttyUSB1", // USB serial
                "/dev/ttyS0", "/dev/ttyS1"      // Serial ports
            )

            for (path in thermalPaths) {
                if (File(path).exists()) {
                    Timber.d("Found thermal printer at: $path")
                    printers.add(PrinterType.Thermal(path))
                }
            }

            // Check USB devices
            detectUSBPrinters()?.let { usbPrinters ->
                printers.addAll(usbPrinters)
            }

            // Android Print Framework
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                printers.add(PrinterType.AndroidPrint)
            }

        } catch (e: Exception) {
            Timber.e(e, "Error detecting printers")
        }

        return printers
    }

    /**
     * Detects USB printers
     */
    private fun detectUSBPrinters(): List<PrinterType.USB>? {
        return try {
            val deviceList = usbManager.deviceList
            deviceList.values.mapNotNull { device ->
                // Check if device is a printer or thermal device
                if (isPrinterDevice(device)) {
                    Timber.d("Found USB printer: ${device.deviceName}")
                    PrinterType.USB(device)
                } else null
            }
        } catch (e: Exception) {
            Timber.e(e, "Error detecting USB printers")
            null
        }
    }

    /**
     * Checks if a USB device is a printer
     */
    private fun isPrinterDevice(device: UsbDevice): Boolean {
        return device.deviceClass == 7 || // Printer class
               device.vendorId in 0x04B8..0x04B9 || // EPSON
               device.vendorId == 0x0483 || // STMicroelectronics (thermal printers)
               device.vendorId == 0x0A81 // Zebra
    }

    /**
     * Sends ESC/POS commands to thermal printer via device file
     */
    suspend fun printToThermalPrinter(
        printerPath: String,
        contentBase64: String,
        copies: Int = 1
    ): Boolean {
        return try {
            val decodedBytes = android.util.Base64.decode(contentBase64, android.util.Base64.DEFAULT)
            
            repeat(copies) {
                File(printerPath).outputStream().use { output ->
                    output.write(decodedBytes)
                    output.flush()
                }
                Timber.d("Sent print job to $printerPath (copy ${it + 1}/$copies)")
            }
            
            true
        } catch (e: Exception) {
            Timber.e(e, "Error printing to thermal printer at $printerPath")
            false
        }
    }

    /**
     * Sends ESC/POS commands to USB printer
     */
    suspend fun printToUSBPrinter(
        device: UsbDevice,
        contentBase64: String,
        copies: Int = 1
    ): Boolean {
        return try {
            val decodedBytes = android.util.Base64.decode(contentBase64, android.util.Base64.DEFAULT)
            
            val connection = usbManager.openDevice(device) ?: run {
                Timber.e("Cannot open USB device: ${device.deviceName}")
                return false
            }

            // Find bulk-out endpoint
            val interfaceToUse = device.getInterface(0)
            val usbEpOut = (0 until interfaceToUse.endpointCount)
                .asSequence()
                .map { interfaceToUse.getEndpoint(it) }
                .filter { it.direction == 0 } // OUT direction
                .firstOrNull() ?: run {
                    connection.close()
                    Timber.e("No OUT endpoint found")
                    return false
                }

            repeat(copies) {
                val bytesSent = connection.bulkTransfer(usbEpOut, decodedBytes, decodedBytes.size, 5000)
                if (bytesSent < 0) {
                    Timber.e("USB bulk transfer failed for copy ${it + 1}")
                } else {
                    Timber.d("Sent $bytesSent bytes to USB printer (copy ${it + 1}/$copies)")
                }
            }

            connection.close()
            true
        } catch (e: Exception) {
            Timber.e(e, "Error printing to USB printer")
            false
        }
    }

    /**
     * Sends ESC/POS content using Android Print Framework
     */
    suspend fun printUsingAndroidPrintFramework(
        contentBase64: String,
        printerName: String = "PrimePOS Receipt"
    ): Boolean {
        return try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.KITKAT) {
                Timber.w("Android Print Framework requires API 19+")
                return false
            }

            val printManager = context.getSystemService(Context.PRINT_SERVICE) as PrintManager?
            if (printManager == null) {
                Timber.e("Print manager not available")
                return false
            }

            // Convert Base64 to printable text
            val decodedBytes = android.util.Base64.decode(contentBase64, android.util.Base64.DEFAULT)
            val printableContent = decodedBytes.toString(Charsets.UTF_8)

            // Create print adapter (simplified implementation)
            val printAdapter = TextPrintDocumentAdapter(printableContent, printerName)
            
            printManager.print(
                printerName,
                printAdapter,
                PrintAttributes.Builder().build()
            )

            Timber.d("Print job sent using Android Print Framework")
            true
        } catch (e: Exception) {
            Timber.e(e, "Error printing via Android Print Framework")
            false
        }
    }

    /**
     * Gets identifier for detected printer
     */
    fun getPrinterIdentifier(printer: PrinterType): String {
        return when (printer) {
            is PrinterType.Thermal -> printer.path
            is PrinterType.Bluetooth -> printer.address
            is PrinterType.USB -> "USB_${printer.device.vendorId}_${printer.device.productId}"
            PrinterType.AndroidPrint -> "android_print_framework"
        }
    }

    /**
     * Gets display name for detected printer
     */
    fun getPrinterDisplayName(printer: PrinterType): String {
        return when (printer) {
            is PrinterType.Thermal -> "Thermal Printer (${printer.path})"
            is PrinterType.Bluetooth -> "Bluetooth: ${printer.name} (${printer.address})"
            is PrinterType.USB -> "USB Printer (${printer.device.deviceName})"
            PrinterType.AndroidPrint -> "Android Print"
        }
    }

    /**
     * Sends test print to verify printer connection
     */
    suspend fun testPrint(printer: PrinterType): Boolean {
        val testContent = buildTestPrintContent()
        val base64Content = android.util.Base64.encodeToString(testContent.toByteArray(), android.util.Base64.DEFAULT)

        return when (printer) {
            is PrinterType.Thermal -> printToThermalPrinter(printer.path, base64Content, 1)
            is PrinterType.USB -> printToUSBPrinter(printer.device, base64Content, 1)
            PrinterType.AndroidPrint -> printUsingAndroidPrintFramework(base64Content)
            else -> false
        }
    }

    private fun buildTestPrintContent(): String {
        val timestamp = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.getDefault())
            .format(java.util.Date())

        return """
            ${'$'}1b${'$'}40
            PRIMEPOS TEST PRINT
            ===================
            $timestamp
            
            If you see this your
            connector is working!
            
            
            
            ${'$'}1d${'$'}56${'$'}00
        """.trimIndent()
    }
}
