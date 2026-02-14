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
