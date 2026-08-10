package com.primex.printingagent.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import timber.log.Timber

class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Timber.d("Device booted, starting print service")
            
            val serviceIntent = Intent(context, com.primex.printingagent.service.PrintJobService::class.java)
            
            try {
                context.startForegroundService(serviceIntent)
            } catch (e: Exception) {
                Timber.e(e, "Failed to start print service on boot")
            }
        }
    }
}

class BluetoothStateReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            android.bluetooth.BluetoothDevice.ACTION_ACL_CONNECTED -> {
                Timber.d("Bluetooth device connected")
                // Trigger printer detection
                refreshPrinterStatus(context)
            }
            android.bluetooth.BluetoothDevice.ACTION_ACL_DISCONNECTED -> {
                Timber.d("Bluetooth device disconnected")
                // Check if it was a printer
                refreshPrinterStatus(context)
            }
        }
    }

    private fun refreshPrinterStatus(context: Context) {
        // Could notify the service or update status
        // For now, just log
        Timber.d("Printer status may have changed")
    }
}

class UsbStateReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            "android.hardware.usb.action.USB_DEVICE_ATTACHED" -> {
                Timber.d("USB device attached")
                refreshPrinterStatus(context)
            }
            "android.hardware.usb.action.USB_DEVICE_DETACHED" -> {
                Timber.d("USB device detached")
                refreshPrinterStatus(context)
            }
        }
    }

    private fun refreshPrinterStatus(context: Context) {
        Timber.d("USB printer status may have changed")
    }
}
