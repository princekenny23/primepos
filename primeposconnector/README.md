# primeposconnector

Local Windows print agent for PrimePOS. This runs on the POS machine and accepts ESC/POS bytes from the browser, then sends them to the installed printer.

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
- `Security:Token` can be set to a shared secret. If set, clients must send `X-Primepos-Token`.
- `Cors:AllowedOrigins` – list of origins allowed to call the agent. Defaults to `["http://localhost:3000", "http://127.0.0.1:3000"]`. Add your production frontend URL (e.g. `https://primepos-beta.vercel.app`) to unblock requests from deployed frontends.

### Private Network Access (PNA)

Modern browsers enforce Chrome's [Private Network Access](https://developer.chrome.com/blog/private-network-access-preflight/) policy, which blocks public-origin pages from accessing loopback addresses unless the server explicitly opts in. The connector handles this automatically: when a browser sends a PNA preflight (`OPTIONS` with `Access-Control-Request-Private-Network: true`), the connector responds with `Access-Control-Allow-Private-Network: true` alongside the normal CORS headers.

## API

- `GET /health`
- `GET /printers`
- `POST /print`

Print payload example:

```
{
  "printerName": "EPSON TM-T20",
  "contentBase64": "...",
  "copies": 1,
  "jobName": "PrimePOS Receipt"
}
```
