# Android Print Agent - Complete Deployment Guide

## Overview

This guide covers the complete implementation of the Android print agent, including all core features, database setup, testing, and production deployment.

## What's Implemented

### ✅ Core Features
- Multi-printer support (Thermal, USB, Android Print)
- Device pairing with 6-digit codes
- Print job polling service (5-second intervals)
- Secure API key storage (DataStore encryption)
- Foreground service with auto-restart
- Bluetooth/USB hotplug detection
- ESC/POS command support

### ✅ UI Components
- **PairingActivity**: Multi-step setup wizard
- **DashboardActivity**: Device status and monitoring
- **SettingsActivity**: Configuration management
- Material 3 design with Compose
- Real-time status indicators

### ✅ Database (Room)
- **OfflinePrintJob**: Local print queue
- **SyncQueueItem**: Pending backend sync operations
- Automatic cleanup and archival
- Offline capability foundation

### ✅ Testing
- Unit tests for DeviceManager
- Database DAO tests ready
- Integration test examples
- Instrumentation test setup

### ✅ Production Readiness
- ProGuard obfuscation for release builds
- Structured logging with Timber
- Security best practices
- Error handling and retry logic
- Complete documentation

## Build Instructions

### Prerequisites
```bash
# Install required tools
- Android Studio (latest)
- Android SDK 34 (compileSdk)
- Kotlin 1.9.20+
- JDK 11+
```

### Debug Build
```bash
cd android-agent/

# Build debug APK
./gradlew clean assembleDebug

# Output: app/build/outputs/apk/debug/app-debug.apk

# Install on device
adb install app/build/outputs/apk/debug/app-debug.apk

# Run tests
./gradlew connectedAndroidTest
```

### Release Build
```bash
# Build release APK
./gradlew clean assembleRelease

# Output: app/build/outputs/apk/release/app-release.apk

# Build for Google Play (optional)
./gradlew bundleRelease
# Output: app/build/outputs/bundle/release/app-release.aab
```

## Testing

### Run Unit Tests
```bash
./gradlew test
```

### Run Instrumentation Tests
```bash
./gradlew connectedAndroidTest
```

### Test Device Pairing Flow
1. Run app on device: `./gradlew installDebug`
2. Launch PairingActivity
3. Enter backend URL: `https://api.primepos.com`
4. Enter outlet ID: `outlet_123`
5. Select detected printer
6. Request pairing code
7. Verify 6-digit code displayed

### Test Print Job Flow
1. Verify device is registered in backend
2. Create print job from frontend: `POST /api/print-jobs/`
3. Monitor device logs: `adb logcat PrintJobService -v threadtime`
4. Verify receipt printed on device

## Database Schema

### OfflinePrintJob Table
```sql
CREATE TABLE offline_print_jobs (
    localId INTEGER PRIMARY KEY,
    remote_id TEXT,
    device_id TEXT NOT NULL,
    printer_type TEXT,
    content_base64 TEXT,
    receipt_number TEXT,
    copies INTEGER,
    status TEXT,
    attempts INTEGER,
    max_attempts INTEGER,
    created_at INTEGER,
    updated_at INTEGER,
    error_message TEXT
);

CREATE INDEX idx_status_created ON offline_print_jobs(status, created_at);
CREATE INDEX idx_device_id ON offline_print_jobs(device_id);
```

### SyncQueueItem Table
```sql
CREATE TABLE sync_queue (
    id INTEGER PRIMARY KEY,
    print_job_id INTEGER,
    operation TEXT,
    status TEXT,
    attempts INTEGER,
    max_attempts INTEGER,
    payload TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    error_message TEXT
);

CREATE INDEX idx_status_created_sync ON sync_queue(status, created_at);
```

## API Integration

### Device Registration Endpoint
```bash
POST /api/devices/register-device/
Content-Type: application/json

{
  "device_id": "ANDROID_...",
  "channel": "mobile",
  "outlet_id": "outlet_123",
  "device_name": "Android POS",
  "printer_identifier": "/dev/lp0",
  "is_active": true
}

Response:
{
  "registered": true,
  "created": true,
  "device_id": "ANDROID_...",
  "api_key": "generated_key_...",
  "device": { ... }
}
```

### Print Job Claiming
```bash
POST /api/print-jobs/claim-next/
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "channel": "mobile",
  "device_id": "ANDROID_...",
  "printer_type": "receipt"
}

Response (200):
{
  "id": "job_id",
  "device_id": "ANDROID_...",
  "status": "claimed",
  "payload": {
    "content_base64": "...",
    "copies": 1
  },
  ...
}

Response (204): No pending jobs
```

## Logging & Debugging

### Enable Verbose Logging
```bash
adb shell setprop log.tag.PrintJobService VERBOSE
adb shell setprop log.tag.PrinterManager VERBOSE
adb shell setprop log.tag.DeviceManager VERBOSE

# View logs
adb logcat -v threadtime | grep -E "PrintJobService|PrinterManager|DeviceManager"
```

### Check Device Registration
```bash
# View stored preferences
adb shell run-as com.primex.printingagent cat data/data/com.primex.printingagent/files/datastore/printer_prefs.preferences_pb

# List database files
adb shell ls -la data/data/com.primex.printingagent/databases/
```

### Monitor Print Queue
```bash
# Open Android Studio Database Inspector
- Run > Debug App
- View > Tool Windows > Device File Explorer
- Navigate to: /data/data/com.primex.printingagent/databases/
- Open primepos_printer.db in Database Inspector
```

## Deployment to Devices

### All-in-One POS Devices

#### Option A: Direct Installation (Development)
```bash
adb install app-release.apk
adb shell am start -n com.primex.printingagent/.ui.pairing.PairingActivity
```

#### Option B: OEM Pre-installation
1. Provide APK to device manufacturer
2. Request installation as system app
3. Include permissions whitelist
4. Test on reference device

#### Option C: MDM/EMM Platform
1. Build signed APK or AAB
2. Upload to MDM platform (Intune, MobileIron, etc.)
3. Configure auto-install for target devices
4. Set permission policies

### Permissions Configuration
```bash
# Grant at installation time
adb shell pm grant com.primex.printingagent android.permission.INTERNET
adb shell pm grant com.primex.printingagent android.permission.BLUETOOTH
adb shell pm grant com.primex.printingagent android.permission.BLUETOOTH_ADMIN
adb shell pm grant com.primex.printingagent android.permission.FOREGROUND_SERVICE
adb shell pm grant com.primex.printingagent android.permission.POST_NOTIFICATIONS
```

## Monitoring in Production

### Backend API Metrics
```sql
-- Active devices
SELECT 
    device_id, 
    last_seen_at,
    status
FROM sales_printdevice
WHERE channel = 'mobile' AND last_seen_at > NOW() - INTERVAL '1 hour'
ORDER BY last_seen_at DESC;

-- Recent print jobs
SELECT 
    id,
    device_id,
    status,
    attempts,
    created_at,
    completed_at
FROM sales_printjob
WHERE channel = 'mobile' AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Success rate
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success,
    ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM sales_printjob
WHERE channel = 'mobile' AND created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## Troubleshooting

### Issue: App Won't Start
**Symptom**: App crashes immediately after installation

**Solution**:
```bash
# Check logs
adb logcat -v threadtime | grep AndroidRuntime

# Common causes:
# 1. Missing runtime permissions
adb shell pm list permissions -g | grep com.primex

# 2. Corrupt database
adb shell rm /data/data/com.primex.printingagent/databases/*

# 3. Device not compatible
adb shell getprop ro.build.version.sdk  # Should be >= 24
```

### Issue: Service Keeps Stopping
**Symptom**: Service stops after ~5 minutes

**Solution**:
```bash
# Check battery optimization
adb shell dumpsys deviceidle | grep com.primex

# Disable for app (requires device owner or user action)
adb shell cmd battery unplug
adb shell cmd power set-stay-on true
```

### Issue: Print Jobs Not Claimed
**Symptom**: App runs but no jobs are processed

**Solution**:
```bash
# 1. Verify API key
adb shell run-as com.primex.printingagent cat data/data/com.primex.printingagent/shared_prefs/app_preferences.xml | grep api_key

# 2. Test backend connectivity
adb shell curl -H "Authorization: Bearer {api_key}" https://api.primepos.com/api/print-jobs/claim-next/

# 3. Check device registration
SELECT * FROM sales_printdevice WHERE device_id LIKE 'ANDROID_%' ORDER BY last_seen_at DESC LIMIT 5;
```

## Performance Tuning

### Reduce Battery Consumption
```kotlin
// In PrintJobService.kt, increase poll interval
private const val POLL_INTERVAL_SECONDS = 10L  // Was 5L

// Or make configurable
val pollInterval = deviceManager.getPollInterval() ?: 5L
```

### Optimize Network Usage
```kotlin
// Use OkHttp connection pooling
val httpClient = OkHttpClient.Builder()
    .connectionPool(ConnectionPool(5, 2, TimeUnit.MINUTES))
    .build()
```

### Database Optimization
```bash
# Manually trigger cleanup
./gradlew shell

> from android_agent.data.repository import OfflineSyncRepository
> repo.cleanupOldJobs(olderThanDays=7)
```

## Maintenance Tasks

### Weekly
- Monitor device heartbeats
- Check print job success rate
- Review error logs

### Monthly
- Clean up old print jobs (>30 days)
- Verify database size
- Test printer connectivity

### Quarterly
- Run security audit
- Update dependencies
- Performance profiling

## Support & Escalation

### Device Issues
1. Check connectivity: `adb shell ping api.primepos.com`
2. Verify printer: `adb shell ls -la /dev/lp0`
3. Review logs: `adb logcat | grep ERROR`
4. Escalate to device OEM if hardware issue

### API Issues
1. Check backend health: `GET /api/health/`
2. Verify device registration
3. Test with cURL
4. Escalate to backend team

### Persistent Issues
- Enable debug logging
- Capture full logcat dump
- Export database
- Create support ticket with attached files

## Deployment Checklist

- [ ] Code reviewed and tested
- [ ] All tests passing (unit + integration)
- [ ] ProGuard configuration validated
- [ ] APK signed with production key
- [ ] Version number bumped
- [ ] Documentation updated
- [ ] Backend API verified
- [ ] Database migrations completed
- [ ] Monitoring dashboards ready
- [ ] Support runbook prepared
- [ ] Rollback plan documented
- [ ] Deployment approved

## Success Metrics

- Device online rate: > 95%
- Print job success rate: > 98%
- Average job processing time: < 2 seconds
- Service uptime: > 99.5%
- Memory usage: < 150 MB
- Battery impact: < 5% per day

## Next Steps

1. **Immediate**: Build and test on reference device
2. **Week 1**: Deploy to 5% of outlets
3. **Week 2**: Monitor metrics, gather feedback
4. **Week 3**: Deploy to 25% of outlets
5. **Week 4**: Full rollout

---

Maintained by: PrimePOS Development Team
Last Updated: 2026-07-23
