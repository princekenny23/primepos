// Lightweight client-side print helper using the Local Print Agent
// Responsibilities:
// - Resolve printer for an outlet
// - Call local agent for printer discovery and ESC/POS printing
// - Prefer backend-generated ESC/POS payloads (base64) and print them raw

import { api, apiEndpoints } from "./api"

type ReceiptPayload = {
  cart: Array<{ name: string; price: number; quantity: number; total: number; sku?: string }>
  subtotal: number
  discount: number
  tax: number
  total: number
  sale: any // backend sale object (may contain outlet, business, payments, cashier, created_at, etc.)
}

const LOCAL_PRINT_AGENT_URL =
  process.env.NEXT_PUBLIC_LOCAL_PRINT_AGENT_URL || "http://127.0.0.1:7310"
const LOCAL_PRINT_PROXY_BASE = "/api/local-print"
const LOCAL_PRINT_AGENT_TOKEN =
  process.env.NEXT_PUBLIC_LOCAL_PRINT_AGENT_TOKEN || ""
const PRINT_CHANNEL_STORAGE_KEY = "printChannel"

type PrintChannel = "auto" | "agent" | "bluetooth_usb_thermal_printer_plus"

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

async function agentFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${LOCAL_PRINT_PROXY_BASE}${path}`
  const headers = { ...buildAgentHeaders(), ...(init?.headers || {}) }
  const response = await fetch(url, { ...init, headers })
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    console.error(`[Print Agent] ${path} failed:`, { status: response.status, body, url, headers })
    throw new Error(`Local Print Agent error (${response.status}): ${body || response.statusText}`)
  }
  return response
}

/**
 * Scan available printers using the Local Print Agent and optionally persist a chosen default.
 * - Returns an array of printer names.
 * - If `persistDefault` is true and printers exist, the first printer will be
 *   stored in localStorage under `defaultPrinter` (or you can call your own API
 *   to persist per-outlet default printer).
 */
export async function scanPrinters(persistDefault = true): Promise<string[]> {
  if (typeof window === "undefined") return []
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
    console.error("[Print] ❌ Failed to scan printers. Is the Local Print Agent running at", LOCAL_PRINT_AGENT_URL, "?", err)
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

type EscposPrintJob = {
  printerName: string
  contentBase64: string
  copies?: number
  jobName?: string
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
 *  - Build one shared receipt content payload for all channels.
 *  - Mobile and Local Print Agent both reuse the same receipt content.
 *
 * Safety:
 *  - Preserves printer resolution logic; local agent handles physical printing.
 */
export async function printReceipt(payload: ReceiptPayload, outletId?: number | string): Promise<void> {
  if (typeof window === "undefined") throw new Error("Printing must be initiated from the browser")
  const channel = getPrintChannelPreference()

  const resolvedOutletId =
    outletId ??
    payload?.sale?.outlet?.id ??
    payload?.sale?.outlet_id ??
    payload?.sale?.outlet

  if (resolvedOutletId && typeof window !== "undefined") {
    try {
      localStorage.setItem("currentOutletId", String(resolvedOutletId))
    } catch {
      // Ignore localStorage failures
    }
  }

  let printerName: string | null = null
  if (!shouldUseBluetoothUsbThermalPrinterPlus(channel)) {
    printerName = resolvedOutletId
      ? await getDefaultPrinterNameForOutlet(resolvedOutletId)
      : (typeof window !== "undefined" ? localStorage.getItem("defaultPrinter") : null)

    // If no printer configured, attempt a scan and persist the first found printer locally
    if (!printerName) {
      // Scan printers and automatically persist the first found as a default.
      const found = await scanPrinters(true)
      if (found && found.length > 0) {
        printerName = found[0]
      }
    }

    if (!printerName) {
      throw new Error("[Print] ❌ No printer found. Check printer settings or ensure Local Print Agent (/printers endpoint) is reachable at " + LOCAL_PRINT_AGENT_URL)
    }
  }

  const receiptNumber = String(payload?.sale?.receipt_number || payload?.sale?.id || "")
  const plainTextReceipt = buildPlainTextReceipt(payload)
  // Proper UTF-8 to base64 encoding (avoids deprecated unescape)
  const encoder = new TextEncoder()
  const data = encoder.encode(plainTextReceipt)
  let binary = ""
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i])
  }
  const contentBase64 = btoa(binary)

  const job: EscposPrintJob = {
    printerName: printerName || "MOBILE_APP",
    contentBase64: contentBase64,
    jobName: receiptNumber ? `PrimePOS Receipt ${receiptNumber}` : "PrimePOS Receipt",
  }

  if (shouldUseBluetoothUsbThermalPrinterPlus(channel)) {
    console.log("[Print] Sending receipt to Bluetooth-USB Thermal Printer+:", { channel })
    await printViaBluetoothUsbThermalPrinterPlus(plainTextReceipt)
    return
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
