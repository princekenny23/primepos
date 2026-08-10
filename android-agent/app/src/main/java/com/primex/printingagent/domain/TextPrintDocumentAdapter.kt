package com.primex.printingagent.domain

import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import timber.log.Timber
import java.io.FileOutputStream

class TextPrintDocumentAdapter(
    private val content: String,
    private val jobName: String
) : PrintDocumentAdapter() {

    override fun onLayout(
        oldAttributes: PrintAttributes?,
        newAttributes: PrintAttributes,
        cancellationSignal: CancellationSignal,
        callback: LayoutResultCallback,
        extras: Bundle?
    ) {
        if (cancellationSignal.isCanceled) {
            callback.onLayoutCancelled()
            return
        }

        try {
            val pdfAttributes = PrintAttributes.Builder()
                .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                .setResolution(PrintAttributes.Resolution("300dpi", "300dpi", 300, 300))
                .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                .build()

            if (oldAttributes == null || oldAttributes != newAttributes) {
                callback.onLayoutFinished(
                    PrintDocumentInfo.Builder(jobName)
                        .setPageCount(1)
                        .build(),
                    true
                )
            } else {
                callback.onLayoutFinished(
                    PrintDocumentInfo.Builder(jobName)
                        .setPageCount(1)
                        .build(),
                    false
                )
            }
        } catch (e: Exception) {
            Timber.e(e, "Error in onLayout")
            callback.onLayoutFailed(e.message)
        }
    }

    override fun onWrite(
        pages: Array<PageRange>,
        destination: ParcelFileDescriptor,
        cancellationSignal: CancellationSignal,
        callback: WriteResultCallback
    ) {
        if (cancellationSignal.isCanceled) {
            callback.onWriteCancelled()
            return
        }

        try {
            FileOutputStream(destination.fileDescriptor).use { output ->
                val bytes = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    content.toByteArray(Charsets.UTF_8)
                } else {
                    @Suppress("DEPRECATION")
                    content.toByteArray(Charsets.UTF_8)
                }
                output.write(bytes)
                output.flush()
            }

            callback.onWriteFinished(arrayOf(PageRange(0, 0)))
            Timber.d("Print document written successfully")
        } catch (e: Exception) {
            Timber.e(e, "Error in onWrite")
            callback.onWriteFailed(e.message)
        }
    }
}
