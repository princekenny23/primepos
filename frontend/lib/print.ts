// Lightweight client-side print helper.
// Responsibilities:
// - Resolve printer for an outlet
// - Print directly through the local connector when browser is on localhost
// - Queue print jobs through backend when running from cloud hosts
// - Use mobile share flow on Android when selected

import { api, apiEndpoints } from "./api"

type ReceiptPayload = {
  cart: Array<{ name: string; price: number; quantity: number; total: number; sku?: string }>
  subtotal: number
  discount: number
  tax: number
  total: number
  sale: any // backend sale object (may contain outlet, business, payments, cashier, created_at, etc.)
}

const PRINT_CHANNEL_STORAGE_KEY = "printChannel"
const PRINT_DEVICE_ID_STORAGE_KEY = "printDeviceId"
const PA_HEARTBEAT_WINDOW_MS = 90_000
const LOCAL_PRINT_AGENT_URL =
  process.env.NEXT_PUBLIC_LOCAL_PRINT_AGENT_URL || "http://127.0.0.1:7310"
const LOCAL_PRINT_PROXY_BASE = "/api/local-print"
const LOCAL_PRINT_AGENT_TOKEN =
  process.env.NEXT_PUBLIC_LOCAL_PRINT_AGENT_TOKEN || ""

type PrintChannel = "auto" | "agent" | "bluetooth_usb_thermal_printer_plus"

type EscposPrintJob = {
  printerName: string
  contentBase64: string
  copies?: number
  jobName?: string
}

function buildAgentHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (LOCAL_PRINT_AGENT_TOKEN) {
    headers["X-Primepos-Token"] = LOCAL_PRINT_AGENT_TOKEN
  }
  return headers
}

function isAndroidMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent || ""
  return /android/i.test(ua)
}

function getPrintChannelPreference(): PrintChannel {
  if (typeof window === "undefined") return "auto"
  try {
    const saved = String(localStorage.getItem(PRINT_CHANNEL_STORAGE_KEY) || "auto").toLowerCase()
    if (saved === "agent" || saved === "bluetooth_usb_thermal_printer_plus" || saved === "auto") {
      return saved
    }
  } catch {
    // ignore localStorage failures
  }
  return "auto"
}

function shouldUseBluetoothUsbThermalPrinterPlus(channel: PrintChannel): boolean {
  if (channel === "bluetooth_usb_thermal_printer_plus") return true
  if (channel === "agent") return false
  return isAndroidMobileDevice()
}

function isLocalhostBrowser(): boolean {
  if (typeof window === "undefined") return false
  const host = String(window.location.hostname || "").toLowerCase()
  return host === "localhost" || host === "127.0.0.1" || host === "::1"
}

function getPrintDeviceId(): string {
  if (typeof window === "undefined") return ""
  try {
    const existing = String(localStorage.getItem(PRINT_DEVICE_ID_STORAGE_KEY) || "").trim()
    if (existing) return existing

    const generated =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `web-${crypto.randomUUID()}`
        : `web-${Date.now()}-${Math.floor(Math.random() * 1000000)}`

    localStorage.setItem(PRINT_DEVICE_ID_STORAGE_KEY, generated)
    return generated
  } catch {
    return ""
  }
}

function isLiveOutletConnector(device: any, outletId: number): boolean {
  const pk = String(device?.id || "").trim()
  const deviceId = String(device?.device_id || "").trim()
  if (!pk || !deviceId) return false

  const rawOutletId = typeof device?.outlet === "object" ? device?.outlet?.id : device?.outlet
  const deviceOutletId = Number(rawOutletId)
  if (!Number.isFinite(deviceOutletId) || deviceOutletId !== outletId) return false

  if (device?.is_active !== true) return false

  const lastSeenMs = device?.last_seen_at ? new Date(device.last_seen_at).getTime() : NaN
  return Number.isFinite(lastSeenMs) && Date.now() - lastSeenMs <= PA_HEARTBEAT_WINDOW_MS
}

async function resolveDeviceIdForOutlet(outletId: number | string): Promise<string> {
  try {
    const normalizedOutletId = Number(outletId)
    if (!Number.isFinite(normalizedOutletId)) return ""

    const devicesRaw: any = await api.get(`/devices/?outlet=${normalizedOutletId}&is_active=true`)
    const devices = Array.isArray(devicesRaw) ? devicesRaw : (devicesRaw.results || [])
    const firstActive = devices.find((device: any) => isLiveOutletConnector(device, normalizedOutletId))
    const resolvedDeviceId = String(firstActive?.device_id || "").trim()
    return resolvedDeviceId
  } catch {
    return ""
  }
}

async function agentFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = { ...buildAgentHeaders(), ...(init?.headers || {}) }
  const targets = [`${LOCAL_PRINT_PROXY_BASE}${path}`, `${LOCAL_PRINT_AGENT_URL}${path}`]
  let lastError: Error | null = null

  for (const url of targets) {
    try {
      const response = await fetch(url, { ...init, headers })
      if (!response.ok) {
        const body = await response.text().catch(() => "")
        console.error(`[Print Agent] ${path} failed:`, { status: response.status, body, url, headers })
        lastError = new Error(`Local Print Agent error (${response.status}): ${body || response.statusText}`)
        continue
      }
      return response
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Local Print Agent request failed")
    }
  }

  throw lastError || new Error("Local Print Agent is unavailable")
}

function escposBase64ToPrintableText(contentBase64: string): string {
  try {
    const binary = atob(contentBase64)
    // Strip common ESC/POS control bytes and preserve printable content/newlines.
    const stripped = binary
      .replace(/\x1b@/g, "")
      .replace(/\x1dV\x00/g, "")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    return stripped
  } catch {
    return ""
  }
}

async function getBackendEscposPayload(
  saleId: string,
  printerName?: string | null
): Promise<{ contentBase64: string; receiptNumber: string } | null> {
  try {
    const params = new URLSearchParams()
    params.set("paper_width", "auto")
    if (printerName) params.set("printer_name", printerName)
    const response: any = await api.get(`/sales/${saleId}/escpos-receipt/?${params.toString()}`)
    if (!response?.content) return null
    return {
      contentBase64: String(response.content),
      receiptNumber: String(response.receipt_number || saleId),
    }
  } catch {
    return null
  }
}

async function printViaBluetoothUsbThermalPrinterPlus(plainTextReceipt: string): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Bluetooth-USB Thermal Printer+ printing must be initiated from the browser")
  }

  // Bluetooth-USB Thermal Printer+ works reliably from the Android share sheet.
  const navAny = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
  if (typeof navAny.share === "function") {
    await navAny.share({
      title: "PrimePOS Receipt",
      text: plainTextReceipt,
    })
    return
  }

  // Fallback: copy to clipboard so user can paste into Bluetooth-USB Thermal Printer+.
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(plainTextReceipt)
    throw new Error("Receipt copied to clipboard. Open Bluetooth-USB Thermal Printer+ and paste to print.")
  }

  throw new Error("Share is not available on this device/browser.")
}

/**
 * Load available printers from backend records and optionally persist a chosen default.
 * - Returns an array of printer names.
 * - If `persistDefault` is true and printers exist, the first printer will be
 *   stored in localStorage under `defaultPrinter` (or you can call your own API
 *   to persist per-outlet default printer).
 */
export async function scanPrinters(persistDefault = true): Promise<string[]> {
  if (typeof window === "undefined") return []

  if (isLocalhostBrowser()) {
    try {
      console.log("[Print] Scanning printers from:", LOCAL_PRINT_AGENT_URL)
      const response = await agentFetch("/printers", { method: "GET" })
      const data = await response.json().catch(() => ({}))
      const printers: string[] = Array.isArray(data?.printers) ? data.printers : []
      const defaultPrinter = data?.default
      console.log("[Print] Found printers:", printers, "default:", defaultPrinter)
      if (Array.isArray(printers) && printers.length > 0 && persistDefault) {
        try {
          localStorage.setItem("defaultPrinter", defaultPrinter || printers[0])
          console.log("[Print] Saved default printer:", defaultPrinter || printers[0])
        } catch {
          // ignore localStorage errors
        }
      }
      return printers || []
    } catch (err) {
      console.error("[Print] Failed to scan local printers", err)
    }
  }

  try {
    const outletId = localStorage.getItem("currentOutletId")
    if (!outletId) return []
    const response: any = await api.get(`${apiEndpoints.printers.list}?outlet=${outletId}`)
    const list = Array.isArray(response) ? response : (response.results || [])
    const printers: string[] = list
      .map((p: any) => String(p.identifier || p.name || "").trim())
      .filter(Boolean)
    const defaultPrinter = list.find((p: any) => p.is_default || p.isDefault)
    const resolvedDefault = defaultPrinter ? String(defaultPrinter.identifier || defaultPrinter.name) : printers[0]
    console.log("[Print] Loaded backend printers:", printers, "default:", resolvedDefault)
    if (Array.isArray(printers) && printers.length > 0 && persistDefault) {
      try {
        localStorage.setItem("defaultPrinter", resolvedDefault || printers[0])
        console.log("[Print] Saved default printer:", resolvedDefault || printers[0])
      } catch {
        // ignore localStorage errors
      }
    }
    return printers || []
  } catch (err) {
    console.error("[Print] Failed to load backend printers", err)
    return []
  }
}

async function getDefaultPrinterNameForOutlet(outletId: number | string): Promise<string | null> {
  try {
    const response: any = await api.get(`${apiEndpoints.printers.list}?outlet=${outletId}`)
    const list = Array.isArray(response) ? response : (response.results || [])
    const def = list.find((p: any) => p.is_default || p.isDefault)
    if (def) return String(def.identifier || def.name)
    if (list.length > 0) return String(list[0].identifier || list[0].name)
  } catch (err) {
    // fallback to localStorage below
  }

  try {
    if (typeof window !== "undefined") {
      return localStorage.getItem("defaultPrinter")
    }
  } catch {
    // ignore localStorage errors
  }

  return null
}

function buildPlainTextReceipt(payload: ReceiptPayload): string {
  const sale = payload.sale || {}
  const lines: string[] = []
  const businessName =
    sale.business?.name || sale.outlet?.business?.name || sale.tenant?.name || "Business"
  const address = sale.outlet?.address || sale.business?.address || sale.tenant?.address || ""
  const date = sale.created_at || new Date().toLocaleString()
  const cashier = sale.cashier?.name || sale.cashier_name || sale.created_by_name || "Cashier"

  lines.push(String(businessName).toUpperCase())
  if (address) lines.push(String(address))
  lines.push(`Receipt #: ${sale.receipt_number || sale.id || ""}`)
  lines.push(`Date: ${date}`)
  lines.push(`Cashier: ${cashier}`)
  lines.push("-----------------------------")

  payload.cart.forEach((item) => {
    lines.push(`${item.name} x${item.quantity}  ${item.total.toFixed(2)}`)
  })

  lines.push("-----------------------------")
  lines.push(`Subtotal: ${payload.subtotal.toFixed(2)}`)
  if (payload.tax > 0) lines.push(`Tax: ${payload.tax.toFixed(2)}`)
  if (payload.discount > 0) lines.push(`Discount: -${payload.discount.toFixed(2)}`)
  lines.push(`Total: ${payload.total.toFixed(2)}`)
  lines.push("Thank you for your business!")

  return lines.join("\n")
}

/**
 * Print a receipt using the Local Print Agent.
 *
 * Behavior:
 *  - Prefer backend-generated ESC/POS receipt payload as the single source of truth.
 *  - Mobile and Local Print Agent both reuse that same backend payload.
 *  - If backend payload is unavailable, fall back to client plain-text receipt.
 *
 * Safety:
 *  - Preserves printer resolution logic; local agent handles physical printing.
 */
export async function printReceipt(payload: ReceiptPayload, outletId?: number | string): Promise<void> {
  if (typeof window === "undefined") throw new Error("Printing must be initiated from the browser")
  const channel = getPrintChannelPreference()
  const useMobileFlow = shouldUseBluetoothUsbThermalPrinterPlus(channel)
  const isOfflineBrowser = typeof navigator !== "undefined" && navigator.onLine === false
  const shouldUseDirectLocalAgent = !useMobileFlow && (isLocalhostBrowser() || isOfflineBrowser)
  const shouldQueueForLocalAgent = !useMobileFlow && !shouldUseDirectLocalAgent

  const resolvedOutletId =
    outletId ??
    payload?.sale?.outlet?.id ??
    payload?.sale?.outlet_id ??
    payload?.sale?.outlet

  const saleId = String(payload?.sale?.id || "").trim()

  // Agent path: always enqueue in backend so connector claims and prints.
  if (shouldQueueForLocalAgent) {
    if (!saleId) {
      throw new Error("Cannot queue print job: missing sale ID")
    }

    const printerName = resolvedOutletId
      ? await getDefaultPrinterNameForOutlet(resolvedOutletId)
      : (typeof window !== "undefined" ? localStorage.getItem("defaultPrinter") : null)

    const resolvedDeviceId = resolvedOutletId ? await resolveDeviceIdForOutlet(resolvedOutletId) : ""

    const queued: any = await api.post(`/sales/${saleId}/enqueue-print/`, {
      channel: "agent",
      printer_name: printerName || "",
      device_id: resolvedDeviceId,
      paper_width: "auto",
    })

    console.log("[Print] Enqueued print job:", {
      saleId,
      printJobId: queued?.print_job_id,
      status: queued?.status,
      receiptNumber: queued?.receipt_number,
    })
    return
  }

  let printerName: string | null = null
  if (shouldUseDirectLocalAgent) {
    printerName = resolvedOutletId
      ? await getDefaultPrinterNameForOutlet(resolvedOutletId)
      : (typeof window !== "undefined" ? localStorage.getItem("defaultPrinter") : null)

    if (!printerName) {
      const found = await scanPrinters(true)
      if (found && found.length > 0) {
        printerName = found[0]
      }
    }

    if (!printerName) {
      throw new Error(`[Print] No printer found. Check printer settings or ensure Local Print Agent is reachable at ${LOCAL_PRINT_AGENT_URL}`)
    }
  }

  let receiptNumber = String(payload?.sale?.receipt_number || payload?.sale?.id || "")
  let contentBase64 = ""

  if (saleId) {
    const backendEscpos = await getBackendEscposPayload(saleId, null)
    if (backendEscpos?.contentBase64) {
      contentBase64 = backendEscpos.contentBase64
      receiptNumber = backendEscpos.receiptNumber
    }
  }

  if (!contentBase64) {
    const plainTextReceipt = buildPlainTextReceipt(payload)
    // Proper UTF-8 to base64 encoding (avoids deprecated unescape)
    const encoder = new TextEncoder()
    const data = encoder.encode(plainTextReceipt)
    let binary = ""
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i])
    }
    contentBase64 = btoa(binary)
  }

  if (useMobileFlow) {
    console.log("[Print] Sending receipt to Bluetooth-USB Thermal Printer+:", { channel })
    const printableText = escposBase64ToPrintableText(contentBase64) || buildPlainTextReceipt(payload)
    await printViaBluetoothUsbThermalPrinterPlus(printableText)
    return
  }

  const job: EscposPrintJob = {
    printerName: printerName || "",
    contentBase64,
    jobName: receiptNumber ? `PrimePOS Receipt ${receiptNumber}` : "PrimePOS Receipt",
  }

  console.log("[Print] Sending print job to agent:", {
    url: LOCAL_PRINT_AGENT_URL,
    printer: job.printerName,
    jobName: job.jobName,
    contentLength: job.contentBase64.length,
  })

  await agentFetch("/print", {
    method: "POST",
    body: JSON.stringify(job),
  })
}

export default printReceipt

/**
 * Open the receipts settings page in a new tab so admins can quickly edit templates/tenant name.
 * (This helper is UI convenience only and does not change backend behavior.)
 */
export function openReceiptSettings(): void {
  if (typeof window === "undefined") return
  try {
    const origin = window.location ? window.location.origin : ""
    const url = `${origin}/dashboard/settings/receipts`
    window.open(url, "_blank")
  } catch (e) {
    // ignore any navigation errors
  }
}
