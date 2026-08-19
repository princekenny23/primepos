package com.primex.printingagent.data.api

import android.content.Context
import com.primex.printingagent.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import timber.log.Timber
import java.util.concurrent.TimeUnit

object ApiClient {
    private var instance: Retrofit? = null
    private var apiService: PrinterApiService? = null
    private var configuredBaseUrl: String? = null

    fun getInstance(baseUrl: String, context: Context): Retrofit {
        val normalizedBaseUrl = baseUrl.trim().let { if (it.endsWith("/")) it else "$it/" }
        if (configuredBaseUrl != normalizedBaseUrl) {
            reset()
        }

        return instance ?: run {
            val logging = HttpLoggingInterceptor { message ->
                Timber.tag("OkHttp").d(message)
            }.apply {
                level = if (BuildConfig.DEBUG) {
                    HttpLoggingInterceptor.Level.BODY
                } else {
                    HttpLoggingInterceptor.Level.BASIC
                }
            }

            val httpClient = OkHttpClient.Builder()
                .addInterceptor(logging)
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .retryOnConnectionFailure(true)
                .build()

            Retrofit.Builder()
                .baseUrl(normalizedBaseUrl)
                .client(httpClient)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .also {
                    instance = it
                    configuredBaseUrl = normalizedBaseUrl
                }
        }
    }

    fun getApiService(baseUrl: String, context: Context): PrinterApiService {
        return apiService ?: getInstance(baseUrl, context).create(PrinterApiService::class.java)
            .also { apiService = it }
    }

    fun reset() {
        instance = null
        apiService = null
        configuredBaseUrl = null
    }
}
