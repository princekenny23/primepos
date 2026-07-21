"use client"

import { useEffect, useMemo, useState } from "react"
import { api, apiEndpoints } from "@/lib/api"
import { scanPrinters as scanAvailablePrinters } from "@/lib/print"
import { useBusinessStore } from "@/stores/businessStore"
import { outletService } from "@/lib/services/outletService"
import { BusinessSettings } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"

const PA_HEARTBEAT_WINDOW_MS = 90_000
const QZ_TRAY_ENABLED_STORAGE_KEY = "primepos.qzTrayEnabled"
const QZ_TRAY_CONNECT_STATUS_STORAGE_KEY = "primepos.qzTrayConnectStatus"
const QZ_TRAY_CDN_URLS = [
  "https://cdn.jsdelivr.net/npm/qz-tray@2.0.0/qz-tray.js",
  "https://unpkg.com/qz-tray@2.0.0/qz-tray.js",
  "https://cdnjs.cloudflare.com/ajax/libs/qz-tray/2.0.0/qz-tray.js",
]

type WizardStep = 1 | 2 | 3

function isLocalhostBrowser(): boolean {
  if (typeof window === "undefined") return false
  const host = String(window.location.hostname || "").toLowerCase()
  return host === "localhost" || host === "127.0.0.1" || host === "::1"
}

async function localAgentFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`/api/local-print${path}`, init)
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(body || `Local Print Agent error (${response.status})`)
  }
  return response
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

async function resolveActiveConnectorForOutlet(outletId: number): Promise<{ pk: string; deviceId: string } | null> {
  try {
    const devicesRaw: any = await api.get(`/devices/?outlet=${outletId}&is_active=true`)
    const devices = Array.isArray(devicesRaw) ? devicesRaw : (devicesRaw.results || [])
    const firstDevice = devices.find((device: any) => isLiveOutletConnector(device, outletId))
    const pk = String(firstDevice?.id || "").trim()
    const deviceId = String(firstDevice?.device_id || "").trim()
    if (!pk || !deviceId) return null
    return { pk, deviceId }
  } catch {
    return null
  }
}

async function enqueueBackendTestPrint(outletId: number, printerIdentifier: string, deviceId: string): Promise<void> {
  const payload: any = {
    outlet_id: outletId,
    printer_identifier: printerIdentifier,
    device_id: deviceId,
  }
  // Include paper width if available in current outlet settings
  try {
    const outletDetails: any = await api.get(`/outlets/${outletId}/`)
    const pw = outletDetails?.settings?.paper_width
    if (pw) payload.paper_width = pw
  } catch {
    // ignore
  }
  await api.post("/print-jobs/test-print/", payload)
}

export function PrinterSettings() {
  const { toast } = useToast()
  const [hostMode, setHostMode] = useState<"unknown" | "local" | "cloud">("unknown")
  const [connected, setConnected] = useState(false)
  const [step, setStep] = useState<WizardStep>(1)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [printers, setPrinters] = useState<string[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState<string>("")
  const [isScanning, setIsScanning] = useState(false)
  const [pairedDevicePk, setPairedDevicePk] = useState<string>("")
  const [isAutoPairing, setIsAutoPairing] = useState(false)
  const [pairingCode, setPairingCode] = useState("")
  const [pairingDeviceId, setPairingDeviceId] = useState("")
  const [isClaimingPairing, setIsClaimingPairing] = useState(false)
  const [pairingStatusMessage, setPairingStatusMessage] = useState("")
  const [rawOutputVisible, setRawOutputVisible] = useState(false)
  const [rawPrinters, setRawPrinters] = useState<any>(null)
  const [extraPrinters, setExtraPrinters] = useState<string[]>([])
  const [lastAssignedOutletName, setLastAssignedOutletName] = useState("")
  const [selectedPaperWidth, setSelectedPaperWidth] = useState<string>("80")
  const [qzEnabled, setQzEnabled] = useState(false)
  const [qzStatus, setQzStatus] = useState<"idle" | "connecting" | "ready" | "error">("idle")
  const [qzPrinters, setQzPrinters] = useState<string[]>([])
  const [isScanningQz, setIsScanningQz] = useState(false)
  const mergedPrinters = useMemo(
    () => Array.from(new Set([...(printers || []), ...extraPrinters])),
    [printers, extraPrinters]
  )

  const rememberPrinterName = (printerName?: string | null) => {
    const normalized = String(printerName || "").trim()
    if (!normalized) return
    setExtraPrinters((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]))
  }

  const persistQzPreference = (enabled: boolean) => {
    if (typeof window === "undefined") return
    try {
      localStorage.setItem(QZ_TRAY_ENABLED_STORAGE_KEY, enabled ? "true" : "false")
      localStorage.setItem(QZ_TRAY_CONNECT_STATUS_STORAGE_KEY, enabled ? "enabled" : "disabled")
    } catch {
      // ignore storage failures
    }
  }

  const loadQzTrayScript = async (url: string): Promise<boolean> => {
    if (typeof document === "undefined") return false

    return new Promise<boolean>((resolve) => {
      const script = document.createElement("script")
      script.async = true
      script.crossOrigin = "anonymous"
      script.src = url
      script.setAttribute("data-primepos-qz", "true")

      const cleanup = () => {
        script.remove()
      }

      script.addEventListener(
        "load",
        () => {
          cleanup()
          resolve(true)
        },
        { once: true }
      )

      script.addEventListener(
        "error",
        () => {
          cleanup()
          resolve(false)
        },
        { once: true }
      )

      document.head.appendChild(script)
    })
  }

  const ensureQzTrayReady = async (): Promise<boolean> => {
    if (typeof window === "undefined") return false

    const existingQz = (window as Window & typeof globalThis & { qz?: any }).qz
    if (existingQz && typeof existingQz.websocket?.connect === "function") {
      return true
    }

    if (typeof document === "undefined") return false

    const existingScript = document.querySelector('script[data-primepos-qz="true"]') as HTMLScriptElement | null
    if (existingScript) {
      await new Promise<void>((resolve, reject) => {
        existingScript.addEventListener("load", () => resolve(), { once: true })
        existingScript.addEventListener("error", () => reject(new Error("QZ Tray script failed to load")), { once: true })
      })
      return Boolean((window as Window & typeof globalThis & { qz?: any }).qz)
    }

    for (const url of QZ_TRAY_CDN_URLS) {
      const loaded = await loadQzTrayScript(url)
      if (!loaded) continue

      const candidate = (window as Window & typeof globalThis & { qz?: any }).qz
      if (candidate && typeof candidate.websocket?.connect === "function") {
        return true
      }
    }

    return false
  }

  const connectQzTray = async (silent = false) => {
    if (!currentOutlet) {
      if (!silent) {
        toast({ title: "No outlet", description: "Select an outlet before connecting QZ Tray." })
      }
      return
    }

    const outletId = typeof currentOutlet.id === "string" ? parseInt(currentOutlet.id, 10) : Number(currentOutlet.id)
    if (!outletId) {
      if (!silent) {
        toast({ title: "Invalid outlet", description: "Select a valid outlet first." })
      }
      return
    }

    try {
      setIsScanningQz(true)
      setQzStatus("connecting")
      const ready = await ensureQzTrayReady()
      if (!ready) {
        throw new Error("QZ Tray is not available in this browser session.")
      }

      const qz = (window as Window & typeof globalThis & { qz?: any }).qz
      if (!qz?.websocket?.connect || !qz?.printers?.find) {
        throw new Error("QZ Tray library did not expose the required printer API.")
      }

      await qz.websocket.connect({ reconnect: true, attempts: 1 })
      const discovered = await qz.printers.find()
      const printerNames = Array.isArray(discovered)
        ? discovered
            .map((printer: any) => String(printer?.displayName || printer?.name || printer?.deviceName || "").trim())
            .filter(Boolean)
        : []

      setQzPrinters(printerNames)
      setPrinters(printerNames)
      setRawPrinters(printerNames)
      setQzStatus(printerNames.length > 0 ? "ready" : "error")

      if (printerNames.length > 0) {
        const preferred = printerNames[0]
        setSelectedPrinter(preferred)
        rememberPrinterName(preferred)
        if (typeof window !== "undefined") {
          localStorage.setItem(getOutletStorageKey(outletId), preferred)
          localStorage.setItem("defaultPrinter", preferred)
          localStorage.setItem("printChannel", "qztray")
        }
        if (!silent) {
          toast({ title: "QZ Tray ready", description: `Detected ${printerNames.length} printer${printerNames.length > 1 ? "s" : ""}.` })
        }
      } else if (!silent) {
        toast({ title: "QZ Tray connected", description: "QZ Tray is active but no printers were detected yet." })
      }
    } catch (err: any) {
      setQzStatus("error")
      toast({ title: "QZ Tray connection failed", description: err?.message || "Unable to initialize QZ Tray." })
    } finally {
      setIsScanningQz(false)
    }
  }

  const { currentOutlet: currentOutletRaw, outlets, setCurrentOutlet } = useBusinessStore()
  const currentOutlet = currentOutletRaw as any
  const activeOutlets = useMemo(
    () => (outlets || []).filter((o) => o.isActive !== false),
    [outlets]
  )

  useEffect(() => {
    setHostMode(isLocalhostBrowser() ? "local" : "cloud")
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const stored = localStorage.getItem(QZ_TRAY_ENABLED_STORAGE_KEY) === "true"
      setQzEnabled(stored)
      if (stored) {
        setQzStatus(localStorage.getItem(QZ_TRAY_CONNECT_STATUS_STORAGE_KEY) === "ready" ? "ready" : "idle")
      }
    } catch {
      // ignore storage failures
    }
  }, [])

  useEffect(() => {
    const pingLocal = async () => {
      if (hostMode !== "local") return
      try {
        await localAgentFetch("/health", { method: "GET" })
        setConnected(true)
        setStep((prev) => (prev < 2 ? 2 : prev))
      } catch {
        setConnected(false)
      }
    }
    pingLocal()
  }, [hostMode])

  useEffect(() => {
    if (hostMode !== "cloud") return

    let active = true
    const checkCloudConnector = async () => {
      try {
        await api.get(apiEndpoints.printers.list)

        if (!currentOutlet) {
          if (active) {
            setConnected(false)
            setPairedDevicePk("")
          }
          return
        }

        const outletId = typeof currentOutlet.id === "string" ? parseInt(currentOutlet.id, 10) : Number(currentOutlet.id)
        if (!outletId) {
          if (active) {
            setConnected(false)
            setPairedDevicePk("")
          }
          return
        }

        const connector = await resolveActiveConnectorForOutlet(outletId)
        if (!active) return

        const isLinked = !!connector?.pk
        setPairedDevicePk(connector?.pk || "")
        setConnected(isLinked)
        if (isLinked) {
          setStep((prev) => (prev < 2 ? 2 : prev))
        }
      } catch {
        if (!active) return
        setConnected(false)
      }
    }

    checkCloudConnector()
    const intervalId = window.setInterval(checkCloudConnector, 15000)
    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [hostMode, currentOutlet])

  const connectAgent = async () => {
    setIsConnecting(true)
    try {
      if (isLocalhostBrowser()) {
        await localAgentFetch("/health", { method: "GET" })
        setConnected(true)
        setStep((prev) => (prev < 2 ? 2 : prev))
        await scanPrinters(true)
      } else {
        await api.get(apiEndpoints.printers.list)
        if (!currentOutlet) {
          setConnected(false)
          toast({ title: "Select outlet", description: "Select an outlet to check cloud connector status.", variant: "destructive" })
          return
        }

        const outletId = typeof currentOutlet.id === "string" ? parseInt(currentOutlet.id, 10) : Number(currentOutlet.id)
        if (!outletId) {
          setConnected(false)
          toast({ title: "Invalid outlet", description: "Select a valid outlet first.", variant: "destructive" })
          return
        }

        const connector = await resolveActiveConnectorForOutlet(outletId)
        const isLinked = !!connector?.pk
        setPairedDevicePk(connector?.pk || "")
        setConnected(isLinked)

        if (isLinked) {
          setStep((prev) => (prev < 2 ? 2 : prev))
          await scanPrinters(true)
        } else {
          toast({
            title: "Cloud reachable",
            description: "Backend is reachable, but no active connector is linked to this outlet yet.",
            variant: "destructive",
          })
        }
      }
    } catch (err: any) {
      setConnected(false)
      toast({
        title: "Connection failed",
        description: err?.message || (isLocalhostBrowser()
          ? "Unable to reach local print connector."
          : "Unable to reach backend print service."),
        variant: "destructive"
      })
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectAgent = async () => {
    setIsDisconnecting(true)
    try {
      const connectorPk = String(pairedDevicePk || "").trim()
      if (connectorPk) {
        await api.post(`/devices/${connectorPk}/revoke-api-key/`, {})
        await api.post(`/devices/${connectorPk}/unpair/`, {})
      }

      setConnected(false)
      setPairedDevicePk("")
      setPairingStatusMessage("")
      setPairingCode("")
      setPairingDeviceId("")
      setStep(1)
    } catch (err: any) {
      toast({
        title: "Disconnect failed",
        description: err?.message || "Could not revoke connector API key.",
        variant: "destructive",
      })
    } finally {
      setIsDisconnecting(false)
    }
  }

  const scanPrinters = async (silent = false) => {
    if (!currentOutlet) {
      if (!silent) {
        toast({ title: "No outlet", description: "Select an outlet first." })
      }
      return
    }

    const outletId = typeof currentOutlet.id === "string" ? parseInt(currentOutlet.id, 10) : Number(currentOutlet.id)
    if (!outletId) {
      if (!silent) {
        toast({ title: "Invalid outlet", description: "Select a valid outlet first." })
      }
      return
    }

    setIsScanning(true)
    try {
      if (isLocalhostBrowser()) {
        const discovered = await scanAvailablePrinters(true)
        setPrinters(discovered)
        const combined = Array.from(new Set([...(discovered || []), ...extraPrinters]))
        setRawPrinters(combined)
        setStep((prev) => (prev < 3 ? 3 : prev))
        if (!selectedPrinter && combined.length > 0) {
          const next = combined[0]
          setSelectedPrinter(next)
          rememberPrinterName(next)
          if (typeof window !== "undefined") {
            localStorage.setItem(getOutletStorageKey(outletId), next)
          }
        }
        if (!silent) {
        }
        return
      }

      const connector = await resolveActiveConnectorForOutlet(outletId)
      if (!connector?.deviceId) {
        setPrinters([])
        setRawPrinters(extraPrinters)
        if (!silent) {
          toast({
            title: "No active connector",
            description: "No online connector is linked to this outlet yet.",
            variant: "destructive",
          })
        }
        return
      }

      const synced: any = await api.get(`/devices/printers/?device_id=${encodeURIComponent(connector.deviceId)}`)
      const syncedList = Array.isArray(synced?.printers) ? synced.printers : []
      const discovered = syncedList
        .map((p: any) => String(p?.identifier || p?.name || "").trim())
        .filter(Boolean)

      setPrinters(discovered)
      const combined = Array.from(new Set([...(discovered || []), ...extraPrinters]))
      setRawPrinters(combined)
      setStep((prev) => (prev < 3 ? 3 : prev))
      if (!selectedPrinter && combined.length > 0) {
        const next = combined[0]
        setSelectedPrinter(next)
        rememberPrinterName(next)
        if (typeof window !== "undefined") {
          localStorage.setItem(getOutletStorageKey(outletId), next)
        }
      }
      if (!silent) {
      }
    } catch (err: any) {
      toast({ title: "Search failed", description: (err && err.message) || String(err), variant: "destructive" })
    } finally {
      setIsScanning(false)
    }
  }

  const testPrint = async () => {
    if (!selectedPrinter) {
      toast({ title: "No printer selected", description: "Select a printer to test-print." })
      return
    }
    if (!currentOutlet) {
      toast({ title: "No outlet", description: "Select an outlet before test printing." })
      return
    }

    const outletId = typeof currentOutlet.id === "string" ? parseInt(currentOutlet.id, 10) : Number(currentOutlet.id)
    if (!outletId) {
      toast({ title: "Invalid outlet", description: "Select a valid outlet first." })
      return
    }

    try {
      if (isLocalhostBrowser()) {
        const escposBytes = new Uint8Array([
          0x1b, 0x40, // Initialize printer
          ...(selectedPaperWidth === '58' ? [0x1d, 0x57, 0xd0, 0x01] : [0x1d, 0x57, 0x80, 0x02]),
        ])
        const text = `PRIMEPOS TEST PRINT\n${new Date().toLocaleString()}\n\n`
        const encoder = new TextEncoder()
        const textBytes = encoder.encode(text)
        const cutBytes = new Uint8Array([0x1d, 0x56, 0x01])

        const payloadBytes = new Uint8Array(escposBytes.length + textBytes.length + cutBytes.length)
        payloadBytes.set(escposBytes, 0)
        payloadBytes.set(textBytes, escposBytes.length)
        payloadBytes.set(cutBytes, escposBytes.length + textBytes.length)

        const contentBase64 = btoa(String.fromCharCode(...payloadBytes))
        await localAgentFetch("/print", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            printerName: selectedPrinter,
            contentBase64,
            jobName: "PrimePOS Test Print",
          }),
        })
        return
      }

      const connector = await resolveActiveConnectorForOutlet(outletId)
      await enqueueBackendTestPrint(outletId, selectedPrinter, connector?.deviceId || "")
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
        await navAny.share({ title: "PrimePOS Receipt Test", text })
        return
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        toast({ title: "Bluetooth test copied", description: "Receipt text copied to clipboard." })
        return
      }

      throw new Error("Share is not available on this device/browser.")
    } catch (err: any) {
      toast({
        title: "Bluetooth printer test failed",
        description: err?.message || "Could not open share. Make sure Bluetooth printer support is enabled.",
        variant: "destructive",
      })
    }
  }

  const getOutletStorageKey = (outletId?: number | string | null) =>
    outletId ? `defaultPrinter:${outletId}` : "defaultPrinter"

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
        rememberPrinterName(next)
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
      if (stored) {
        setSelectedPrinter(stored)
        rememberPrinterName(stored)
      }
    }
  }

  useEffect(() => {
    loadDefaultPrinter()
  }, [currentOutlet])

  useEffect(() => {
    // Initialize paper width from current outlet settings
    try {
      const pw = (currentOutlet?.settings as BusinessSettings)?.paper_width
      if (pw === '58' || pw === '80') setSelectedPaperWidth(pw)
      else setSelectedPaperWidth('80')
    } catch {
      setSelectedPaperWidth('80')
    }
  }, [currentOutlet])

  useEffect(() => {
    const loadPairedDevice = async () => {
      if (!currentOutlet) {
        setPairedDevicePk("")
        return
      }

      const outletId = typeof currentOutlet.id === "string" ? parseInt(currentOutlet.id, 10) : Number(currentOutlet.id)
      if (!outletId) {
        setPairedDevicePk("")
        return
      }

      const connector = await resolveActiveConnectorForOutlet(outletId)
      setPairedDevicePk(connector?.pk || "")
    }

    loadPairedDevice()
  }, [currentOutlet])

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
      const connector = await resolveActiveConnectorForOutlet(outletId)
      const devicePk = connector?.pk || ""

      if (devicePk) {
        setPairedDevicePk(devicePk)
        setConnected(true)
        if (!silent) {
        }
      } else if (!silent) {
        setConnected(false)
        toast({
          title: "No active connector",
          description: "Start the Windows connector and complete pairing there. Frontend does not call localhost.",
          variant: "destructive",
        })
      }
    } catch (err: any) {
      if (!silent) {
        toast({ title: "Connector lookup failed", description: err?.message || "Unable to load connector status.", variant: "destructive" })
      }
    } finally {
      setIsAutoPairing(false)
    }
  }

  const claimCloudPairing = async () => {
    if (!currentOutlet) {
      toast({ title: "No outlet", description: "Select an outlet before pairing.", variant: "destructive" })
      return
    }

    const outletId = typeof currentOutlet.id === "string" ? parseInt(currentOutlet.id, 10) : Number(currentOutlet.id)
    if (!outletId) {
      toast({ title: "Invalid outlet", description: "Select a valid outlet first.", variant: "destructive" })
      return
    }

    const normalizedCode = pairingCode.trim()
    if (normalizedCode.length < 6) {
      toast({ title: "Pairing code required", description: "Enter the 6-digit connector code.", variant: "destructive" })
      return
    }

    setIsClaimingPairing(true)
    try {
      const response: any = await api.post("/devices/pairing/claim/", {
        pairing_code: normalizedCode,
        outlet_id: outletId,
        device_id: pairingDeviceId.trim() || undefined,
        printer_identifier: selectedPrinter || undefined,
        name: "PrimePOS Connector",
      })

      const devicePk = String(response?.device?.id || "").trim()
      const deviceId = String(response?.device?.device_id || pairingDeviceId || "").trim()

      if (devicePk) {
        setPairedDevicePk(devicePk)
      }
      if (deviceId) {
        setPairingDeviceId(deviceId)
      }

      setConnected(true)
      setPairingStatusMessage("Connector paired successfully.")
      setStep((prev) => (prev < 2 ? 2 : prev))
      await scanPrinters(true)
    } catch (err: any) {
      setPairingStatusMessage("")
      toast({
        title: "Pairing failed",
        description: err?.message || "Unable to claim pairing code.",
        variant: "destructive",
      })
    } finally {
      setIsClaimingPairing(false)
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
        if (qzEnabled) {
          localStorage.setItem("printChannel", "qztray")
        }
      }
      rememberPrinterName(selectedPrinter)

      const connectorPk = pairedDevicePk || (hostMode === "cloud" ? (await resolveActiveConnectorForOutlet(outletId))?.pk || "" : "")
      const shouldAssignCloud = hostMode === "cloud" && Boolean(connectorPk)

      if (shouldAssignCloud) {
        try {
          const cloudPrinters: any = await api.get(`/cloud-printers/?outlet=${outletId}&device=${connectorPk}`)
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
              device: Number(connectorPk),
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
      } else if (hostMode === "cloud") {
        toast({ title: "Pairing missing", description: "Printer saved for outlet, but connector is not paired yet.", variant: "destructive" })
      }

      setLastAssignedOutletName(currentOutlet.name)
      // Printer configuration intentionally stays separate from device pairing.
    } catch (err: any) {
      console.error("Error saving printer", err)
      toast({ title: "Save failed", description: err?.message || "Failed to save printer settings." })
    } finally {
      setIsSaving(false)
    }
  }

  const savePaperWidth = async () => {
    if (!currentOutlet) {
      toast({ title: "No outlet", description: "Please select an outlet before saving paper width." })
      return
    }

    try {
      setIsSaving(true)
      const outletId = String(currentOutlet.id)
      const currentSettings = (currentOutlet.settings || {}) as BusinessSettings
      const updatedSettings: BusinessSettings = {
        ...currentSettings,
        paper_width: selectedPaperWidth === '58' ? '58' : '80',
      }
      const updatedOutlet = await outletService.update(outletId, { name: currentOutlet.name, settings: updatedSettings })
      setCurrentOutlet(String(updatedOutlet.id)) // Update the store with the outlet ID
      toast({ title: "Paper width saved", description: "Printer paper width updated successfully." })
    } catch (err: any) {
      console.error("Error saving paper width", err)
      toast({ title: "Save failed", description: err?.message || "Failed to save paper width." })
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
    setPairingCode("")
    setPairingStatusMessage("")
    setStep(connected ? 2 : 1)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cloud Printing Setup</CardTitle>
        <CardDescription>Connect the local connector or cloud connector, pair it to this outlet, load printers, then assign the default printer.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded border p-3 text-sm space-y-3">
          <div className="font-medium">Current outlet</div>
          <div className="text-sm">{currentOutlet?.name || "No outlet selected"}</div>
          <div className="text-xs text-muted-foreground">Connector status: {connected ? "Connected" : "Disconnected"}</div>
          <div className="text-xs text-muted-foreground">Selected printer: {selectedPrinter || "No printer selected"}</div>
          {!!selectedPrinter && connected && (
            <div className="text-xs text-green-600">Connected printer ready: {selectedPrinter}</div>
          )}
          <div className="text-xs text-muted-foreground">Localhost uses direct local printing. Cloud uses backend queue + connector polling.</div>
        </div>

        <div className="rounded border p-3 space-y-3">
          <div className="font-medium">Step 1: Connect</div>
          <p className="text-xs text-muted-foreground">
            Click Connect once. The system checks backend availability and links any active connector device for this outlet.
          </p>
          <div className="flex gap-2">
            <Button onClick={connectAgent} disabled={isConnecting || isAutoPairing}>
              {isConnecting || isAutoPairing ? "Connecting..." : "Connect"}
            </Button>
            <Button variant="outline" onClick={disconnectAgent} disabled={!connected || isDisconnecting}>
              {isDisconnecting ? "Disconnecting..." : "Disconnect"}
            </Button>
          </div>
        </div>

        {hostMode !== "local" && (
          <div className="rounded border p-3 space-y-3">
            <div className="font-medium">Step 2: Pair cloud connector</div>
            <p className="text-xs text-muted-foreground">
              Start the Windows connector. It will display a 6-digit pairing code. Enter it here to link this outlet.
            </p>

            <div className="space-y-2">
              <Label htmlFor="pairing-code">Pairing code</Label>
              <Input
                id="pairing-code"
                value={pairingCode}
                onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter 6-digit code"
                inputMode="numeric"
                maxLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pairing-device-id">Device ID (optional)</Label>
              <Input
                id="pairing-device-id"
                value={pairingDeviceId}
                onChange={(e) => setPairingDeviceId(e.target.value)}
                placeholder="Optional: connector device ID"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={claimCloudPairing}
                disabled={isClaimingPairing || pairingCode.trim().length < 6}
              >
                {isClaimingPairing ? "Pairing..." : "Pair Connector"}
              </Button>
              <Button variant="outline" onClick={() => autoPairCurrentConnector(false)} disabled={isAutoPairing}>
                {isAutoPairing ? "Checking..." : "Check Existing Pairing"}
              </Button>
            </div>

            {pairingStatusMessage && (
              <div className="text-xs text-muted-foreground">{pairingStatusMessage}</div>
            )}

            {!!pairedDevicePk && (
              <div className="text-xs text-green-600">Connector linked to this outlet.</div>
            )}
          </div>
        )}

        {hostMode === "local" && (
          <div className="rounded border p-3 space-y-2">
            <div className="font-medium">Cloud pairing</div>
            <div className="text-xs text-muted-foreground">Local connector detected. Cloud pairing is not required on this machine.</div>
          </div>
        )}

        <div className="rounded border p-3 space-y-3">
          <div className="font-medium">QZ Tray printer mode</div>
          <p className="text-xs text-muted-foreground">
            Enable QZ Tray to let the POS discover and print to local Windows printers automatically after each sale.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={qzEnabled}
                onChange={(event) => {
                  const next = event.target.checked
                  setQzEnabled(next)
                  persistQzPreference(next)
                  if (next) {
                    localStorage.setItem("printChannel", "qztray")
                  }
                }}
              />
              <span>Use QZ Tray for printer detection</span>
            </label>
            <Button variant="outline" onClick={() => connectQzTray(false)} disabled={!qzEnabled || isScanningQz}>
              {isScanningQz ? "Connecting..." : "Connect QZ Tray"}
            </Button>
          </div>
          {qzStatus !== "idle" && (
            <div className="text-xs text-muted-foreground">
              QZ status: {qzStatus === "ready" ? "Ready" : qzStatus === "connecting" ? "Connecting" : "Error"}
            </div>
          )}
          {qzPrinters.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Detected printers: {qzPrinters.join(", ")}
            </div>
          )}
        </div>

        <div className="rounded border p-3 space-y-3">
          <div className="font-medium">Step 3: Search printers</div>
          <p className="text-xs text-muted-foreground">
            Load printers already registered in backend for this outlet and connector.
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
          <div className="rounded border p-3 space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium">Step 3: Configure printer</div>
                <p className="text-xs text-muted-foreground">
                  Assign the selected printer, set the receipt width, and verify the print connection.
                </p>
              </div>
              <div className="text-xs text-muted-foreground">Step progress: {step}/3</div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded border p-3 space-y-3">
                  <div className="font-medium">Assign printer to outlet</div>
                  <p className="text-xs text-muted-foreground">
                    Save the selected printer as the default for this outlet.
                  </p>
                  <div className="space-y-2">
                    <div className="text-sm">Selected printer</div>
                    <div className="rounded border bg-muted px-3 py-2 text-sm text-muted-foreground">
                      {selectedPrinter || "No printer selected"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
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

                <div className="rounded border p-3 space-y-3">
                  <div className="font-medium">Printing test</div>
                  <p className="text-xs text-muted-foreground">
                    Verify the selected printer is reachable and prints a receipt correctly.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={testPrint} disabled={!selectedPrinter || !connected}>
                      Test Agent Print
                    </Button>
                    <Button variant="outline" onClick={testBluetoothUsbThermalPrinterPlus}>
                      Test Bluetooth Printer
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded border p-3 space-y-4">
                <div className="space-y-2">
                  <div className="font-medium">Printer Paper Width</div>
                  <p className="text-xs text-muted-foreground">Choose the receipt paper width for this outlet.</p>
                  <Label>Paper Width</Label>
                  <Select onValueChange={(v) => setSelectedPaperWidth(v)} value={selectedPaperWidth}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select width" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="80">80mm (3.15 inches)</SelectItem>
                      <SelectItem value="58">58mm (2.28 inches)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={savePaperWidth} disabled={isSaving} className="w-full">
                  {isSaving ? "Saving..." : "Save Paper Width"}
                </Button>
                <div className="rounded border bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Use 80mm paper for full-width receipts. Select 58mm only if your printer uses narrow thermal rolls.
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
