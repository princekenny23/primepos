# primeposconnector

Local Windows print connector for PrimePOS.

- Local mode: accepts ESC/POS bytes from browser and sends to installed printer.
- Cloud mode: polls print jobs from your backend and auto-prints on this machine.

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

- `Server:Url` defaults to `http://127.0.0.1:7310`
- `Cors:AllowedOrigins` lists frontend origins allowed to call the connector directly from browser.
- `Cors:AllowVercelSubdomains` allows `https://*.vercel.app` origins.
- `Security:Token` can be set to a shared secret. If set, clients must send `X-Primepos-Token`.
- `Cloud:Enabled` set to `true` to enable auto-print polling from backend.
- `Cloud:ApiBaseUrl` set to your API base, e.g. `https://your-backend-domain/api/v1`
- `Cloud:AuthToken` set to a valid JWT access token.
- `Cloud:TenantId` and `Cloud:OutletId` should match the outlet this connector prints for.
- `Cloud:DeviceId` optional (defaults to machine name).
- `Cloud:DefaultPrinter` optional fallback if job has no printer identifier.

## API

- `GET /health`
- `GET /printers`
- `POST /print`

## Cloud Auto-Print Flow

1. Frontend enqueues print jobs to backend.
2. Connector claims jobs from `POST /print-jobs/claim-next/`.
3. Connector prints RAW bytes locally.
4. Connector marks result with `POST /print-jobs/{id}/complete/`.

Print payload example:

```
{
  "printerName": "EPSON TM-T20",
  "contentBase64": "...",
  "copies": 1,
  "jobName": "PrimePOS Receipt"
}
```
