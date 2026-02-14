"use client"

import { useEffect, useMemo, useState } from "react"
import { api, apiEndpoints } from "@/lib/api"
import { useBusinessStore } from "@/stores/businessStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"


const LOCAL_PRINT_AGENT_URL =
  process.env.NEXT_PUBLIC_LOCAL_PRINT_AGENT_URL || "http://127.0.0.1:7310"
const LOCAL_PRINT_AGENT_TOKEN =
  process.env.NEXT_PUBLIC_LOCAL_PRINT_AGENT_TOKEN || ""

function encodeTextToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ""
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

async function agentFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (LOCAL_PRINT_AGENT_TOKEN) {
    headers["X-Primepos-Token"] = LOCAL_PRINT_AGENT_TOKEN
  }
  const response = await fetch(`${LOCAL_PRINT_AGENT_URL}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers || {}) },
  })
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(body || response.statusText)
  }
  return response
}

export function PrinterSettings() {
  const { toast } = useToast()
  const [connected, setConnected] = useState(false)
  const [printers, setPrinters] = useState<string[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState<string>(typeof window !== "undefined" ? localStorage.getItem("defaultPrinter") || "" : "")
  const [isScanning, setIsScanning] = useState(false)
  const [manualPrinter, setManualPrinter] = useState("")
  const [rawOutputVisible, setRawOutputVisible] = useState(false)
  const [rawPrinters, setRawPrinters] = useState<any>(null)
  const [extraPrinters, setExtraPrinters] = useState<string[]>([])
  const mergedPrinters = useMemo(
    () => Array.from(new Set([...(printers || []), ...extraPrinters])),
    [printers, extraPrinters]
  )

  useEffect(() => {
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
    setIsScanning(true)
    try {
      const response = await agentFetch("/printers", { method: "GET" })
      const data = await response.json().catch(() => ({}))
      const discovered: string[] = Array.isArray(data?.printers) ? data.printers : []
      setPrinters(discovered)
      const combined = Array.from(new Set([...(discovered || []), ...extraPrinters]))
      setRawPrinters(combined)
      if (data?.default && !selectedPrinter) {
        setSelectedPrinter(String(data.default))
      }
      toast({ title: "Printers discovered", description: `${combined.length} printers found` })
    } catch (err: any) {
      toast({ title: "Scan failed", description: (err && err.message) || String(err) })
    } finally {
      setIsScanning(false)
    }
  }

  const testPrint = async () => {
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

  const addManualPrinter = () => {
    if (!manualPrinter) return
    const normalized = manualPrinter.trim()
    const merged = Array.from(new Set([...extraPrinters, normalized]))
    setExtraPrinters(merged)
    setManualPrinter("")
    toast({ title: "Printer added", description: `${normalized}` })
  }

  const { currentOutlet } = useBusinessStore()

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

        <div className="flex gap-2">
          <Button onClick={connectAgent} disabled={connected}>Connect Agent</Button>
          <Button variant="outline" onClick={disconnectAgent} disabled={!connected}>Disconnect</Button>
          <Button variant="ghost" onClick={scanPrinters} disabled={!connected || isScanning}>{isScanning ? "Scanning..." : "Scan Printers"}</Button>
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
          <Button variant="outline" onClick={testPrint} disabled={!selectedPrinter || !connected}>Test Print</Button>
          <Button onClick={saveSelection}>Save Default Printer</Button>
        </div>
      </CardContent>
    </Card>
  )
}
