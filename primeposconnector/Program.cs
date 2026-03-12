using System.Runtime.InteropServices;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<AgentOptions>(builder.Configuration);
builder.Services.AddCors(options =>
{
    options.AddPolicy("LocalFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://127.0.0.1:3000")
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
    public string? AuthToken { get; set; }
    public string? TenantId { get; set; }
    public string? OutletId { get; set; }
    public string? DeviceId { get; set; }
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
    public int Id { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Printer_Identifier { get; set; } = string.Empty;
    public CloudPrintPayload? Payload { get; set; }
}

sealed class CloudPrintPayload
{
    public string Content_Base64 { get; set; } = string.Empty;
    public string Receipt_Number { get; set; } = string.Empty;
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
        var authToken = (cloud.AuthToken ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(apiBase) || string.IsNullOrWhiteSpace(authToken))
        {
            Console.WriteLine("[CloudPoller] Cloud enabled but ApiBaseUrl/AuthToken is missing.");
            return;
        }

        var channel = string.IsNullOrWhiteSpace(cloud.Channel) ? "agent" : cloud.Channel.Trim().ToLowerInvariant();
        var deviceId = string.IsNullOrWhiteSpace(cloud.DeviceId) ? Environment.MachineName : cloud.DeviceId.Trim();
        var pollSeconds = cloud.PollIntervalSeconds <= 0 ? 2 : cloud.PollIntervalSeconds;

        using var http = new HttpClient();
        http.Timeout = TimeSpan.FromSeconds(20);
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", authToken);
        if (!string.IsNullOrWhiteSpace(cloud.TenantId))
        {
            http.DefaultRequestHeaders.Add("X-Tenant-ID", cloud.TenantId.Trim());
        }
        if (!string.IsNullOrWhiteSpace(cloud.OutletId))
        {
            http.DefaultRequestHeaders.Add("X-Outlet-ID", cloud.OutletId.Trim());
        }

        Console.WriteLine($"[CloudPoller] Running. api={apiBase} channel={channel} device={deviceId}");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var claimed = await ClaimNextAsync(http, apiBase, channel, deviceId, stoppingToken);
                if (claimed is null)
                {
                    await Task.Delay(TimeSpan.FromSeconds(pollSeconds), stoppingToken);
                    continue;
                }

                var contentBase64 = (claimed.Payload?.Content_Base64 ?? string.Empty).Trim();
                var printerName = (claimed.Printer_Identifier ?? string.Empty).Trim();
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

                var jobName = string.IsNullOrWhiteSpace(claimed.Payload?.Receipt_Number)
                    ? "PrimePOS Receipt"
                    : $"PrimePOS Receipt {claimed.Payload.Receipt_Number}";

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
        CancellationToken ct)
    {
        var endpoint = $"{apiBase}/print-jobs/claim-next/";
        var payload = new { channel, device_id = deviceId };
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
