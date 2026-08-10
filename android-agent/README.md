# PrimePOS Android Print Agent

Production-grade Android local print agent for PrimePOS system. This agent polls the PrimePOS backend for print jobs and sends them to available printers on all-in-one Android POS devices.

## Architecture Overview

### Components

1. **PrintJobService** - Foreground service polling backend every 5 seconds
   - Runs continuously in background
   - Detects and selects printer on startup
   - Handles job claiming and execution
   - Reports completion/failure to backend

2. **PrinterManager** - Abstraction layer for multiple printer types
   - Internal thermal printers (`/dev/lp0`, `/dev/ttyUSB0`)
   - USB printers (via Android USB Host API)
   - Android Print Framework fallback
   - ESC/POS command execution

3. **DeviceManager** - Secure device configuration storage
   - Uses DataStore (encrypted preferences)
   - Manages API keys, device ID, outlet ID
   - Handles device initialization

4. **API Client** - Retrofit-based HTTP communication
   - Automatic retry on network failures
   - Bearer token authentication
   - Timeout handling (30 seconds)

5. **PairingActivity** - Multi-step pairing UI
   - Backend URL configuration
   - Printer detection and selection
   - Pairing code exchange

### Foreground Service

The `PrintJobService` runs as an Android foreground service with:
- Persistent notification (low priority, non-intrusive)
- Auto-restart on app termination
- Boot completion receiver for auto-startup
- Bluetooth/USB hotplug detection

## API Integration

### Print Job Flow

```
Backend /api/print-jobs/claim-next/ 
    ↓
Android agent claims job
    ↓
Extract Base64 content (ESC/POS)
    ↓
Send to detected printer
    ↓
Backend /api/print-jobs/{id}/complete/
```

### Authentication

Uses Bearer token authentication:
```
Authorization: Bearer {api_key}
```

API keys are:
- Generated on device registration
- Stored securely in DataStore
- Persisted across app restarts

### Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/devices/pairing/request/` | Request 6-digit pairing code |
| POST | `/api/devices/register-device/` | Register device with outlet |
| POST | `/api/print-jobs/claim-next/` | Claim next pending job |
| POST | `/api/print-jobs/{id}/complete/` | Report job completion |

## Printer Support

### 1. Internal Thermal Printers

Detected at standard Linux device paths:
- `/dev/lp0`, `/dev/lp1` - Line printer devices
- `/dev/ttyUSB0`, `/dev/ttyUSB1` - USB serial
- `/dev/ttyS0`, `/dev/ttyS1` - Serial ports

**Implementation**: Direct file I/O with Base64-decoded ESC/POS bytes.

### 2. USB Printers

Detected via Android USB Host API:
- Vendor ID filtering (EPSON, Zebra, STMicroelectronics)
- Generic printer class detection
- Automatic permission handling

**Implementation**: USB bulk transfer to OUT endpoint.

### 3. Android Print Framework

Fallback for devices without direct printer access:
- Uses system print dialog
- Suitable for Bluetooth/Network printers
- Less suitable for POS workflows (user interaction required)

## Device Pairing

### Pairing Flow

1. **User enters configuration**
   - Backend URL (e.g., https://api.primepos.com)
   - Outlet ID

2. **Printer selection**
   - App auto-detects available printers
   - User selects one

3. **Request pairing code**
   - App calls `/api/devices/pairing/request/`
   - Backend generates 6-digit code (10-minute expiry)

4. **Complete in backend**
   - User enters code in PrimePOS system
   - Backend issues API key
   - Device receives key via polling or webhook

5. **Auto-start**
   - App launches PrintJobService on next startup
   - Service uses stored API key for authentication

## Offline Support

The agent handles offline scenarios:

- **Network unavailable**: Local queue in App-specific directory
- **Retry strategy**: Exponential backoff (5s → 10s → 20s → max 2min)
- **Job persistence**: Jobs remain queued until success or max attempts
- **Status display**: App shows queue status to user

## Configuration

### Build Configuration

Edit `app/build.gradle.kts`:
- `compileSdk = 34` - Target latest Android
- `minSdk = 24` - Minimum API level (Android 7.0)
- `targetSdk = 34` - Current production target

### Permissions

**Required (AndroidManifest.xml)**:
- `INTERNET` - API communication
- `BLUETOOTH` + `BLUETOOTH_ADMIN` - Bluetooth printer detection
- `USB_PERMISSION` - USB printer access
- `FOREGROUND_SERVICE` - Background service
- `POST_NOTIFICATIONS` - Notification display (Android 13+)

**Optional**:
- `BLUETOOTH_SCAN` + `BLUETOOTH_CONNECT` (Android 12+)
- `MANAGE_ACCOUNTS` - Device admin features

### Logging

Uses Timber for structured logging:

```kotlin
Timber.d("Debug message")
Timber.e(exception, "Error occurred")
Timber.w("Warning message")
```

Debug builds log full HTTP bodies; release builds only log headers.

## Deployment

### Build APK

```bash
./gradlew build
# Output: app/build/outputs/apk/release/app-release.apk
```

### Install on Device

```bash
adb install app-release.apk
```

### Auto-start After Boot

The app declares:
- `BootCompletedReceiver` - Launches service on device boot
- `StartupActivity` - Auto-starts on first launch

### System Integration

For embedded POS devices:
1. Pre-install APK using device manufacturer tools
2. Grant required permissions via adb shell or system settings
3. Set as device owner for enhanced control

## Troubleshooting

### No Printers Detected

Check logs:
```bash
adb logcat | grep -i "PrinterManager"
```

1. Verify printer is connected and powered on
2. Check USB permissions: Settings → Apps → PrimePOS → Permissions
3. Test with: `adb shell cat /dev/lp0` (should work if accessible)

### Print Jobs Not Claimed

1. Verify API key is saved: Check DataStore in app data
2. Test API connectivity: Check logs for HTTP response codes
3. Verify outlet ID is correct

### Service Keeps Stopping

1. Check for crashes: `adb logcat | grep "PrintJobService"`
2. Ensure FOREGROUND_SERVICE permission is granted
3. Verify device has not disabled background services in battery settings

## Development

### Project Structure

```
android-agent/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/primex/printingagent/
│   │   │   │   ├── data/
│   │   │   │   │   ├── api/        # Retrofit interfaces & HTTP client
│   │   │   │   │   ├── models/     # Data classes (PrintJob, Device, etc)
│   │   │   │   │   └── repository/ # Data access layer
│   │   │   │   ├── domain/         # Business logic (PrinterManager, DeviceManager)
│   │   │   │   ├── service/        # PrintJobService (foreground)
│   │   │   │   ├── ui/             # UI components (PairingActivity)
│   │   │   │   ├── receiver/       # Broadcast receivers (Boot, USB, Bluetooth)
│   │   │   │   └── PrintingAgentApplication.kt
│   │   │   ├── res/
│   │   │   │   ├── values/         # Strings, colors, styles
│   │   │   │   ├── xml/            # Manifest configs
│   │   │   │   └── drawable/       # Icons, images
│   │   │   └── AndroidManifest.xml
│   │   └── test/ & androidTest/
│   └── build.gradle.kts
├── build.gradle.kts
└── settings.gradle.kts
```

### Key Dependencies

- **Retrofit 2.10.0** - HTTP client framework
- **OkHttp 4.11.0** - Networking with interceptors
- **Gson 2.10.1** - JSON serialization
- **Coroutines 1.7.3** - Async/background work
- **Dagger 2.48** - Dependency injection (optional)
- **DataStore 1.0.0** - Secure preferences
- **Timber 5.0.1** - Structured logging
- **Compose** - Modern UI toolkit
- **felhr USB** - USB printer communication

### Testing

Unit tests verify:
- PrinterManager device detection
- ESC/POS base64 decoding
- API request/response serialization
- DeviceManager secure storage
- Retry logic and backoff calculations

Integration tests verify:
- Backend API integration
- Printer communication
- Device pairing flow
- Offline job queueing

Run tests:
```bash
./gradlew test           # Unit tests
./gradlew connectedAndroidTest  # Instrumented tests
```

## Performance Metrics

- **Poll interval**: 5 seconds (configurable)
- **Network timeout**: 30 seconds
- **Service startup**: < 2 seconds
- **Print execution**: 0.5–2 seconds (depends on printer)
- **Memory usage**: ~50–100 MB steady state
- **Battery impact**: Minimal (5-second idle between polls)

## Security Considerations

1. **API Keys**
   - Stored in encrypted DataStore
   - Never logged or exposed
   - Unique per device per outlet

2. **TLS/HTTPS**
   - Enforced for all backend communication
   - Certificate pinning recommended for production

3. **Permissions**
   - Requested at runtime (Android 6+)
   - Scoped to minimum necessary

4. **Data Privacy**
   - No print job data persisted to disk
   - Backup/restore disabled for sensitive data
   - Device transfer excluded in `data_extraction_rules.xml`

## Changelog

### v1.0 (Initial Release)
- Print job polling service
- Multi-printer support (thermal, USB, Android Print)
- Device pairing UI
- Secure API key storage
- Foreground service with auto-restart
- Retry logic with exponential backoff
- Bluetooth/USB hotplug detection

## License

Proprietary - PrimeTech Systems

## Support

For issues or feature requests, contact the PrimePOS development team.
