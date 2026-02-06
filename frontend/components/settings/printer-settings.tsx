"use client"

import { useEffect, useState } from "react"
import { api, apiEndpoints } from "@/lib/api"
import { useBusinessStore } from "@/stores/businessStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { useQZStore } from "@/stores/qzStore"


// Minimal QZ Tray integration for discovery and selection.
// This component loads the QZ script dynamically and provides
// connect / discover / select functionality.

export function PrinterSettings() {
  const { toast } = useToast()
  const enabled = useQZStore((s) => s.enabled)
  const connected = useQZStore((s) => s.connected)
  const printers = useQZStore((s) => s.printers)
  const setEnabled = useQZStore((s) => s.setEnabled)
  const refreshPrinters = useQZStore((s) => s.refreshPrinters)
  const [selectedPrinter, setSelectedPrinter] = useState<string>(typeof window !== "undefined" ? localStorage.getItem("defaultPrinter") || "" : "")
  const [isScanning, setIsScanning] = useState(false)
  const [manualPrinter, setManualPrinter] = useState("")
  const [rawOutputVisible, setRawOutputVisible] = useState(false)
  const [rawPrinters, setRawPrinters] = useState<any>(null)
  const [extraPrinters, setExtraPrinters] = useState<string[]>([])

  // Load QZ Tray library from installed package (client-side only)
  useEffect(() => {
    // Auto-enable QZ if user toggled integration
    if (enabled && !connected) {
      setEnabled(true)
    }
  }, [enabled, connected, setEnabled])

  const connectQZ = async () => {
    await setEnabled(true)
    toast({ title: "QZ Connected", description: "Connected to QZ Tray on this machine." })
  }

  const disconnectQZ = async () => {
    await setEnabled(false)
    toast({ title: "QZ Disconnected" })
  }

  const scanPrinters = async () => {
    setIsScanning(true)
    try {
      await refreshPrinters()
      const combined = Array.from(new Set([...(printers || []), ...extraPrinters]))
      setRawPrinters(combined)
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
    if (!(window as any).qz) {
      toast({ title: "QZ not loaded", description: "QZ Tray library is not available." })
      return
    }

    try {
      const qz = (window as any).qz
      if (!qz?.websocket?.isActive()) {
        await setEnabled(true)
      }

      const config = qz.configs.create(selectedPrinter)
      const data = [
        "\x1B@",
        "TEST PRINT\n",
        new Date().toLocaleString() + "\n\n",
        "\x1DV\x01",
      ]
      await qz.print(config, data)
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
          driver: "qz",
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
        <CardTitle>Printer Setup (QZ Tray)</CardTitle>
        <CardDescription>Connect to QZ Tray to discover local printers and select a default receipt printer.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={connectQZ} disabled={connected}>Connect QZ</Button>
          <Button variant="outline" onClick={disconnectQZ} disabled={!connected}>Disconnect</Button>
          <Button variant="ghost" onClick={scanPrinters} disabled={!connected || isScanning}>{isScanning ? "Scanning..." : "Scan Printers"}</Button>
        </div>

        <div className="space-y-2">
          <Label>Discovered Printers</Label>
          {printers.length === 0 && <p className="text-sm text-muted-foreground">No printers discovered yet.</p>}
          <div className="space-y-1">
            {Array.from(new Set([...(printers || []), ...extraPrinters])).map((p) => (
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
