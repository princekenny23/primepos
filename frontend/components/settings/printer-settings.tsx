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

type WizardStep = 1 | 2 | 3

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

async function directAgentFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (LOCAL_PRINT_AGENT_TOKEN) {
    headers["X-Primepos-Token"] = LOCAL_PRINT_AGENT_TOKEN
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  const url = `${LOCAL_PRINT_AGENT_URL.replace(/\/$/, "")}${normalizedPath}`
  const response = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init?.headers || {}) },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Direct agent error (${response.status}): ${body || response.statusText}`)
  }

  return response
}

async function localAgentFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await agentFetch(path, init)
  } catch (proxyErr: any) {
    try {
      return await directAgentFetch(path, init)
    } catch (directErr: any) {
      const proxyMsg = proxyErr?.message || "proxy failed"
      const directMsg = directErr?.message || "direct failed"
      throw new Error(`Unable to reach local connector. ${proxyMsg}. ${directMsg}.`)
    }
  }
}

export function PrinterSettings() {
  const { toast } = useToast()
  const [printChannel, setPrintChannel] = useState<PrintChannel>("auto")
  const [connected, setConnected] = useState(false)
  const [step, setStep] = useState<WizardStep>(1)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [printers, setPrinters] = useState<string[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState<string>("")
  const [isScanning, setIsScanning] = useState(false)
  const [manualPrinter, setManualPrinter] = useState("")
  const [deviceApiKey, setDeviceApiKey] = useState("")
  const [pairedDevicePk, setPairedDevicePk] = useState<string>("")
  const [pairingCode, setPairingCode] = useState("")
  const [isAutoPairing, setIsAutoPairing] = useState(false)
  const [rawOutputVisible, setRawOutputVisible] = useState(false)
  const [rawPrinters, setRawPrinters] = useState<any>(null)
  const [extraPrinters, setExtraPrinters] = useState<string[]>([])
  const [lastAssignedOutletName, setLastAssignedOutletName] = useState("")
  const mergedPrinters = useMemo(
    () => Array.from(new Set([...(printers || []), ...extraPrinters])),
    [printers, extraPrinters]
  )

  const { currentOutlet, outlets, setCurrentOutlet } = useBusinessStore()
  const activeOutlets = useMemo(
    () => (outlets || []).filter((o) => o.isActive !== false),
    [outlets]
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
    const ping = async () => {
      try {
        await localAgentFetch("/health", { method: "GET" })
        setConnected(true)
        setStep((prev) => (prev < 2 ? 2 : prev))
      } catch {
        setConnected(false)
      }
    }
    ping()
  }, [])

  const connectAgent = async () => {
    setIsConnecting(true)
    try {
      await localAgentFetch("/health", { method: "GET" })
      setConnected(true)
      setStep((prev) => (prev < 2 ? 2 : prev))
      await autoPairCurrentConnector(true)
      await scanPrinters(true)
      toast({ title: "Connected", description: "Connector is online and ready for printer selection." })
    } catch (err: any) {
      setConnected(false)
      toast({ title: "Connection failed", description: err?.message || "Unable to reach local PrimePOS connector.", variant: "destructive" })
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectAgent = async () => {
    setConnected(false)
    toast({ title: "Disconnected", description: "Disconnected from Local Print Agent." })
  }

  const scanPrinters = async (silent = false) => {
    setIsScanning(true)
    try {
      const response = await localAgentFetch("/printers", { method: "GET" })
      const data = await response.json().catch(() => ({}))
      const discovered: string[] = Array.isArray(data?.printers) ? data.printers : []
      setPrinters(discovered)
      const combined = Array.from(new Set([...(discovered || []), ...extraPrinters]))
      setRawPrinters(combined)
      setStep((prev) => (prev < 3 ? 3 : prev))
      if (data?.default && !selectedPrinter) {
        const next = String(data.default)
        setSelectedPrinter(next)
        if (currentOutlet && typeof window !== "undefined") {
          const outletId = typeof currentOutlet.id === "string" ? parseInt(currentOutlet.id, 10) : Number(currentOutlet.id)
          if (outletId) localStorage.setItem(getOutletStorageKey(outletId), next)
        }
      }
      if (!silent) {
        toast({ title: "Printers found", description: `${combined.length} printer(s) discovered.` })
      }
    } catch (err: any) {
      toast({ title: "Search failed", description: (err && err.message) || String(err), variant: "destructive" })
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
      await localAgentFetch("/print", {
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

  const autoPairCurrentConnector = async (silent = false) => {
    if (!currentOutlet) {
      if (!silent) {
        toast({ title: "No outlet", description: "Select an outlet before pairing device." })
      }
      return
    }

    const outletId = typeof currentOutlet.id === "string" ? parseInt(currentOutlet.id, 10) : Number(currentOutlet.id)
    if (!outletId) {
      toast({ title: "Invalid outlet", description: "Select a valid outlet first." })
      return
    }

    setIsAutoPairing(true)
    try {
      const localStartResponse = await localAgentFetch("/cloud/pair/start", {
        method: "POST",
        body: JSON.stringify({
          outlet_id: String(outletId),
          printer_identifier: selectedPrinter || "",
        }),
      })
      const localStart = await localStartResponse.json().catch(() => ({}))
      const generatedPairingCode = String(localStart?.pairing_code || "").trim()

      if (!generatedPairingCode) {
        throw new Error("Connector did not return a pairing code.")
      }

      const claimPayload: any = {
        pairing_code: generatedPairingCode,
        outlet_id: outletId,
        printer_identifier: selectedPrinter || "",
      }

      const claimResult: any = await api.post("/devices/pairing/claim/", claimPayload)
      const apiKey = String(claimResult?.api_key || "").trim()
      const devicePk = String(claimResult?.device?.id || "").trim()

      if (!apiKey) {
        throw new Error("Pairing succeeded but no device API key was returned.")
      }

      await localAgentFetch("/cloud/pair/activate", {
        method: "POST",
        body: JSON.stringify({ api_key: apiKey }),
      })

      setDeviceApiKey(apiKey)
      if (typeof window !== "undefined") {
        localStorage.setItem(getDeviceApiKeyStorageKey(outletId), apiKey)
      }

      if (devicePk) {
        setPairedDevicePk(devicePk)
        if (typeof window !== "undefined") {
          localStorage.setItem(getDevicePkStorageKey(outletId), devicePk)
        }
      }

      setPairingCode("")
      if (!silent) {
        toast({ title: "Connector paired", description: "This connector is now paired to the current outlet." })
      }
    } catch (err: any) {
      if (!silent) {
        toast({ title: "Auto-pair failed", description: err?.message || "Unable to pair connector.", variant: "destructive" })
      }
    } finally {
      setIsAutoPairing(false)
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
      setIsSaving(true)
      // Check existing printers for this outlet
      const outletId = typeof currentOutlet.id === 'string' ? parseInt(currentOutlet.id, 10) : Number(currentOutlet.id)
      const existing: any = await api.get(`${apiEndpoints.printers.list}?outlet=${outletId}`)
      const printersList = Array.isArray(existing) ? existing : (existing.results || [])
      const match = printersList.find((p: any) => String(p.identifier) === String(selectedPrinter))

      if (match) {
        // Update existing printer to be default
        await api.patch(apiEndpoints.printers.update(String(match.id)), { is_default: true })
      } else {
        // Create new printer record
        await api.post(apiEndpoints.printers.create, {
          outlet_id: outletId,
          name: selectedPrinter,
          identifier: selectedPrinter,
          driver: "other",
          is_default: true,
        })
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
        } catch (assignmentErr: any) {
          toast({ title: "Device assignment warning", description: assignmentErr?.message || "Printer saved, but device assignment failed.", variant: "destructive" })
        }
      } else {
        toast({ title: "Pairing missing", description: "Printer saved for outlet, but connector is not paired yet.", variant: "destructive" })
      }

      setLastAssignedOutletName(currentOutlet.name)
      toast({ title: "Assigned", description: `${selectedPrinter} is now default for ${currentOutlet.name}.` })

      // Printer configuration intentionally stays separate from device pairing.
    } catch (err: any) {
      console.error("Error saving printer", err)
      toast({ title: "Save failed", description: err?.message || "Failed to save printer settings." })
    } finally {
      setIsSaving(false)
    }
  }

  const moveToNextOutlet = () => {
    if (!currentOutlet || activeOutlets.length <= 1) {
      return
    }

    const currentIndex = activeOutlets.findIndex((outlet) => String(outlet.id) === String(currentOutlet.id))
    if (currentIndex === -1) {
      return
    }

    const nextOutlet = activeOutlets[(currentIndex + 1) % activeOutlets.length]
    if (String(nextOutlet.id) === String(currentOutlet.id)) {
      return
    }

    setCurrentOutlet(String(nextOutlet.id))
    setSelectedPrinter("")
    setPrinters([])
    setExtraPrinters([])
    setRawPrinters(null)
    setStep(connected ? 2 : 1)
    toast({ title: "Outlet switched", description: `Now configuring ${nextOutlet.name}. Click Search Printers.` })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cloud Printing Setup</CardTitle>
        <CardDescription>Simple setup: Connect connector, search printers, assign selected printer to this outlet.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded border p-3 text-sm space-y-3">
          <div className="font-medium">Current outlet</div>
          <div className="text-sm">{currentOutlet?.name || "No outlet selected"}</div>
          <div className="text-xs text-muted-foreground">Agent URL: {LOCAL_PRINT_AGENT_URL}</div>
          <div className="text-xs text-muted-foreground">Connector status: {connected ? "Connected" : "Disconnected"}</div>
        </div>

        <div className="rounded border p-3 space-y-3">
          <div className="font-medium">Step 1: Connect</div>
          <p className="text-xs text-muted-foreground">
            Click Connect once. The system checks connector health, auto-pairs to this outlet, and loads printers.
          </p>
          <div className="flex gap-2">
            <Button onClick={connectAgent} disabled={isConnecting || isAutoPairing}>
              {isConnecting || isAutoPairing ? "Connecting..." : "Connect"}
            </Button>
            <Button variant="outline" onClick={disconnectAgent} disabled={!connected}>Disconnect</Button>
          </div>
        </div>

        <div className="rounded border p-3 space-y-3">
          <div className="font-medium">Step 2: Search printers</div>
          <p className="text-xs text-muted-foreground">
            Search printers connected to this machine, then select one.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => scanPrinters(false)} disabled={!connected || isScanning}>
              {isScanning ? "Searching..." : "Search Printers"}
            </Button>
          </div>

          <div className="space-y-1">
            {mergedPrinters.length === 0 && <p className="text-sm text-muted-foreground">No printers discovered yet.</p>}
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
        </div>

        <div className="rounded border p-3 space-y-3">
          <div className="font-medium">Step 3: Assign printer to outlet</div>
          <p className="text-xs text-muted-foreground">
            Save selected printer as default for this outlet. Then repeat for next outlet.
          </p>
          <div className="flex gap-2">
            <Button onClick={saveSelection} disabled={!connected || !selectedPrinter || isSaving}>
              {isSaving ? "Saving..." : "Assign to This Outlet"}
            </Button>
            <Button variant="outline" onClick={moveToNextOutlet} disabled={activeOutlets.length <= 1}>
              Configure Next Outlet
            </Button>
          </div>
          {lastAssignedOutletName && (
            <div className="text-xs text-muted-foreground">
              Last assigned outlet: {lastAssignedOutletName}
            </div>
          )}
        </div>

        <div className="rounded border p-3 text-sm space-y-3">
          <div className="font-medium">Optional: print mode and tests</div>
          <div className="flex flex-wrap gap-2">
            <Button variant={printChannel === "auto" ? "default" : "outline"} onClick={() => savePrintChannel("auto")}>Auto</Button>
            <Button variant={printChannel === "agent" ? "default" : "outline"} onClick={() => savePrintChannel("agent")}>Agent Only</Button>
            <Button variant={printChannel === "bluetooth_usb_thermal_printer_plus" ? "default" : "outline"} onClick={() => savePrintChannel("bluetooth_usb_thermal_printer_plus")}>Bluetooth-USB Thermal Printer+</Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={testPrint} disabled={!selectedPrinter || !connected}>Test Agent Print</Button>
            <Button variant="outline" onClick={testBluetoothUsbThermalPrinterPlus}>Test Bluetooth-USB Thermal Printer+</Button>
          </div>
          <div className="text-xs text-muted-foreground">Step progress: {step}/3</div>
        </div>

        <div className="rounded border p-3 text-sm space-y-2">
          <div className="font-medium">Manual pairing fallback</div>
          <div className="flex gap-2">
            <Input
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Enter 6-digit pairing code"
            />
            <Button onClick={pairDeviceWithCode}>Pair Device</Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="manual-printer">Add Manual Printer (IP or name)</Label>
          <div className="flex gap-2">
            <Input id="manual-printer" value={manualPrinter} onChange={(e) => setManualPrinter(e.target.value)} />
            <Button onClick={addManualPrinter}>Add</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
