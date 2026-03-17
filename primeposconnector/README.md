# primeposconnector

Local Windows print connector for PrimePOS.

- **Local mode**: accepts ESC/POS bytes from the browser and sends them directly to an installed printer.
- **Cloud mode**: polls pending print jobs from the backend and auto-prints on this machine — no browser required at print time.

## Run (dev)

```
dotnet run
```

## Build exe (single file)

```
dotnet publish -c Release -r win-x64 /p:PublishSingleFile=true /p:IncludeNativeLibrariesForSelfExtract=true
```

The exe will be in `bin/Release/net8.0-windows/win-x64/publish/primeposconnector.exe`.

## Configuration

Edit `appsettings.json`:

| Key | Description |
|-----|-------------|
| `Server:Url` | Listening address (default `http://127.0.0.1:7310`). |
| `Cors:AllowedOrigins` | Frontend origins allowed to call the connector directly from the browser. |
| `Cors:AllowVercelSubdomains` | When `true`, any `https://*.vercel.app` origin is allowed. |
| `Cors:AllowRenderSubdomains` | When `true`, any `https://*.onrender.com` origin is allowed. |
| `Security:Token` | Optional shared secret. If set, callers must send `X-Primepos-Token: <token>`. |
| `Cloud:Enabled` | Set to `true` to start the cloud-print polling loop on startup. |
| `Cloud:ApiBaseUrl` | Your PrimePOS API root, e.g. `https://your-backend.onrender.com/api/v1`. |
| `Cloud:AuthToken` | A valid PrimePOS JWT access token (log in once and paste the token here). |
| `Cloud:TenantId` | Tenant ID this connector belongs to. Sent as `X-Tenant-ID` header. |
| `Cloud:OutletId` | Outlet ID this connector belongs to. Sent as `X-Outlet-ID` header. |
| `Cloud:DeviceId` | Optional device identifier (defaults to `Environment.MachineName`). |
| `Cloud:Channel` | Print channel to claim jobs for (default `agent`). |
| `Cloud:PollIntervalSeconds` | How often to poll for new jobs (default `2`). |
| `Cloud:DefaultPrinter` | Fallback printer name when a job has no `printer_identifier`. |

## Local API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check — returns `{ status: "ok" }`. |
| `GET` | `/printers` | Lists installed Windows printers and the system default. |
| `POST` | `/print` | Accepts a JSON body and sends raw ESC/POS bytes directly to a printer. |

`POST /print` body:

```json
{
  "printerName": "EPSON TM-T20",
  "contentBase64": "<base64-encoded ESC/POS bytes>",
  "copies": 1,
  "jobName": "PrimePOS Receipt"
}
```

## Cloud Auto-Print Flow

The cloud-print feature lets a PrimePOS instance hosted in the cloud (e.g. Render + Vercel) trigger physical printing on a Windows PC at the outlet — without needing the browser to be open.

### How It Works

When PrimePOS is deployed with the Django backend running on **Render** and the Next.js frontend on **Vercel**, neither cloud service can reach a thermal printer attached to a local Windows PC at the outlet. PrimePOS solves this with a **database-backed print-job queue** so that printing is completely decoupled from the browser session.

**Step 1 — Frontend enqueues the job.** When a cashier finishes a sale, the frontend detects it is running from a cloud URL and calls `POST /api/v1/sales/{id}/enqueue-print/` on the Render backend instead of contacting a printer directly. The backend responds immediately so the cashier is never kept waiting.

**Step 2 — Backend generates and stores the receipt.** The backend generates the full ESC/POS receipt, Base64-encodes it, and stores it in a `PrintJob` database row with `status = "pending"`.

**Step 3 — Connector polls and claims the job.** The **primeposconnector** — a lightweight .NET 8 executable running silently on the outlet's Windows PC — runs a background polling loop (`CloudPoller.RunAsync`) that calls `POST /api/v1/print-jobs/claim-next/` on Render every two seconds. When a pending job is found, the backend atomically marks it `claimed` and returns the ESC/POS payload.

**Step 4 — Connector prints the receipt.** The connector decodes the Base64 bytes and hands them directly to the Windows print spooler via Win32 P/Invoke (`winspool.Drv`, `RAW` data type), causing the receipt to print immediately on the configured thermal printer.

**Step 5 — Connector reports completion.** The connector calls `POST /api/v1/print-jobs/{id}/complete/` so the backend records the final `completed` (or `failed`) status. The Render backend acts purely as a message broker — it never needs a direct network path to the printer.

### How It Works End-to-End

```
┌─────────────────────────────────────────┐
│  Cashier completes a sale in browser    │
│  (Vercel / any cloud URL)               │
└──────────────┬──────────────────────────┘
               │ POST /api/v1/sales/{id}/enqueue-print/
               ▼
┌─────────────────────────────────────────┐
│  Django backend (Render)                │
│  1. Generates ESC/POS receipt (base64)  │
│  2. Creates PrintJob record in DB       │
│     status = "pending"                  │
└──────────────┬──────────────────────────┘
               │ (job sits in DB)
               ▼
┌─────────────────────────────────────────┐
│  primeposconnector (Windows PC at       │
│  the outlet, Cloud:Enabled = true)      │
│                                         │
│  Every PollIntervalSeconds:             │
│  3. POST /print-jobs/claim-next/        │
│     → job.status = "claimed"            │
│  4. Decodes base64 → raw bytes          │
│  5. Calls Win32 spooler API             │
│     (RawPrinterHelper.SendBytes)        │
│  6. POST /print-jobs/{id}/complete/     │
│     → job.status = "completed"/"failed" │
└─────────────────────────────────────────┘
               │
               ▼
     🖨️  Physical receipt printed
```

### Step-by-step details

**Step 1 — Frontend enqueues a print job**

After a successful sale, `printReceipt()` in `frontend/lib/print.ts` detects that it is running from a cloud URL (not `localhost`) and posts to the backend instead of the local agent directly:

```
POST /api/v1/sales/{saleId}/enqueue-print/
{
  "channel": "agent",
  "printer_name": "<outlet default printer or empty>",
  "device_id": "<browser device ID from localStorage>",
  "paper_width": "auto"
}
```

**Step 2 — Backend creates a PrintJob**

`SaleViewSet.enqueue_print` in `backend/apps/sales/views.py`:
- Calls `ReceiptService._generate_escpos_receipt()` to produce a base64 ESC/POS payload.
- Creates a `PrintJob` DB record with `status = "pending"` and stores the payload in a JSON field.
- Returns `{ queued: true, print_job_id, status, receipt_number }`.

**Step 3 — Connector claims the job**

`CloudPoller.RunAsync` loops every `PollIntervalSeconds` and calls:

```
POST /api/v1/print-jobs/claim-next/
{
  "channel": "agent",
  "device_id": "<machine name or configured DeviceId>"
}
```

The backend atomically finds the oldest `pending` job that matches the tenant/outlet/channel/device and sets it to `claimed`.  
If no job is found the backend returns `204 No Content` and the poller sleeps.

**Step 4 — Connector prints the receipt**

The connector decodes `payload.content_base64` from base64 to bytes and calls `RawPrinterHelper.SendBytesToPrinter()` which uses the Windows spooler (`winspool.Drv`) to submit a `RAW` data-type print job.

**Step 5 — Connector marks the job complete**

```
POST /api/v1/print-jobs/{id}/complete/
{
  "result": "completed",   // or "failed"
  "error_message": ""
}
```

The backend sets `job.status = "completed"` (or `"failed"`) and records a timestamp.

### PrintJob lifecycle

```
pending → claimed → completed
                 ↘ failed
                 ↘ cancelled
```

### Why the Dashboard Shows "PA Not Connected" on Cloud Deployments

When PrimePOS is accessed from a cloud URL (Render, Vercel, or any domain other than `localhost`), the dashboard always shows a red **"PA Not Connected"** badge. This is **expected behaviour** — it is not a fault in the cloud auto-print system.

The badge tracks whether the browser can directly reach the connector at `http://127.0.0.1:7310`. That is impossible from a cloud deployment for two reasons: browsers block unencrypted HTTP requests from HTTPS pages (mixed-content policy), and the Next.js proxy that relays those requests runs on Vercel's servers, not on the outlet PC. The proxy recognises cloud hosts and returns `connected: false` immediately without attempting a real connection.

The red badge does **not** mean receipts will fail to print. Cloud auto-print works entirely through outbound connections from the connector to Render — the browser is not part of that path at all. If receipts are not printing, check that `primeposconnector.exe` is running at the outlet and that `Cloud:Enabled = true` is set in `appsettings.json`.

### Quick-start: enable cloud auto-print

1. Run `primeposconnector.exe` on the Windows PC at the outlet.
2. Edit `appsettings.json`:

```json
{
  "Cloud": {
    "Enabled": true,
    "ApiBaseUrl": "https://your-backend.onrender.com/api/v1",
    "AuthToken": "<paste JWT access token here>",
    "TenantId": "1",
    "OutletId": "1",
    "DefaultPrinter": "EPSON TM-T20"
  }
}
```

3. Restart the connector. Console output confirms: `[CloudPoller] Running. api=... channel=agent device=...`
4. Complete a sale in PrimePOS — the receipt will print automatically.
