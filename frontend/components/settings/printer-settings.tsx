"use client"

import { useEffect, useMemo, useState } from "react"
import { api, apiEndpoints } from "@/lib/api"
import { useBusinessStore } from "@/stores/businessStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"


const LOCAL_PRINT_PROXY_BASE = "/api/local-print"
const LOCAL_PRINT_AGENT_URL =
  process.env.NEXT_PUBLIC_LOCAL_PRINT_AGENT_URL || "http://127.0.0.1:7310"
const LOCAL_PRINT_AGENT_TOKEN =
  process.env.NEXT_PUBLIC_LOCAL_PRINT_AGENT_TOKEN || ""
const PRINT_CHANNEL_STORAGE_KEY = "printChannel"
const PRINT_DEVICE_ID_STORAGE_KEY = "printDeviceId"
const PRINT_DEVICE_API_KEY_STORAGE_PREFIX = "printDeviceApiKey"
const PRINT_DEVICE_PK_STORAGE_PREFIX = "printDevicePk"
type PrintChannel = "auto" | "agent" | "bluetooth_usb_thermal_printer_plus"

function encodeTextToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ""
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

function getOrCreatePrintDeviceId(): string {
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

async function agentFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (LOCAL_PRINT_AGENT_TOKEN) {
    headers["X-Primepos-Token"] = LOCAL_PRINT_AGENT_TOKEN
  }
  const url = `${LOCAL_PRINT_PROXY_BASE}${path}`
  console.log("[Printer Settings] Calling agent:", { url, method: init?.method || "GET" })
  const response = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init?.headers || {}) },
  })
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    console.error("[Printer Settings] Agent error:", { status: response.status, url, body })
    throw new Error(`Agent error (${response.status}): ${body || response.statusText}`)
  }
  return response
}

export function PrinterSettings() {
  const { toast } = useToast()
  const isLocalHost = typeof window !== "undefined"
    ? ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
    : false
  const [printChannel, setPrintChannel] = useState<PrintChannel>("auto")
  const [connected, setConnected] = useState(false)
  const [printers, setPrinters] = useState<string[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState<string>("")
  const [isScanning, setIsScanning] = useState(false)
  const [manualPrinter, setManualPrinter] = useState("")
  const [deviceApiKey, setDeviceApiKey] = useState("")
  const [pairedDevicePk, setPairedDevicePk] = useState<string>("")
  const [pairingCode, setPairingCode] = useState("")
  const [rawOutputVisible, setRawOutputVisible] = useState(false)
  const [rawPrinters, setRawPrinters] = useState<any>(null)
  const [extraPrinters, setExtraPrinters] = useState<string[]>([])
  const mergedPrinters = useMemo(
    () => Array.from(new Set([...(printers || []), ...extraPrinters])),
    [printers, extraPrinters]
  )

  useEffect(() => {
    try {
      const saved = String(localStorage.getItem(PRINT_CHANNEL_STORAGE_KEY) || "auto").toLowerCase()
      if (saved === "agent" || saved === "bluetooth_usb_thermal_printer_plus" || saved === "auto") {
        setPrintChannel(saved)
      }
    } catch {
      // ignore localStorage failures
    }
  }, [])

  const savePrintChannel = (next: PrintChannel) => {
    setPrintChannel(next)
    try {
      localStorage.setItem(PRINT_CHANNEL_STORAGE_KEY, next)
    } catch {
      // ignore localStorage failures
    }
    toast({
      title: "Print mode updated",
      description:
        next === "bluetooth_usb_thermal_printer_plus"
          ? "Receipts will open Android share for Bluetooth-USB Thermal Printer+."
          : next === "agent"
            ? "Receipts will always use the Local Print Agent."
            : "Auto mode enabled: Android uses Bluetooth-USB Thermal Printer+, desktop uses Local Print Agent.",
    })
  }

  useEffect(() => {
    if (!isLocalHost) {
      setConnected(false)
      return
    }

    const ping = async () => {
      try {
        await agentFetch("/health", { method: "GET" })
        setConnected(true)
      } catch {
        setConnected(false)
      }
    }
    ping()
  }, [])

  const connectAgent = async () => {
    if (!isLocalHost) {
      setConnected(false)
      toast({
        title: "Local agent unavailable on cloud",
        description: "Use the PrimePOS connector on your local machine for cloud auto-printing.",
      })
      return
    }

    try {
      await agentFetch("/health", { method: "GET" })
      setConnected(true)
      toast({ title: "Local agent connected", description: "Local Print Agent is running on this machine." })
    } catch (err: any) {
      setConnected(false)
      toast({ title: "Agent not reachable", description: err?.message || "Unable to reach Local Print Agent." , variant: "destructive"})
    }
  }

  const disconnectAgent = async () => {
    setConnected(false)
    toast({ title: "Disconnected", description: "Disconnected from Local Print Agent." })
  }

  const scanPrinters = async () => {
    if (!isLocalHost) {
      toast({
        title: "Printer scan unavailable on cloud",
        description: "Run this screen on localhost to scan local printers.",
      })
      return
    }

    setIsScanning(true)
    try {
      const response = await agentFetch("/printers", { method: "GET" })
      const data = await response.json().catch(() => ({}))
      const discovered: string[] = Array.isArray(data?.printers) ? data.printers : []
      setPrinters(discovered)
      const combined = Array.from(new Set([...(discovered || []), ...extraPrinters]))
      setRawPrinters(combined)
      if (data?.default && !selectedPrinter) {
        const next = String(data.default)
        setSelectedPrinter(next)
        if (currentOutlet && typeof window !== "undefined") {
          const outletId = typeof currentOutlet.id === "string" ? parseInt(currentOutlet.id, 10) : Number(currentOutlet.id)
          if (outletId) localStorage.setItem(getOutletStorageKey(outletId), next)
        }
      }
      toast({ title: "Printers discovered", description: `${combined.length} printers found` })
    } catch (err: any) {
      toast({ title: "Scan failed", description: (err && err.message) || String(err) })
    } finally {
      setIsScanning(false)
    }
  }

  const testPrint = async () => {
    if (!isLocalHost) {
      toast({
        title: "Local test print unavailable on cloud",
        description: "Cloud mode prints through connector queue, not /api/local-print.",
      })
      return
    }

    if (!selectedPrinter) {
      toast({ title: "No printer selected", description: "Select a printer to test-print." })
      return
    }
    try {
      const text = `TEST PRINT\n${new Date().toLocaleString()}\n\n`
      const contentBase64 = encodeTextToBase64(text)
      await agentFetch("/print", {
        method: "POST",
        body: JSON.stringify({
          printerName: selectedPrinter,
          contentBase64,
          jobName: "PrimePOS Test Print",
        }),
      })
      toast({ title: "Test print sent", description: `Sent test page to ${selectedPrinter}` })
    } catch (err: any) {
      console.error("Test print failed", err)
      toast({ title: "Test print failed", description: err?.message || String(err), variant: "destructive" })
    }
  }

  const testBluetoothUsbThermalPrinterPlus = async () => {
    try {
      const text = `PRIMEPOS BLUETOOTH-USB THERMAL PRINTER+ TEST\n${new Date().toLocaleString()}\n\n`
      const navAny = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
      if (typeof navAny.share === "function") {
        await navAny.share({
          title: "PrimePOS Receipt Test",
          text,
        })
        toast({ title: "Bluetooth-USB Thermal Printer+ test started", description: "Choose Bluetooth-USB Thermal Printer+ in the Android share sheet." })
        return
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        toast({ title: "Copied to clipboard", description: "Open Bluetooth-USB Thermal Printer+ and paste to print." })
        return
      }

      throw new Error("Share is not available on this device/browser.")
    } catch (err: any) {
      toast({
        title: "Bluetooth-USB Thermal Printer+ test failed",
        description: err?.message || "Could not open share. Make sure Bluetooth-USB Thermal Printer+ is installed.",
        variant: "destructive",
      })
    }
  }

  const addManualPrinter = () => {
    if (!manualPrinter) return
    const normalized = manualPrinter.trim()
    const merged = Array.from(new Set([...extraPrinters, normalized]))
    setExtraPrinters(merged)
    setManualPrinter("")
    toast({ title: "Printer added", description: `${normalized}` })
  }

  const { currentOutlet } = useBusinessStore()

  const getOutletStorageKey = (outletId?: number | string | null) =>
    outletId ? `defaultPrinter:${outletId}` : "defaultPrinter"

  const getDeviceApiKeyStorageKey = (outletId?: number | string | null) =>
    outletId ? `${PRINT_DEVICE_API_KEY_STORAGE_PREFIX}:${outletId}` : PRINT_DEVICE_API_KEY_STORAGE_PREFIX

  const getDevicePkStorageKey = (outletId?: number | string | null) =>
    outletId ? `${PRINT_DEVICE_PK_STORAGE_PREFIX}:${outletId}` : PRINT_DEVICE_PK_STORAGE_PREFIX

  const loadDefaultPrinter = async () => {
    if (!currentOutlet) return
    const outletId = typeof currentOutlet.id === "string" ? parseInt(currentOutlet.id, 10) : Number(currentOutlet.id)
    if (!outletId) return

    try {
      const existing: any = await api.get(`${apiEndpoints.printers.list}?outlet=${outletId}`)
      const printersList = Array.isArray(existing) ? existing : (existing.results || [])
      const def = printersList.find((p: any) => p.is_default || p.isDefault)
      const next = def ? String(def.identifier || def.name) : ""
      if (next) {
        setSelectedPrinter(next)
        if (typeof window !== "undefined") {
          localStorage.setItem(getOutletStorageKey(outletId), next)
        }
        return
      }
    } catch (err) {
      // Fall back to local storage below.
    }

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(getOutletStorageKey(outletId)) || localStorage.getItem("defaultPrinter") || ""
      if (stored) setSelectedPrinter(stored)
    }
  }

  useEffect(() => {
    loadDefaultPrinter()
  }, [currentOutlet])

  useEffect(() => {
    if (!currentOutlet || typeof window === "undefined") {
      setDeviceApiKey("")
      return
    }

    const outletId = typeof currentOutlet.id === "string" ? parseInt(currentOutlet.id, 10) : Number(currentOutlet.id)
    if (!outletId) {
      setDeviceApiKey("")
      return
    }

    const stored = localStorage.getItem(getDeviceApiKeyStorageKey(outletId)) || ""
    setDeviceApiKey(stored)

    const storedPk = localStorage.getItem(getDevicePkStorageKey(outletId)) || ""
    setPairedDevicePk(storedPk)
  }, [currentOutlet])

  const pairDeviceWithCode = async () => {
    if (!currentOutlet) {
      toast({ title: "No outlet", description: "Select an outlet before pairing device." })
      return
    }
    if (!pairingCode.trim()) {
      toast({ title: "Pairing code required", description: "Enter the 6-digit code shown by connector." })
      return
    }

    const outletId = typeof currentOutlet.id === "string" ? parseInt(currentOutlet.id, 10) : Number(currentOutlet.id)
    try {
      const payload: any = {
        pairing_code: pairingCode.trim(),
        outlet_id: outletId,
        printer_identifier: selectedPrinter || "",
      }

      const result: any = await api.post("/devices/pairing/claim/", payload)
      const apiKey = String(result?.api_key || "").trim()
      const devicePk = String(result?.device?.id || "").trim()

      if (apiKey) {
        setDeviceApiKey(apiKey)
        if (typeof window !== "undefined") {
          localStorage.setItem(getDeviceApiKeyStorageKey(outletId), apiKey)
        }
      }

      if (devicePk) {
        setPairedDevicePk(devicePk)
        if (typeof window !== "undefined") {
          localStorage.setItem(getDevicePkStorageKey(outletId), devicePk)
        }
      }

      setPairingCode("")
      toast({ title: "Device paired", description: "Connector API key has been issued for this outlet." })
    } catch (err: any) {
      toast({ title: "Pairing failed", description: err?.message || "Invalid/expired pairing code.", variant: "destructive" })
    }
  }

  const rotateDeviceApiKey = async () => {
    if (!pairedDevicePk) {
      toast({ title: "No paired device", description: "Pair this device first." })
      return
    }
    if (!currentOutlet) return

    const outletId = typeof currentOutlet.id === "string" ? parseInt(currentOutlet.id, 10) : Number(currentOutlet.id)
    try {
      const result: any = await api.post(`/devices/${pairedDevicePk}/rotate-api-key/`, {})
      const apiKey = String(result?.api_key || "").trim()
      if (apiKey) {
        setDeviceApiKey(apiKey)
        if (typeof window !== "undefined") {
          localStorage.setItem(getDeviceApiKeyStorageKey(outletId), apiKey)
        }
      }
      toast({ title: "API key rotated", description: "Update connector Cloud.DeviceApiKey with the new key." })
    } catch (err: any) {
      toast({ title: "Rotation failed", description: err?.message || "Unable to rotate API key.", variant: "destructive" })
    }
  }

  const revokeDeviceApiKey = async () => {
    if (!pairedDevicePk) {
      toast({ title: "No paired device", description: "Pair this device first." })
      return
    }
    if (!currentOutlet) return

    const outletId = typeof currentOutlet.id === "string" ? parseInt(currentOutlet.id, 10) : Number(currentOutlet.id)
    try {
      await api.post(`/devices/${pairedDevicePk}/revoke-api-key/`, {})
      setDeviceApiKey("")
      if (typeof window !== "undefined") {
        localStorage.removeItem(getDeviceApiKeyStorageKey(outletId))
      }
      toast({ title: "API key revoked", description: "Compromised key disabled. Pair or rotate to issue a new one." })
    } catch (err: any) {
      toast({ title: "Revoke failed", description: err?.message || "Unable to revoke API key.", variant: "destructive" })
    }
  }

  const saveSelection = async () => {
    if (!selectedPrinter) {
      toast({ title: "No printer selected", description: "Please choose a printer before saving." })
      return
    }

    if (!currentOutlet) {
      toast({ title: "No outlet", description: "Please select an outlet before saving printer settings." })
      return
    }

    try {
      // Check existing printers for this outlet
      const outletId = typeof currentOutlet.id === 'string' ? parseInt(currentOutlet.id, 10) : Number(currentOutlet.id)
      const existing: any = await api.get(`${apiEndpoints.printers.list}?outlet=${outletId}`)
      const printersList = Array.isArray(existing) ? existing : (existing.results || [])
      const match = printersList.find((p: any) => String(p.identifier) === String(selectedPrinter))

      if (match) {
        // Update existing printer to be default
        await api.patch(apiEndpoints.printers.update(String(match.id)), { is_default: true })
        toast({ title: "Printer updated", description: `Set ${selectedPrinter} as default for this outlet.` })
      } else {
        // Create new printer record
        await api.post(apiEndpoints.printers.create, {
          outlet_id: outletId,
          name: selectedPrinter,
          identifier: selectedPrinter,
          driver: "other",
          is_default: true,
        })
        toast({ title: "Printer saved", description: `Saved ${selectedPrinter} for this outlet.` })
      }
      if (typeof window !== "undefined") {
        localStorage.setItem(getOutletStorageKey(outletId), selectedPrinter)
      }

      if (pairedDevicePk) {
        try {
          const cloudPrinters: any = await api.get(`/cloud-printers/?outlet=${outletId}&device=${pairedDevicePk}`)
          const list = Array.isArray(cloudPrinters) ? cloudPrinters : (cloudPrinters.results || [])
          const existingCloud = list.find((p: any) => String(p.identifier || p.name) === String(selectedPrinter))

          if (existingCloud) {
            await api.patch(`/cloud-printers/${existingCloud.id}/`, {
              name: selectedPrinter,
              identifier: selectedPrinter,
              printer_type: "receipt",
              is_default: true,
              is_active: true,
            })
          } else {
            await api.post('/cloud-printers/', {
              outlet: outletId,
              device: Number(pairedDevicePk),
              name: selectedPrinter,
              identifier: selectedPrinter,
              printer_type: "receipt",
              connection_type: "usb",
              is_default: true,
              is_active: true,
            })
          }
          toast({ title: "Cloud printer assigned", description: `Assigned ${selectedPrinter} to paired connector device.` })
        } catch (assignmentErr: any) {
          toast({ title: "Device assignment warning", description: assignmentErr?.message || "Printer saved, but device assignment failed.", variant: "destructive" })
        }
      } else {
        toast({ title: "Pair device required", description: "Printer saved for outlet, but no connector device is paired yet." })
      }

      // Printer configuration intentionally stays separate from device pairing.
    } catch (err: any) {
      console.error("Error saving printer", err)
      toast({ title: "Save failed", description: err?.message || "Failed to save printer settings." })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Printer Setup (Local Print Agent)</CardTitle>
        <CardDescription>Connect to the Local Print Agent to discover local printers and select a default receipt printer.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded border p-3 text-sm space-y-2">
          <div className="font-medium">Local Agent Configuration</div>
          <div className="grid gap-2">
            <div className="space-y-1">
              <Label>Agent URL</Label>
              <Input value={LOCAL_PRINT_AGENT_URL} readOnly />
            </div>
            <div className="space-y-1">
              <Label>Agent Token</Label>
              <Input
                value={LOCAL_PRINT_AGENT_TOKEN ? "••••••••" : "Not set"}
                readOnly
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Set NEXT_PUBLIC_LOCAL_PRINT_AGENT_URL and NEXT_PUBLIC_LOCAL_PRINT_AGENT_TOKEN in your frontend environment.
          </p>
        </div>

        <div className="rounded border p-3 text-sm space-y-2">
          <div className="font-medium">Device Pairing</div>
          <p className="text-xs text-muted-foreground">
            Start connector without API key, copy the 6-digit pairing code from connector logs, and enter it here.
          </p>
          <div className="flex gap-2">
            <Input
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Enter 6-digit pairing code"
            />
            <Button onClick={pairDeviceWithCode}>Pair Device</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Pairing links this connector device to your outlet and issues a secure API key.
          </p>
        </div>

        <div className="rounded border p-3 text-sm space-y-2">
          <div className="font-medium">Cloud Connector API Key</div>
          <p className="text-xs text-muted-foreground">
            Use this value in Windows connector appsettings under Cloud.DeviceApiKey.
          </p>
          <Input
            value={deviceApiKey || "No API key issued yet. Save default printer to register this device."}
            readOnly
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!deviceApiKey) {
                  toast({ title: "No key", description: "Save default printer first to obtain API key." })
                  return
                }
                try {
                  await navigator.clipboard.writeText(deviceApiKey)
                  toast({ title: "Copied", description: "Device API key copied to clipboard." })
                } catch {
                  toast({ title: "Copy failed", description: "Unable to copy API key.", variant: "destructive" })
                }
              }}
            >
              Copy Key
            </Button>
            <Button variant="outline" size="sm" onClick={rotateDeviceApiKey}>
              Rotate Key
            </Button>
            <Button variant="outline" size="sm" onClick={revokeDeviceApiKey}>
              Revoke Key
            </Button>
          </div>
        </div>

        <div className="rounded border p-3 text-sm space-y-3">
          <div className="font-medium">Print Mode</div>
          <p className="text-xs text-muted-foreground">
            Auto mode uses Bluetooth-USB Thermal Printer+ on Android mobile and Local Print Agent on desktop.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant={printChannel === "auto" ? "default" : "outline"} onClick={() => savePrintChannel("auto")}>Auto</Button>
            <Button variant={printChannel === "agent" ? "default" : "outline"} onClick={() => savePrintChannel("agent")}>Agent Only</Button>
            <Button variant={printChannel === "bluetooth_usb_thermal_printer_plus" ? "default" : "outline"} onClick={() => savePrintChannel("bluetooth_usb_thermal_printer_plus")}>Bluetooth-USB Thermal Printer+</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            For mobile mode, install Bluetooth-USB Thermal Printer+ on Android and use it from the share sheet.
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={connectAgent} disabled={connected || !isLocalHost}>Connect Agent</Button>
          <Button variant="outline" onClick={disconnectAgent} disabled={!connected || !isLocalHost}>Disconnect</Button>
          <Button variant="ghost" onClick={scanPrinters} disabled={!connected || isScanning || !isLocalHost}>{isScanning ? "Scanning..." : "Scan Printers"}</Button>
        </div>

        <div className="space-y-2">
          <Label>Discovered Printers</Label>
          {printers.length === 0 && <p className="text-sm text-muted-foreground">No printers discovered yet.</p>}
          <div className="space-y-1">
            {mergedPrinters.map((p) => (
              <label key={p} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="printer"
                  value={p}
                  checked={selectedPrinter === p}
                  onChange={() => setSelectedPrinter(p)}
                  title={`Select printer: ${p}`}
                />
                <span className="truncate">{p}</span>
              </label>
            ))}
          </div>
          <div className="mt-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={rawOutputVisible} onChange={(e) => setRawOutputVisible(e.target.checked)} />
              <span className="text-sm">Show raw discovery output</span>
            </label>
            {rawOutputVisible && (
              <div className="mt-2 border rounded p-2 bg-muted">
                <pre className="text-xs max-h-40 overflow-auto">{JSON.stringify(rawPrinters, null, 2) || "[]"}</pre>
                <div className="flex justify-end mt-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    try {
                      navigator.clipboard.writeText(JSON.stringify(rawPrinters || [], null, 2))
                      toast({ title: "Copied", description: "Raw discovery output copied to clipboard." })
                    } catch (e) {
                      toast({ title: "Copy failed", description: "Unable to copy to clipboard." })
                    }
                  }}>Copy</Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="manual-printer">Add Manual Printer (IP or name)</Label>
          <div className="flex gap-2">
            <Input id="manual-printer" value={manualPrinter} onChange={(e) => setManualPrinter(e.target.value)} />
            <Button onClick={addManualPrinter}>Add</Button>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={testPrint} disabled={!selectedPrinter || !connected}>Test Agent Print</Button>
          <Button variant="outline" onClick={testBluetoothUsbThermalPrinterPlus}>Test Bluetooth-USB Thermal Printer+</Button>
          <Button onClick={saveSelection}>Save Default Printer</Button>
        </div>
      </CardContent>
    </Card>
  )
}
