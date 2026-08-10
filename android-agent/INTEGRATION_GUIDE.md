# Android Print Agent - Integration Guide

This document explains how to integrate the Android print agent with the existing PrimePOS backend and deployment workflow.

## Backend Integration Checklist

### 1. API Endpoint Verification

The agent uses these existing backend endpoints. Verify they are working:

```bash
# Test device pairing request
curl -X POST http://localhost:8000/api/devices/pairing/request/ \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "ANDROID_test",
    "channel": "mobile",
    "printer_identifier": "/dev/lp0"
  }'

# Expected: 200 with { "pairing_code": "123456", "expires_at": "...", "device_id": "..." }

# Test print job claiming
curl -X POST http://localhost:8000/api/print-jobs/claim-next/ \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "mobile",
    "device_id": "ANDROID_test",
    "printer_type": "receipt"
  }'

# Expected: 200 with PrintJob or 204 No Content if no jobs
```

### 2. Database Schema Verification

Ensure these models are present in backend:

**PrintJob** (already exists in `backend/apps/sales/models.py`):
- ✓ `channel` field (value: "mobile")
- ✓ `device_id` field
- ✓ `printer_type` field
- ✓ `printer_identifier` field
- ✓ `payload` JSONField with `content_base64`
- ✓ `attempts` and `max_attempts`
- ✓ Status filtering

**PrintDevice** (already exists):
- ✓ `device_id` field
- ✓ `api_key_hash` field
- ✓ `pairing_code` and `pairing_expires_at`
- ✓ `is_active` field
- ✓ `printer_identifier` field

### 3. Backend Settings for Mobile Channel

Update `backend/primepos/settings.py` if needed:

```python
# Print job configuration
PRINT_JOB_MAX_ATTEMPTS = 3
PRINT_JOB_RETRY_INTERVAL = 5  # seconds
MOBILE_PRINTER_PAIRING_CODE_EXPIRY = 600  # 10 minutes

# Mobile channel specific
MOBILE_CHANNEL_ENABLED = True
MOBILE_CHANNEL_POLL_INTERVAL = 5  # seconds
```

### 4. Test Print Jobs from Frontend

In `frontend/lib/print.ts`, test mobile channel:

```typescript
// Test creating a print job for mobile channel
const testPrintJob = async () => {
  const response = await fetch('/api/print-jobs/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel: 'mobile',  // Route to Android agent
      printer_type: 'receipt',
      device_id: 'ANDROID_*',  // Will match Android devices
      payload: {
        content_base64: window.btoa('Test receipt\nFrom mobile'),
        copies: 1
      }
    })
  });
  
  if (response.ok) {
    console.log('Print job created for mobile channel');
  }
};
```

## Android Agent Deployment

### Step 1: Configure Build Variant

Create a new variant in `android-agent/app/build.gradle.kts`:

```kotlin
flavorDimensions("channel")
productFlavors {
    create("production") {
        dimension = "channel"
        buildConfigField("String", "BACKEND_BASE_URL", 
            "\"https://api.primepos.com\"")
        buildConfigField("boolean", "AUTO_START_SERVICE", "true")
    }
    create("staging") {
        dimension = "channel"
        buildConfigField("String", "BACKEND_BASE_URL", 
            "\"https://staging-api.primepos.com\"")
        buildConfigField("boolean", "AUTO_START_SERVICE", "false")
    }
}
```

### Step 2: Build Release APK

```bash
cd android-agent/

# Build production release APK
./gradlew assembleProductionRelease

# Output: app/build/outputs/apk/productionRelease/app-production-release.apk

# OR build bundle for Google Play (if distributing)
./gradlew bundleProductionRelease
```

### Step 3: Device Installation

For all-in-one Android POS devices:

**Option A: Using ADB (Development)**
```bash
adb install app-release.apk
adb shell pm grant com.primex.printingagent android.permission.INTERNET
adb shell pm grant com.primex.printingagent android.permission.BLUETOOTH
adb shell pm grant com.primex.printingagent android.permission.FOREGROUND_SERVICE
```

**Option B: Pre-installation (Manufacturing)**
Contact POS device manufacturer with:
- APK file
- Required permissions list
- Auto-start requirements
- Pairing backend URL

**Option C: MDM (Enterprise)**
Deploy via Mobile Device Management platform:
- Push APK to managed devices
- Configure as system app
- Grant permissions programmatically

### Step 4: Initial Setup

1. Device starts app (first launch)
2. PairingActivity appears
3. User enters:
   - Backend URL (e.g., https://api.primepos.com)
   - Outlet ID (from PrimePOS system)
4. App detects printers
5. User selects printer
6. App requests pairing code from backend
7. Backend generates 6-digit code (valid 10 minutes)
8. User enters code in PrimePOS pairing portal
9. Backend validates code and issues API key
10. Device polls for API key, receives it
11. Service starts polling for print jobs

### Step 5: Monitoring

Monitor device status in PrimePOS admin:

```sql
-- Check registered Android devices
SELECT 
    device_id, 
    printer_identifier, 
    last_seen_at,
    is_active
FROM sales_printdevice
WHERE channel = 'mobile'
ORDER BY last_seen_at DESC;

-- Monitor mobile print jobs
SELECT 
    id,
    device_id,
    status,
    attempts,
    created_at,
    completed_at
FROM sales_printjob
WHERE channel = 'mobile'
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Check for failed jobs
SELECT 
    id,
    device_id,
    status,
    attempts,
    max_attempts
FROM sales_printjob
WHERE channel = 'mobile'
AND status IN ('failed', 'failed_permanent')
AND created_at > NOW() - INTERVAL '24 hours';
```

## Testing

### 1. Unit Test the API Responses

Create test fixtures in `backend/tests/`:

```python
# tests/test_mobile_print_api.py
from django.test import TestCase
from sales.models import PrintJob, PrintDevice

class MobilePrintAPITest(TestCase):
    def test_claim_print_job_mobile_channel(self):
        # Setup device
        device = PrintDevice.objects.create(
            device_id="ANDROID_TEST_001",
            channel="mobile",
            printer_identifier="/dev/lp0"
        )
        
        # Setup print job
        job = PrintJob.objects.create(
            device_id="ANDROID_TEST_001",
            channel="mobile",
            status="pending",
            payload={
                "content_base64": "SGVsbG8gV29ybGQ=",
                "copies": 1
            }
        )
        
        # Test claiming
        response = self.client.post(
            '/api/print-jobs/claim-next/',
            {"channel": "mobile", "device_id": "ANDROID_TEST_001"},
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {device.api_key}'
        )
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['id'], job.id)
```

### 2. Integration Test Mobile Device

```bash
# Simulate Android device polling
for i in {1..10}; do
  curl -X POST http://localhost:8000/api/print-jobs/claim-next/ \
    -H "Authorization: Bearer test_api_key" \
    -H "Content-Type: application/json" \
    -d '{"channel": "mobile", "device_id": "ANDROID_TEST"}' \
    -v
  
  sleep 5
done
```

### 3. Test from Frontend

Create a test page in `frontend/pages/print-test.tsx`:

```typescript
export default function PrintTestPage() {
  const testMobilePrint = async () => {
    const response = await fetch('/api/print-jobs/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAdminToken()}`
      },
      body: JSON.stringify({
        outlet_id: '1',
        channel: 'mobile',  // Route to Android agent
        printer_type: 'receipt',
        device_id: 'ANDROID_*',
        payload: {
          content_base64: btoa('TEST\nReceipt\nFrom Mobile Agent'),
          receipt_number: 'TST-001',
          copies: 1
        }
      })
    });
    
    const job = await response.json();
    console.log('Print job created:', job);
  };

  return (
    <button onClick={testMobilePrint}>
      Send Test Print to Mobile Agent
    </button>
  );
}
```

## Monitoring & Troubleshooting

### Enable Detailed Logging

On device, enable debug logs:

```bash
adb shell setprop log.tag.PrintJobService VERBOSE
adb shell setprop log.tag.PrinterManager VERBOSE
adb shell setprop log.tag.OkHttp DEBUG

# View logs
adb logcat PrintJobService PrinterManager OkHttp -v threadtime
```

### Common Issues

#### Issue: Device never claims jobs
**Root cause**: API key not stored or incorrect auth header.

**Fix**:
1. Check DataStore: `adb shell run-as com.primex.printingagent cat data/data/com.primex.printingagent/files/datastore/printer_prefs.preferences_pb`
2. Verify pairing completed: Check backend for device with non-null `api_key_hash`
3. Test API key: `curl -H "Authorization: Bearer {key}" {backend}/api/print-jobs/claim-next/`

#### Issue: Printer not detected
**Root cause**: Incorrect device path or USB permissions.

**Fix**:
1. Check device paths: `adb shell ls -la /dev/ | grep -E "lp|ttyUSB|ttyS"`
2. Grant USB permissions: `adb shell pm grant com.primex.printingagent android.permission.USB_PERMISSION`
3. Test with `adb shell cat /dev/lp0` (should not error)

#### Issue: Service keeps stopping
**Root cause**: Battery optimization killing foreground service.

**Fix**:
1. Add to device battery whitelist: Settings → Battery → App Power Management
2. Increase polling interval if device is throttling
3. Ensure `FOREGROUND_SERVICE` permission is granted

### Debugging Print Failures

```sql
-- Find failed print jobs
SELECT * FROM sales_printjob 
WHERE channel = 'mobile' 
AND status = 'failed_permanent'
AND created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 10;

-- Check device heartbeat
SELECT 
    device_id, 
    last_seen_at,
    AGE(NOW(), last_seen_at) as time_since_seen
FROM sales_printdevice
WHERE channel = 'mobile'
ORDER BY last_seen_at DESC;
```

## Scaling Considerations

### Multiple Devices per Outlet

The agent supports one device per printer identifier. To support multiple outlets:

1. Deploy separate APK instances with different outlet IDs
2. Or use dynamic outlet selection in pairing UI

### High-Volume Print Queues

If backend receives many print jobs:

1. Increase `PRINT_JOB_MAX_ATTEMPTS` carefully
2. Monitor queue depth: `SELECT COUNT(*) FROM sales_printjob WHERE status = 'pending' AND channel = 'mobile'`
3. Consider increasing polling frequency for time-sensitive receipts
4. Add database indexes on `(channel, status, device_id)`

### Network Resilience

For unreliable networks:

1. Enable local job queueing in Room database (not implemented yet, add Room dependency)
2. Increase poll interval to reduce bandwidth: `MOBILE_CHANNEL_POLL_INTERVAL = 10`
3. Implement exponential backoff in retry logic

## Migration from Windows Agent

### Running Both Agents

You can run Windows CH agent and Android agent simultaneously:

```python
# backend/apps/sales/models.py PrintJob
# Assign jobs by device_id prefix:
# - CH_* → Windows agent
# - ANDROID_* → Android agent
# - PRINTER_* → Any agent

def assign_printer_job(outlet, printer_type):
    if outlet.has_android_device:
        return 'ANDROID_*'
    elif outlet.has_windows_agent:
        return 'CH_*'
    else:
        return 'PRINTER_*'
```

### Gradual Rollout

1. **Phase 1**: Deploy Android agent, monitor for issues (week 1)
2. **Phase 2**: Route 10% of jobs to mobile channel (week 2)
3. **Phase 3**: Route 50% of jobs to mobile channel (week 3)
4. **Phase 4**: Full migration, decommission Windows agent if desired (week 4+)

## Reporting

### Dashboard Metrics

Add to PrimePOS admin dashboard:

```sql
-- Mobile print jobs last 24 hours
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_jobs,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
    SUM(CASE WHEN status = 'failed_permanent' THEN 1 ELSE 0 END) as failed,
    ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / 
          COUNT(*), 2) as success_rate
FROM sales_printjob
WHERE channel = 'mobile'
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Device availability
SELECT 
    device_id,
    printer_identifier,
    CASE 
        WHEN AGE(NOW(), last_seen_at) < INTERVAL '5 minutes' THEN 'Online'
        WHEN AGE(NOW(), last_seen_at) < INTERVAL '1 hour' THEN 'Idle'
        ELSE 'Offline'
    END as status,
    AGE(NOW(), last_seen_at) as last_seen
FROM sales_printdevice
WHERE channel = 'mobile'
ORDER BY last_seen_at DESC;
```

## Support & Documentation

- **Backend API docs**: Run `python manage.py spectacular --no-file` and access `/api/schema/swagger/`
- **Android docs**: See [README.md](./README.md)
- **Issues**: Check Android logs with `adb logcat` filtered by tag
- **Feature requests**: Create GitHub issues or contact dev team

## Next Steps

1. ✅ Deploy Android agent to test devices
2. ✅ Verify API endpoints and device pairing
3. ✅ Run integration tests
4. ✅ Monitor logs and metrics
5. ✅ Gradually roll out to production
6. ✅ Decommission Windows agent if desired

