using System.Runtime.InteropServices;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

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
        var deviceApiKey = (cloud.DeviceApiKey ?? string.Empty).Trim();
        var channel = string.IsNullOrWhiteSpace(cloud.Channel) ? "agent" : cloud.Channel.Trim().ToLowerInvariant();
        var deviceId = string.IsNullOrWhiteSpace(cloud.DeviceId) ? Environment.MachineName : cloud.DeviceId.Trim();
        var printerType = NormalizePrinterType(cloud.PrinterType);
        var pollSeconds = cloud.PollIntervalSeconds <= 0 ? 2 : cloud.PollIntervalSeconds;

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

        try
        {
            var registration = await RegisterDeviceAsync(http, apiBase, cloud, channel, deviceId, bootstrapToken, ct: stoppingToken);
            if (!string.IsNullOrWhiteSpace(registration.ApiKey))
            {
                deviceApiKey = registration.ApiKey.Trim();
                Console.WriteLine("[CloudPoller] Device API key received from registration.");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CloudPoller] Device registration warning: {ex.Message}");
        }

        if (string.IsNullOrWhiteSpace(deviceApiKey))
        {
            Console.WriteLine("[CloudPoller] Missing DeviceApiKey. Set Cloud:DeviceApiKey or provide bootstrap AuthToken for registration.");
            return;
        }

        SetBearer(http, deviceApiKey);

        var lastHeartbeatAt = DateTime.UtcNow;

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if ((DateTime.UtcNow - lastHeartbeatAt).TotalSeconds >= 30)
                {
                    try
                    {
                        await HeartbeatAsync(http, apiBase, stoppingToken);
                        lastHeartbeatAt = DateTime.UtcNow;
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[CloudPoller] Device heartbeat warning: {ex.Message}");
                    }
                }

                var claimed = await ClaimNextAsync(http, apiBase, channel, deviceId, printerType, stoppingToken);
                if (claimed is null)
                {
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

        int? tenantId = null;
        if (int.TryParse((cloud.TenantId ?? string.Empty).Trim(), out var parsedTenantId))
        {
            tenantId = parsedTenantId;
        }

        var endpoint = $"{apiBase}/print-jobs/register-device/";
        var payload = new
        {
            device_id = deviceId,
            channel,
            tenant_id = tenantId,
            outlet_id = outletId,
            printer_identifier = (cloud.DefaultPrinter ?? string.Empty).Trim(),
            name = Environment.MachineName,
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
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"Heartbeat failed {(int)response.StatusCode}: {body}");
        }
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
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
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
