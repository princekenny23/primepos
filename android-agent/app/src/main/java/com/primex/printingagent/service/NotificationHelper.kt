package com.primex.printingagent.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import com.primex.printingagent.R

object NotificationHelper {
    const val NOTIFICATION_ID = 1
    const val CHANNEL_ID = "print_service_channel"

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "PrimePOS Print Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Notifications for print job polling"
                enableLights(false)
                enableVibration(false)
            }

            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    fun buildServiceNotification(context: Context): android.app.Notification {
        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_printer)
            .setContentTitle("PrimePOS Print Agent")
            .setContentText("Listening for print jobs...")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    fun buildJobNotification(context: Context, message: String): android.app.Notification {
        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_printer)
            .setContentTitle("Print Job")
            .setContentText(message)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()
    }
}
