using System.Runtime.InteropServices;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using System.Windows.Forms;

var builder = WebApplication.CreateBuilder(args);

var corsOptions = builder.Configuration.GetSection("Cors").Get<ConnectorCorsOptions>() ?? new ConnectorCorsOptions();

builder.Services.Configure<AgentOptions>(builder.Configuration);
builder.Services.AddCors(options =>
{
    options.AddPolicy("LocalFrontend", policy =>
    {
        policy.SetIsOriginAllowed(origin => ConnectorCorsOptions.IsAllowedOrigin(origin, corsOptions))
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

var options = app.Services.GetRequiredService<IOptions<AgentOptions>>().Value;
var url = options.Server?.Url ?? "http://127.0.0.1:7310";
app.Urls.Clear();
app.Urls.Add(url);

app.UseCors("LocalFrontend");

app.MapGet("/health", () => Results.Ok(new { status = "ok", name = "primeposconnector" }));

app.MapGet("/printers", () =>
{
    if (!OperatingSystem.IsWindows())
    {
        return Results.Problem("Printing is only supported on Windows.", statusCode: 501);
    }

    var printers = new List<string>();
    foreach (string printer in System.Drawing.Printing.PrinterSettings.InstalledPrinters)
    {
        printers.Add(printer);
    }

    var defaultPrinter = new System.Drawing.Printing.PrinterSettings().PrinterName;
    return Results.Ok(new { printers, @default = defaultPrinter });
});

app.MapPost("/print", (HttpRequest request, PrintJob job) =>
{
    var token = options.Security?.Token ?? string.Empty;
    if (!string.IsNullOrWhiteSpace(token))
    {
        if (!request.Headers.TryGetValue("X-Primepos-Token", out var provided) || provided != token)
        {
            return Results.Unauthorized();
        }
    }

    if (!OperatingSystem.IsWindows())
    {
        return Results.Problem("Printing is only supported on Windows.", statusCode: 501);
    }

    if (string.IsNullOrWhiteSpace(job.PrinterName))
    {
        return Results.BadRequest(new { error = "PrinterName is required." });
    }

    if (string.IsNullOrWhiteSpace(job.ContentBase64))
    {
        return Results.BadRequest(new { error = "ContentBase64 is required." });
    }

    byte[] payload;
    try
    {
        payload = Convert.FromBase64String(job.ContentBase64);
    }
    catch (FormatException)
    {
        return Results.BadRequest(new { error = "ContentBase64 is not valid base64." });
    }

    var copies = job.Copies <= 0 ? 1 : job.Copies;
    var jobName = string.IsNullOrWhiteSpace(job.JobName) ? "PrimePOS Receipt" : job.JobName;

    for (var i = 0; i < copies; i++)
    {
        var result = RawPrinterHelper.SendBytesToPrinter(job.PrinterName, jobName, payload);
        if (!result)
        {
            return Results.Problem("Failed to send print job to printer.", statusCode: 500);
        }
    }

    return Results.Ok(new { status = "printed", printer = job.PrinterName, copies });
});

app.MapPost("/cloud/pair/start", async (LocalPairingStartRequest request, CancellationToken cancellationToken) =>
{
    var cloud = options.Cloud;
    if (cloud?.Enabled != true)
    {
        return Results.BadRequest(new { error = "Cloud mode is disabled in connector configuration." });
    }

    var apiBase = (cloud.ApiBaseUrl ?? string.Empty).Trim().TrimEnd('/');
    if (string.IsNullOrWhiteSpace(apiBase))
    {
        return Results.BadRequest(new { error = "Cloud.ApiBaseUrl is required." });
    }

    var effectiveCloud = CloudPairingBridge.WithOverrides(cloud, request);
    var channel = string.IsNullOrWhiteSpace(effectiveCloud.Channel) ? "agent" : effectiveCloud.Channel.Trim().ToLowerInvariant();
    var deviceId = string.IsNullOrWhiteSpace(effectiveCloud.DeviceId) ? Environment.MachineName : effectiveCloud.DeviceId.Trim();

    using var http = CloudPairingBridge.CreateHttpClient(effectiveCloud);

    try
    {
        var pairing = await CloudPairingBridge.RequestPairingCodeAsync(http, apiBase, effectiveCloud, channel, deviceId, cancellationToken);
        RuntimeCloudState.SetPairing(pairing.DeviceId, pairing.PairingCode, pairing.ExpiresAt);

        return Results.Ok(new
        {
            paired = false,
            device_id = pairing.DeviceId,
            pairing_code = pairing.PairingCode,
            expires_at = pairing.ExpiresAt,
            outlet_id = effectiveCloud.OutletId,
        });
    }
    catch (Exception ex)
    {
        return Results.Problem($"Failed to start connector pairing: {ex.Message}", statusCode: 500);
    }
});

app.MapPost("/cloud/pair/activate", (LocalPairingActivateRequest request) =>
{
    if (string.IsNullOrWhiteSpace(request.ApiKey))
    {
        return Results.BadRequest(new { error = "api_key is required." });
    }

    RuntimeCloudState.SetDeviceApiKey(request.ApiKey);
    ApiKeyStore.Save(request.ApiKey);   // persist across restarts
    return Results.Ok(new { activated = true });
});

app.MapGet("/cloud/pair/state", () =>
{
    return Results.Ok(RuntimeCloudState.GetSnapshot());
});

if (options.Cloud?.Enabled == true)
{
    app.Lifetime.ApplicationStarted.Register(() =>
    {
        _ = Task.Run(() => CloudPoller.RunAsync(options, app.Lifetime.ApplicationStopping));
    });
}

app.Run();

sealed class AgentOptions
{
    public ServerOptions? Server { get; set; }
    public SecurityOptions? Security { get; set; }
    public CloudOptions? Cloud { get; set; }
}

sealed class ConnectorCorsOptions
{
    public string[] AllowedOrigins { get; set; } = [];
    public bool AllowVercelSubdomains { get; set; } = true;
    public bool AllowRenderSubdomains { get; set; } = true;

    public static bool IsAllowedOrigin(string? origin, ConnectorCorsOptions options)
    {
        if (string.IsNullOrWhiteSpace(origin))
        {
            return false;
        }

        if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri))
        {
            return false;
        }

        var host = uri.Host.ToLowerInvariant();
        if (host == "localhost" || host == "127.0.0.1" || host == "::1")
        {
            return true;
        }

        if (options.AllowVercelSubdomains && host.EndsWith(".vercel.app", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (options.AllowRenderSubdomains && host.EndsWith(".onrender.com", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return options.AllowedOrigins.Any(allowed => string.Equals(allowed?.Trim(), origin, StringComparison.OrdinalIgnoreCase));
    }
}

sealed class ServerOptions
{
    public string? Url { get; set; }
}

sealed class SecurityOptions
{
    public string? Token { get; set; }
}

sealed class CloudOptions
{
    public bool Enabled { get; set; } = false;
    public string? ApiBaseUrl { get; set; }
    public string? DeviceApiKey { get; set; }
    public string? AuthToken { get; set; }
    public string? TenantId { get; set; }
    public string? OutletId { get; set; }
    public string? DeviceId { get; set; }
    public string? PrinterType { get; set; } = "receipt";
    public string? Channel { get; set; } = "agent";
    public int PollIntervalSeconds { get; set; } = 2;
    public string? DefaultPrinter { get; set; }
}

sealed class PrintJob
{
    public string PrinterName { get; set; } = string.Empty;
    public string ContentBase64 { get; set; } = string.Empty;
    public int Copies { get; set; } = 1;
    public string? JobName { get; set; }
}

sealed class LocalPairingStartRequest
{
    [JsonPropertyName("tenant_id")]
    public string? TenantId { get; set; }

    [JsonPropertyName("outlet_id")]
    public string? OutletId { get; set; }

    [JsonPropertyName("device_id")]
    public string? DeviceId { get; set; }

    [JsonPropertyName("channel")]
    public string? Channel { get; set; }

    [JsonPropertyName("printer_identifier")]
    public string? PrinterIdentifier { get; set; }
}

sealed class LocalPairingActivateRequest
{
    [JsonPropertyName("api_key")]
    public string ApiKey { get; set; } = string.Empty;
}

sealed class CloudPrintJob
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("printer_identifier")]
    public string PrinterIdentifier { get; set; } = string.Empty;

    [JsonPropertyName("payload")]
    public CloudPrintPayload? Payload { get; set; }
}

sealed class CloudPrintPayload
{
    [JsonPropertyName("content_base64")]
    public string ContentBase64 { get; set; } = string.Empty;

    [JsonPropertyName("receipt_number")]
    public string ReceiptNumber { get; set; } = string.Empty;
}

sealed class CloudDeviceRegistrationResponse
{
    [JsonPropertyName("registered")]
    public bool Registered { get; set; }

    [JsonPropertyName("device_id")]
    public string? DeviceId { get; set; }

    [JsonPropertyName("api_key")]
    public string? ApiKey { get; set; }
}

sealed class DevicePairingRequestResponse
{
    [JsonPropertyName("device_id")]
    public string DeviceId { get; set; } = string.Empty;

    [JsonPropertyName("pairing_code")]
    public string PairingCode { get; set; } = string.Empty;

    [JsonPropertyName("expires_at")]
    public DateTime? ExpiresAt { get; set; }
}

sealed class DevicePairingStatusResponse
{
    [JsonPropertyName("paired")]
    public bool Paired { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("api_key")]
    public string? ApiKey { get; set; }
}

static class CloudPoller
{
    public static async Task RunAsync(AgentOptions options, CancellationToken stoppingToken)
    {
        var cloud = options.Cloud;
        if (cloud is null)
        {
            return;
        }

        var apiBase = (cloud.ApiBaseUrl ?? string.Empty).Trim().TrimEnd('/');
        if (string.IsNullOrWhiteSpace(apiBase))
        {
            Console.WriteLine("[CloudPoller] Cloud enabled but ApiBaseUrl is missing.");
            return;
        }

        var bootstrapToken = (cloud.AuthToken ?? string.Empty).Trim();
        var channel = string.IsNullOrWhiteSpace(cloud.Channel) ? "agent" : cloud.Channel.Trim().ToLowerInvariant();
        var deviceId = string.IsNullOrWhiteSpace(cloud.DeviceId) ? string.Empty : cloud.DeviceId.Trim();
        if (string.IsNullOrWhiteSpace(deviceId))
        {
            deviceId = RuntimeCloudState.GetDeviceId();
        }
        if (string.IsNullOrWhiteSpace(deviceId))
        {
            deviceId = (DeviceIdentityStore.Load() ?? string.Empty).Trim();
            if (!string.IsNullOrWhiteSpace(deviceId))
            {
                RuntimeCloudState.SetDeviceId(deviceId);
                Console.WriteLine("[CloudPoller] Loaded device ID from local store.");
            }
        }
        if (string.IsNullOrWhiteSpace(deviceId))
        {
            deviceId = Environment.MachineName;
        }
        var printerType = NormalizePrinterType(cloud.PrinterType);
        var pollSeconds = cloud.PollIntervalSeconds <= 0 ? 5 : Math.Max(3, cloud.PollIntervalSeconds);

        using var http = new HttpClient();
        http.Timeout = TimeSpan.FromSeconds(20);
        if (!string.IsNullOrWhiteSpace(cloud.TenantId))
        {
            http.DefaultRequestHeaders.Add("X-Tenant-ID", cloud.TenantId.Trim());
        }
        if (!string.IsNullOrWhiteSpace(cloud.OutletId))
        {
            http.DefaultRequestHeaders.Add("X-Outlet-ID", cloud.OutletId.Trim());
        }

        Console.WriteLine($"[CloudPoller] Running. api={apiBase} channel={channel} device={deviceId} printerType={printerType}");

        if (string.IsNullOrWhiteSpace(cloud.OutletId))
        {
            Console.WriteLine("[CloudPoller] WARNING: OutletId is not set in appsettings.json. Print jobs will match based on the outlet stored in the backend for this device. If jobs are not being claimed, set OutletId to the correct outlet primary key.");
        }
        if (string.IsNullOrWhiteSpace(cloud.TenantId))
        {
            Console.WriteLine("[CloudPoller] WARNING: TenantId is not set in appsettings.json. Tenant will be resolved from device API key.");
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            var deviceApiKey = (cloud.DeviceApiKey ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(deviceApiKey))
            {
                deviceApiKey = RuntimeCloudState.GetDeviceApiKey();
            }
            if (string.IsNullOrWhiteSpace(deviceApiKey))
            {
                deviceApiKey = (ApiKeyStore.Load() ?? string.Empty).Trim();
                if (!string.IsNullOrWhiteSpace(deviceApiKey))
                {
                    RuntimeCloudState.SetDeviceApiKey(deviceApiKey);
                    Console.WriteLine("[CloudPoller] Loaded device API key from local store.");
                }
            }

            if (string.IsNullOrWhiteSpace(deviceApiKey) && !string.IsNullOrWhiteSpace(bootstrapToken))
            {
                try
                {
                    var registration = await RegisterDeviceAsync(http, apiBase, cloud, channel, deviceId, bootstrapToken, ct: stoppingToken);
                    if (!string.IsNullOrWhiteSpace(registration.DeviceId))
                    {
                        deviceId = registration.DeviceId.Trim();
                        RuntimeCloudState.SetDeviceId(deviceId);
                        DeviceIdentityStore.Save(deviceId);
                        Console.WriteLine($"[CloudPoller] Device registered as '{deviceId}'.");
                    }
                    if (!string.IsNullOrWhiteSpace(registration.ApiKey))
                    {
                        deviceApiKey = registration.ApiKey.Trim();
                        RuntimeCloudState.SetDeviceApiKey(deviceApiKey);
                        ApiKeyStore.Save(deviceApiKey);
                        Console.WriteLine("[CloudPoller] Device API key received from registration.");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[CloudPoller] Device registration warning: {ex.Message}");
                }
            }

            if (string.IsNullOrWhiteSpace(deviceApiKey))
            {
                try
                {
                    var pairing = await RequestPairingCodeAsync(http, apiBase, cloud, channel, deviceId, stoppingToken);
                    if (!string.IsNullOrWhiteSpace(pairing.DeviceId))
                    {
                        deviceId = pairing.DeviceId.Trim();
                        RuntimeCloudState.SetDeviceId(deviceId);
                        DeviceIdentityStore.Save(deviceId);
                    }
                    if (!string.IsNullOrWhiteSpace(pairing.PairingCode))
                    {
                        Console.WriteLine($"[CloudPoller] Enter pairing code in frontend: {pairing.PairingCode}");
                        PairingDialogHelper.ShowPairingCodeDialog(pairing.PairingCode);
                    }

                    while (!stoppingToken.IsCancellationRequested && string.IsNullOrWhiteSpace(deviceApiKey))
                    {
                        var pairingStatus = await PollPairingStatusAsync(http, apiBase, cloud, deviceId, pairing.PairingCode, stoppingToken);
                        if (pairingStatus?.Paired == true && !string.IsNullOrWhiteSpace(pairingStatus.ApiKey))
                        {
                            deviceApiKey = pairingStatus.ApiKey.Trim();
                            RuntimeCloudState.SetDeviceApiKey(deviceApiKey);
                            ApiKeyStore.Save(deviceApiKey);
                            Console.WriteLine("[CloudPoller] Device paired and API key received.");
                            break;
                        }

                        var runtimeKey = RuntimeCloudState.GetDeviceApiKey();
                        if (!string.IsNullOrWhiteSpace(runtimeKey))
                        {
                            deviceApiKey = runtimeKey;
                            ApiKeyStore.Save(deviceApiKey);
                            Console.WriteLine("[CloudPoller] Using runtime API key provided by local pairing flow.");
                            break;
                        }

                        await Task.Delay(TimeSpan.FromSeconds(Math.Max(3, pollSeconds)), stoppingToken);
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[CloudPoller] Pairing bootstrap warning: {ex.Message}");
                }
            }

            if (string.IsNullOrWhiteSpace(deviceApiKey))
            {
                Console.WriteLine("[CloudPoller] Missing DeviceApiKey. Waiting for frontend pairing activation...");

                while (!stoppingToken.IsCancellationRequested && string.IsNullOrWhiteSpace(deviceApiKey))
                {
                    var runtimeKey = RuntimeCloudState.GetDeviceApiKey();
                    if (!string.IsNullOrWhiteSpace(runtimeKey))
                    {
                        deviceApiKey = runtimeKey;
                        ApiKeyStore.Save(deviceApiKey);
                        Console.WriteLine("[CloudPoller] Runtime API key activated from frontend pairing.");
                        break;
                    }

                    await Task.Delay(TimeSpan.FromSeconds(Math.Max(3, pollSeconds)), stoppingToken);
                }

                if (string.IsNullOrWhiteSpace(deviceApiKey))
                {
                    break;
                }
            }

            SetDeviceApiKey(http, deviceApiKey);
            Console.WriteLine($"[CloudPoller] Device ready. Polling every {pollSeconds}s for jobs on channel='{channel}' printerType='{printerType}'.");
            var printerSyncIntervalSeconds = 300;

            // Send heartbeat immediately so is_active becomes true right away
            try
            {
                await HeartbeatAsync(http, apiBase, stoppingToken);
                Console.WriteLine($"[CloudPoller] Heartbeat OK — device marked online.");
            }
            catch (Exception hbEx)
            {
                Console.WriteLine($"[CloudPoller] Initial heartbeat warning: {hbEx.Message}");
            }

            try
            {
                await SyncInstalledPrintersAsync(http, apiBase, deviceId, stoppingToken);
            }
            catch (DeviceUnauthorizedException)
            {
                throw;
            }
            catch (Exception syncEx)
            {
                Console.WriteLine($"[CloudPoller] Initial printer sync warning: {syncEx.Message}");
            }

            var lastHeartbeatAt = DateTime.UtcNow;
            var lastPrinterSyncAt = DateTime.UtcNow;
            var pollCount = 0;

            try
            {
                while (!stoppingToken.IsCancellationRequested)
                {
                    if ((DateTime.UtcNow - lastHeartbeatAt).TotalSeconds >= 30)
                    {
                        try
                        {
                            await HeartbeatAsync(http, apiBase, stoppingToken);
                            Console.WriteLine($"[CloudPoller] Heartbeat OK.");
                        }
                        catch (DeviceUnauthorizedException)
                        {
                            throw;
                        }
                        catch (Exception hbEx)
                        {
                            Console.WriteLine($"[CloudPoller] Heartbeat warning: {hbEx.Message}");
                        }
                        lastHeartbeatAt = DateTime.UtcNow;
                    }

                    if ((DateTime.UtcNow - lastPrinterSyncAt).TotalSeconds >= printerSyncIntervalSeconds)
                    {
                        try
                        {
                            await SyncInstalledPrintersAsync(http, apiBase, deviceId, stoppingToken);
                        }
                        catch (DeviceUnauthorizedException)
                        {
                            throw;
                        }
                        catch (Exception syncEx)
                        {
                            Console.WriteLine($"[CloudPoller] Printer sync warning: {syncEx.Message}");
                        }
                        lastPrinterSyncAt = DateTime.UtcNow;
                    }

                    pollCount++;
                    var claimed = await ClaimNextAsync(http, apiBase, channel, deviceId, printerType, stoppingToken);
                    if (claimed is null)
                    {
                        // Log every 60 polls (~5 min at 5s interval) so operator knows it's alive
                        if (pollCount % 60 == 0)
                        {
                            Console.WriteLine($"[CloudPoller] Waiting for jobs... (polls: {pollCount})");
                        }
                        await Task.Delay(TimeSpan.FromSeconds(pollSeconds), stoppingToken);
                        continue;
                    }

                    var contentBase64 = (claimed.Payload?.ContentBase64 ?? string.Empty).Trim();
                    var printerName = (claimed.PrinterIdentifier ?? string.Empty).Trim();
                    if (string.IsNullOrWhiteSpace(printerName))
                    {
                        printerName = (cloud.DefaultPrinter ?? string.Empty).Trim();
                    }

                    if (string.IsNullOrWhiteSpace(contentBase64))
                    {
                        await CompleteAsync(http, apiBase, claimed.Id, "failed", "Missing content_base64", stoppingToken);
                        continue;
                    }
                    if (string.IsNullOrWhiteSpace(printerName))
                    {
                        await CompleteAsync(http, apiBase, claimed.Id, "failed", "Missing printer name", stoppingToken);
                        continue;
                    }

                    byte[] payload;
                    try
                    {
                        payload = Convert.FromBase64String(contentBase64);
                    }
                    catch
                    {
                        await CompleteAsync(http, apiBase, claimed.Id, "failed", "Invalid base64 payload", stoppingToken);
                        continue;
                    }

                    var jobName = string.IsNullOrWhiteSpace(claimed.Payload?.ReceiptNumber)
                        ? "PrimePOS Receipt"
                        : $"PrimePOS Receipt {claimed.Payload.ReceiptNumber}";

                    var sent = RawPrinterHelper.SendBytesToPrinter(printerName, jobName, payload);
                    if (!sent)
                    {
                        await CompleteAsync(http, apiBase, claimed.Id, "failed", "Failed to send bytes to printer", stoppingToken);
                        continue;
                    }

                    await CompleteAsync(http, apiBase, claimed.Id, "completed", string.Empty, stoppingToken);
                    Console.WriteLine($"[CloudPoller] Printed job #{claimed.Id} on '{printerName}'");
                }
            }
            catch (DeviceUnauthorizedException ex)
            {
                Console.WriteLine($"[CloudPoller] {ex.Message}");
                ClearDeviceApiKey(http);
                RuntimeCloudState.ClearApiKey();
                ApiKeyStore.Clear();

                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(Math.Max(3, pollSeconds)), stoppingToken);
                }
                catch (TaskCanceledException)
                {
                    break;
                }
                continue;
            }
            catch (TaskCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[CloudPoller] Error: {ex.Message}");
                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(Math.Max(3, pollSeconds)), stoppingToken);
                }
                catch (TaskCanceledException)
                {
                    break;
                }
            }
        }
    }

    private static async Task<CloudPrintJob?> ClaimNextAsync(
        HttpClient http,
        string apiBase,
        string channel,
        string deviceId,
        string printerType,
        CancellationToken ct)
    {
        var endpoint = $"{apiBase}/print-jobs/claim-next/";
        var payload = new { channel, device_id = deviceId, printer_type = printerType };
        using var response = await http.PostAsJsonAsync(endpoint, payload, ct);

        if ((int)response.StatusCode == 204)
        {
            return null;
        }

        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            throw new DeviceUnauthorizedException();
        }

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"Claim failed {(int)response.StatusCode}: {body}");
        }

        var claimed = await response.Content.ReadFromJsonAsync<CloudPrintJob>(cancellationToken: ct);
        return claimed;
    }

    private static async Task<CloudDeviceRegistrationResponse> RegisterDeviceAsync(
        HttpClient http,
        string apiBase,
        CloudOptions cloud,
        string channel,
        string deviceId,
        string bootstrapToken,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(bootstrapToken))
        {
            throw new InvalidOperationException("Bootstrap AuthToken is required for first-time registration.");
        }

        SetBearer(http, bootstrapToken);

        int? outletId = null;
        if (int.TryParse((cloud.OutletId ?? string.Empty).Trim(), out var parsedOutletId))
        {
            outletId = parsedOutletId;
        }

        var endpoint = $"{apiBase}/print-jobs/register-device/";
        var payload = new
        {
            device_id = string.IsNullOrWhiteSpace(deviceId) ? null : deviceId,
            device_name = Environment.MachineName,
            channel,
            outlet_id = outletId,
            printer_identifier = (cloud.DefaultPrinter ?? string.Empty).Trim(),
            is_active = true,
        };

        using var response = await http.PostAsJsonAsync(endpoint, payload, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"Register device failed {(int)response.StatusCode}: {body}");
        }

        var result = await response.Content.ReadFromJsonAsync<CloudDeviceRegistrationResponse>(cancellationToken: ct);
        return result ?? new CloudDeviceRegistrationResponse { Registered = true };
    }

    private static async Task HeartbeatAsync(
        HttpClient http,
        string apiBase,
        CancellationToken ct)
    {
        var endpoint = $"{apiBase}/devices/heartbeat/";
        var payload = new
        {
            status = "online",
            printer_status = new
            {
                os = "windows",
                at = DateTime.UtcNow,
            }
        };

        using var response = await http.PostAsJsonAsync(endpoint, payload, ct);
        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            throw new DeviceUnauthorizedException();
        }
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"Heartbeat failed {(int)response.StatusCode}: {body}");
        }

        // Log device_id returned by backend so operator can confirm the right device is active
        try
        {
            var result = await response.Content.ReadFromJsonAsync<HeartbeatResult>(cancellationToken: ct);
            if (result?.DeviceId is not null)
            {
                RuntimeCloudState.SetDeviceId(result.DeviceId);
            }
        }
        catch { /* ignore JSON parse errors on heartbeat result */ }
    }

    private static List<string> GetInstalledPrinters()
    {
        var printers = new List<string>();
        if (!OperatingSystem.IsWindows())
        {
            return printers;
        }

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (string printer in System.Drawing.Printing.PrinterSettings.InstalledPrinters)
        {
            var name = (printer ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(name) || !seen.Add(name))
            {
                continue;
            }
            printers.Add(name);
        }

        return printers;
    }

    private static async Task SyncInstalledPrintersAsync(
        HttpClient http,
        string apiBase,
        string deviceId,
        CancellationToken ct)
    {
        var endpoint = $"{apiBase}/devices/sync-printers/";
        var printers = GetInstalledPrinters();
        var payload = new
        {
            device_id = deviceId,
            printers,
        };

        using var response = await http.PostAsJsonAsync(endpoint, payload, ct);
        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            throw new DeviceUnauthorizedException();
        }
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"Sync printers failed {(int)response.StatusCode}: {body}");
        }

        Console.WriteLine($"[CloudPoller] Printer sync OK. device={deviceId} count={printers.Count}");
    }

    private sealed class HeartbeatResult
    {
        [JsonPropertyName("device_id")]
        public string? DeviceId { get; set; }

        [JsonPropertyName("last_seen_at")]
        public string? LastSeenAt { get; set; }
    }

    private static async Task<DevicePairingRequestResponse> RequestPairingCodeAsync(
        HttpClient http,
        string apiBase,
        CloudOptions cloud,
        string channel,
        string deviceId,
        CancellationToken ct)
    {
        int? outletId = null;
        if (int.TryParse((cloud.OutletId ?? string.Empty).Trim(), out var parsedOutletId))
        {
            outletId = parsedOutletId;
        }

        int? tenantId = null;
        if (int.TryParse((cloud.TenantId ?? string.Empty).Trim(), out var parsedTenantId))
        {
            tenantId = parsedTenantId;
        }

        var endpoint = $"{apiBase}/devices/pairing/request/";
        var payload = new
        {
            device_id = deviceId,
            name = Environment.MachineName,
            channel,
            outlet_id = outletId,
            tenant_id = tenantId,
            printer_identifier = (cloud.DefaultPrinter ?? string.Empty).Trim(),
        };

        using var response = await http.PostAsJsonAsync(endpoint, payload, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"Pairing request failed {(int)response.StatusCode}: {body}");
        }

        var result = await response.Content.ReadFromJsonAsync<DevicePairingRequestResponse>(cancellationToken: ct);
        if (result is null || string.IsNullOrWhiteSpace(result.PairingCode))
        {
            throw new InvalidOperationException("Pairing request did not return a valid pairing code.");
        }
        return result;
    }

    private static async Task<DevicePairingStatusResponse?> PollPairingStatusAsync(
        HttpClient http,
        string apiBase,
        CloudOptions cloud,
        string deviceId,
        string pairingCode,
        CancellationToken ct)
    {
        var endpoint = $"{apiBase}/devices/pairing/status/";
        var payload = new
        {
            device_id = deviceId,
            pairing_code = pairingCode,
        };

        using var response = await http.PostAsJsonAsync(endpoint, payload, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"Pairing status failed {(int)response.StatusCode}: {body}");
        }

        return await response.Content.ReadFromJsonAsync<DevicePairingStatusResponse>(cancellationToken: ct);
    }

    private static async Task CompleteAsync(
        HttpClient http,
        string apiBase,
        int jobId,
        string result,
        string errorMessage,
        CancellationToken ct)
    {
        var endpoint = $"{apiBase}/print-jobs/{jobId}/complete/";
        var payload = new { result, error_message = errorMessage };
        using var response = await http.PostAsJsonAsync(endpoint, payload, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"Complete failed {(int)response.StatusCode}: {body}");
        }
    }

    private static string NormalizePrinterType(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return normalized is "receipt" or "kitchen" or "bar" ? normalized : "receipt";
    }

    private static void SetBearer(HttpClient http, string token)
    {
        http.DefaultRequestHeaders.Remove("X-Device-API-Key");
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    private static void SetDeviceApiKey(HttpClient http, string apiKey)
    {
        http.DefaultRequestHeaders.Authorization = null;
        http.DefaultRequestHeaders.Remove("X-Device-API-Key");
        http.DefaultRequestHeaders.Add("X-Device-API-Key", apiKey);
    }

    private static void ClearDeviceApiKey(HttpClient http)
    {
        http.DefaultRequestHeaders.Authorization = null;
        http.DefaultRequestHeaders.Remove("X-Device-API-Key");
    }
}

static class CloudPairingBridge
{
    public static HttpClient CreateHttpClient(CloudOptions cloud)
    {
        var http = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(20),
        };

        if (!string.IsNullOrWhiteSpace(cloud.TenantId))
        {
            http.DefaultRequestHeaders.Add("X-Tenant-ID", cloud.TenantId.Trim());
        }
        if (!string.IsNullOrWhiteSpace(cloud.OutletId))
        {
            http.DefaultRequestHeaders.Add("X-Outlet-ID", cloud.OutletId.Trim());
        }

        return http;
    }

    public static CloudOptions WithOverrides(CloudOptions source, LocalPairingStartRequest request)
    {
        return new CloudOptions
        {
            Enabled = source.Enabled,
            ApiBaseUrl = source.ApiBaseUrl,
            DeviceApiKey = source.DeviceApiKey,
            AuthToken = source.AuthToken,
            TenantId = string.IsNullOrWhiteSpace(request.TenantId) ? source.TenantId : request.TenantId,
            OutletId = string.IsNullOrWhiteSpace(request.OutletId) ? source.OutletId : request.OutletId,
            DeviceId = string.IsNullOrWhiteSpace(request.DeviceId) ? source.DeviceId : request.DeviceId,
            PrinterType = source.PrinterType,
            Channel = string.IsNullOrWhiteSpace(request.Channel) ? source.Channel : request.Channel,
            PollIntervalSeconds = source.PollIntervalSeconds,
            DefaultPrinter = string.IsNullOrWhiteSpace(request.PrinterIdentifier) ? source.DefaultPrinter : request.PrinterIdentifier,
        };
    }

    public static Task<DevicePairingRequestResponse> RequestPairingCodeAsync(
        HttpClient http,
        string apiBase,
        CloudOptions cloud,
        string channel,
        string deviceId,
        CancellationToken ct)
    {
        return CloudPollerRequestPairingCode(http, apiBase, cloud, channel, deviceId, ct);
    }

    private static async Task<DevicePairingRequestResponse> CloudPollerRequestPairingCode(
        HttpClient http,
        string apiBase,
        CloudOptions cloud,
        string channel,
        string deviceId,
        CancellationToken ct)
    {
        var endpoint = $"{apiBase}/devices/pairing/request/";
        var payload = new
        {
            device_id = deviceId,
            name = Environment.MachineName,
            channel,
            printer_identifier = (cloud.DefaultPrinter ?? string.Empty).Trim(),
        };

        using var response = await http.PostAsJsonAsync(endpoint, payload, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"Pairing request failed {(int)response.StatusCode}: {body}");
        }

        var result = await response.Content.ReadFromJsonAsync<DevicePairingRequestResponse>(cancellationToken: ct);
        if (result is null || string.IsNullOrWhiteSpace(result.PairingCode))
        {
            throw new InvalidOperationException("Pairing request did not return a valid pairing code.");
        }
        return result;
    }
}

static class RuntimeCloudState
{
    private static readonly object Sync = new();
    private static string _deviceApiKey = string.Empty;
    private static string _deviceId = string.Empty;
    private static string _pairingCode = string.Empty;
    private static DateTime? _expiresAt;

    public static string GetDeviceApiKey()
    {
        lock (Sync)
        {
            return _deviceApiKey;
        }
    }

    public static void SetDeviceApiKey(string apiKey)
    {
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return;
        }

        lock (Sync)
        {
            _deviceApiKey = apiKey.Trim();
        }
    }

    public static void SetPairing(string deviceId, string pairingCode, DateTime? expiresAt)
    {
        lock (Sync)
        {
            _deviceId = deviceId;
            _pairingCode = pairingCode;
            _expiresAt = expiresAt;
        }
    }

    public static string GetDeviceId()
    {
        lock (Sync)
        {
            return _deviceId;
        }
    }

    public static void SetDeviceId(string deviceId)
    {
        if (string.IsNullOrWhiteSpace(deviceId))
        {
            return;
        }

        lock (Sync)
        {
            _deviceId = deviceId.Trim();
        }
    }

    public static void ClearApiKey()
    {
        lock (Sync)
        {
            _deviceApiKey = string.Empty;
        }
    }

    public static object GetSnapshot()
    {
        lock (Sync)
        {
            return new
            {
                has_api_key = !string.IsNullOrWhiteSpace(_deviceApiKey),
                device_id = _deviceId,
                pairing_code = _pairingCode,
                expires_at = _expiresAt,
            };
        }
    }
}

/// <summary>
/// Persists the device API key to a local file so it survives connector restarts.
/// Stored in %USERPROFILE%\.primepos\connector_key.dat (or ~/.primepos/ on Linux).
/// </summary>
static class ApiKeyStore
{
    private static string StorePath()
    {
        var folder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".primepos");
        Directory.CreateDirectory(folder);
        return Path.Combine(folder, "connector_key.dat");
    }

    public static string? Load()
    {
        try
        {
            var path = StorePath();
            if (!File.Exists(path)) return null;
            var key = File.ReadAllText(path).Trim();
            return string.IsNullOrWhiteSpace(key) ? null : key;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ApiKeyStore] Load warning: {ex.Message}");
            return null;
        }
    }

    public static void Save(string key)
    {
        try
        {
            File.WriteAllText(StorePath(), key.Trim());
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ApiKeyStore] Save warning: {ex.Message}");
        }
    }

    public static void Clear()
    {
        try
        {
            var path = StorePath();
            if (File.Exists(path)) File.Delete(path);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ApiKeyStore] Clear warning: {ex.Message}");
        }
    }
}

/// <summary>
/// Persists the connector device ID so the same identity survives restarts.
/// Stored in %USERPROFILE%\.primepos\connector_device_id.dat (or ~/.primepos/ on Linux).
/// </summary>
static class DeviceIdentityStore
{
    private static string StorePath()
    {
        var folder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".primepos");
        Directory.CreateDirectory(folder);
        return Path.Combine(folder, "connector_device_id.dat");
    }

    public static string? Load()
    {
        try
        {
            var path = StorePath();
            if (!File.Exists(path)) return null;
            var deviceId = File.ReadAllText(path).Trim();
            return string.IsNullOrWhiteSpace(deviceId) ? null : deviceId;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DeviceIdentityStore] Load warning: {ex.Message}");
            return null;
        }
    }

    public static void Save(string deviceId)
    {
        try
        {
            File.WriteAllText(StorePath(), deviceId.Trim());
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DeviceIdentityStore] Save warning: {ex.Message}");
        }
    }
}

/// <summary>Thrown when the backend responds with 401 — device must re-pair.</summary>
sealed class DeviceUnauthorizedException : Exception
{
    public DeviceUnauthorizedException()
        : base("Device API key rejected (401). Connector will re-initiate pairing.") { }
}

/// <summary>Helper to display pairing code in a Windows GUI dialog.</summary>
static class PairingDialogHelper
{
    private static bool _dialogShown = false;
    
    public static void ShowPairingCodeDialog(string pairingCode)
    {
        try
        {
            // Prevent multiple dialogs from stacking up
            if (_dialogShown)
                return;

            _dialogShown = true;

            // Create a form for the pairing code display
            var form = new Form
            {
                Text = "PrimePOS Connector - Pairing Code",
                Width = 450,
                Height = 250,
                StartPosition = FormStartPosition.CenterScreen,
                TopMost = true,
                FormBorderStyle = FormBorderStyle.FixedDialog,
                MaximizeBox = false,
                MinimizeBox = false
            };

            // Title label
            var titleLabel = new Label
            {
                Text = "Cloud Pairing Code Ready",
                Font = new Font("Segoe UI", 14, FontStyle.Bold),
                Location = new Point(15, 15),
                Size = new Size(410, 30),
                AutoSize = false
            };
            form.Controls.Add(titleLabel);

            // Instructions label
            var instructLabel = new Label
            {
                Text = "Enter this code in your cloud frontend to pair this connector:",
                Font = new Font("Segoe UI", 10),
                Location = new Point(15, 50),
                Size = new Size(410, 40),
                AutoSize = false
            };
            form.Controls.Add(instructLabel);

            // Code display (large, bold, centered)
            var codeLabel = new Label
            {
                Text = pairingCode,
                Font = new Font("Courier New", 24, FontStyle.Bold),
                Location = new Point(15, 95),
                Size = new Size(410, 50),
                TextAlign = ContentAlignment.MiddleCenter,
                BackColor = Color.LightGray,
                BorderStyle = BorderStyle.FixedSingle
            };
            form.Controls.Add(codeLabel);

            // Expiry info label
            var expiryLabel = new Label
            {
                Text = "Code expires in 15 minutes. Keep this connector running.",
                Font = new Font("Segoe UI", 9, FontStyle.Italic),
                Location = new Point(15, 155),
                Size = new Size(410, 30),
                AutoSize = false,
                ForeColor = Color.DarkGray
            };
            form.Controls.Add(expiryLabel);

            // Close button
            var closeButton = new Button
            {
                Text = "Got It",
                Location = new Point(175, 190),
                Size = new Size(100, 40),
                DialogResult = DialogResult.OK
            };
            form.Controls.Add(closeButton);
            form.AcceptButton = closeButton;

            // Show the dialog
            form.ShowDialog();

            _dialogShown = false;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[PairingDialog] Failed to show dialog: {ex.Message}");
            _dialogShown = false;
        }
    }
}

static class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    private class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)]
        public string? pDocName;
        [MarshalAs(UnmanagedType.LPStr)]
        public string? pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)]
        public string? pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
    private static extern bool OpenPrinter(string szPrinter, out nint hPrinter, nint pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true)]
    private static extern bool ClosePrinter(nint hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
    private static extern bool StartDocPrinter(nint hPrinter, int level, [In] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true)]
    private static extern bool EndDocPrinter(nint hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true)]
    private static extern bool StartPagePrinter(nint hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true)]
    private static extern bool EndPagePrinter(nint hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true)]
    private static extern bool WritePrinter(nint hPrinter, nint pBytes, int dwCount, out int dwWritten);

    public static bool SendBytesToPrinter(string printerName, string jobName, byte[] bytes)
    {
        if (!OpenPrinter(printerName, out var hPrinter, nint.Zero))
        {
            return false;
        }

        var docInfo = new DOCINFOA
        {
            pDocName = jobName,
            pDataType = "RAW"
        };

        var success = false;
        try
        {
            if (!StartDocPrinter(hPrinter, 1, docInfo))
            {
                return false;
            }

            if (!StartPagePrinter(hPrinter))
            {
                EndDocPrinter(hPrinter);
                return false;
            }

            var unmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
            try
            {
                Marshal.Copy(bytes, 0, unmanagedBytes, bytes.Length);
                success = WritePrinter(hPrinter, unmanagedBytes, bytes.Length, out _);
            }
            finally
            {
                Marshal.FreeCoTaskMem(unmanagedBytes);
                EndPagePrinter(hPrinter);
                EndDocPrinter(hPrinter);
            }
        }
        finally
        {
            ClosePrinter(hPrinter);
        }

        return success;
    }
}
