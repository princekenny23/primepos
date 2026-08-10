package com.primex.printingagent

import android.app.Application
import android.content.Intent
import androidx.work.Configuration
import com.primex.printingagent.service.NotificationHelper
import com.primex.printingagent.service.PrintJobService
import timber.log.Timber

class PrintingAgentApplication : Application(), Configuration.Provider {

    override fun onCreate() {
        super.onCreate()

        // Initialize Timber for logging
        if (BuildConfig.DEBUG) {
            Timber.plant(Timber.DebugTree())
        } else {
            Timber.plant(CrashReportingTree())
        }

        Timber.d("PrimePOS Printing Agent Application initialized")

        // Create notification channels
        NotificationHelper.createNotificationChannel(this)

        // Start the print job service
        startPrintJobService()
    }

    private fun startPrintJobService() {
        try {
            val serviceIntent = Intent(this, PrintJobService::class.java)
            startForegroundService(serviceIntent)
            Timber.d("Print job service started")
        } catch (e: Exception) {
            Timber.e(e, "Failed to start print job service")
        }
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setMinimumLoggingLevel(android.util.Log.DEBUG)
            .build()

    private class CrashReportingTree : Timber.Tree() {
        override fun log(
            priority: Int,
            tag: String?,
            message: String,
            t: Throwable?
        ) {
            if (priority == android.util.Log.ERROR || priority == android.util.Log.WARN) {
                // TODO: Send to crash reporting service (Firebase, Sentry, etc.)
                android.util.Log.println(priority, tag, message)
            }
        }
    }
}
