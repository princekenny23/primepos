using System.Runtime.InteropServices;
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

app.MapPost("/print", async (HttpRequest request, PrintJob job) =>
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

app.Run();

sealed class AgentOptions
{
    public ServerOptions? Server { get; set; }
    public SecurityOptions? Security { get; set; }
}

sealed class ServerOptions
{
    public string? Url { get; set; }
}

sealed class SecurityOptions
{
    public string? Token { get; set; }
}

sealed class PrintJob
{
    public string PrinterName { get; set; } = string.Empty;
    public string ContentBase64 { get; set; } = string.Empty;
    public int Copies { get; set; } = 1;
    public string? JobName { get; set; }
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
