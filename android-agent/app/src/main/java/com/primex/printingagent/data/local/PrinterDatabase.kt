package com.primex.printingagent.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [OfflinePrintJob::class, SyncQueueItem::class],
    version = 1,
    exportSchema = true
)
abstract class PrinterDatabase : RoomDatabase() {
    
    abstract fun offlinePrintJobDao(): OfflinePrintJobDao
    abstract fun syncQueueDao(): SyncQueueDao
    
    companion object {
        @Volatile
        private var INSTANCE: PrinterDatabase? = null
        
        fun getInstance(context: Context): PrinterDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    PrinterDatabase::class.java,
                    "primepos_printer.db"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
        
        fun destroyInstance() {
            INSTANCE = null
        }
    }
}
