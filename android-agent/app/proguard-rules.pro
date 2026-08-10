# ProGuard configuration for PrimePOS Print Agent

# Keep all classes and methods in the app package
-keep class com.primex.printingagent.** { *; }

# Keep Android framework classes
-keepclasseswithmembernames class android.** { <fields>; <methods>; }

# Keep Retrofit interface methods and annotations
-keepattributes Signature
-keepattributes *Annotation*
-keep interface retrofit2.** { *; }
-keep class retrofit2.** { *; }
-keep class com.google.gson.** { *; }

# Keep Gson models and annotations
-keepclasseswithmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# Keep Room database classes
-keep class androidx.room.** { *; }
-keep class * extends androidx.room.RoomDatabase { *; }

# Keep DataStore classes
-keep class androidx.datastore.** { *; }

# Keep Timber logging
-keep class timber.log.** { *; }

# Keep coroutines
-keepclasseswithmembers class * {
    @kotlinx.coroutines.ObsoleteCoroutinesApi <methods>;
}

# Keep Compose
-keep class androidx.compose.** { *; }
-keep interface androidx.compose.** { *; }

# Keep Kotlin metadata
-keepattributes Signature,Exceptions,InnerClasses,EnclosingMethod,SourceFile,LineNumberTable
-keepattributes *Annotation*

# Remove logging in production
-assumenosideeffects class timber.log.Timber {
    public *** d(...);
    public *** v(...);
}

# Optimization settings
-optimizationpasses 5
-dontusemixedcaseclassnames
-verbose

# Rename attributes
-renamesourcefileattribute SourceFile
