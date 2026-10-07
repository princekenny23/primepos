"use client"

import { useState } from "react"
import { api } from "@/lib/api"
import { useBusinessStore } from "@/stores/businessStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"

export function AndroidDevicePairing() {
  const { currentOutlet } = useBusinessStore()
  const { toast } = useToast()
  const [pairingCode, setPairingCode] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")

  const connectDevice = async () => {
    if (!currentOutlet) {
      toast({ title: "No outlet", description: "Select an outlet before connecting an Android POS.", variant: "destructive" })
      return
    }

    const outletId = Number(currentOutlet.id)
    if (!Number.isFinite(outletId) || outletId <= 0) {
      toast({ title: "Invalid outlet", description: "Select a valid outlet first.", variant: "destructive" })
      return
    }

    if (!/^\d{6}$/.test(pairingCode)) {
      toast({ title: "Pairing code required", description: "Enter the six-digit code shown on the Android POS.", variant: "destructive" })
      return
    }

    setIsConnecting(true)
    setStatusMessage("")
    try {
      const response: any = await api.post("/devices/pairing/claim/", {
        pairing_code: pairingCode,
        outlet_id: outletId,
        channel: "mobile",
        name: "Android POS",
        printer_identifier: "android_builtin_thermal",
      })

      const deviceName = response?.device?.name || response?.device?.device_id || "Android POS"
      setStatusMessage(`${deviceName} connected to ${currentOutlet.name}. It will print receipts automatically.`)
      setPairingCode("")
      toast({ title: "Android POS connected", description: `Connected to ${currentOutlet.name}.` })
    } catch (error: any) {
      toast({
        title: "Android connection failed",
        description: error?.message || "Unable to connect this Android POS.",
        variant: "destructive",
      })
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Android POS</CardTitle>
        <CardDescription>Connect the Android POS to the selected outlet. Printing runs through its built-in thermal printer.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded border p-3 text-sm">
          Current outlet: <span className="font-medium">{currentOutlet?.name || "No outlet selected"}</span>
        </div>
        <div className="space-y-2">
          <Label htmlFor="android-pairing-code">Pairing code</Label>
          <Input
            id="android-pairing-code"
            value={pairingCode}
            onChange={(event) => setPairingCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Enter 6-digit code"
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
          />
        </div>
        <Button onClick={connectDevice} disabled={isConnecting || pairingCode.length !== 6 || !currentOutlet}>
          {isConnecting ? "Connecting..." : "Connect Device"}
        </Button>
        {statusMessage && <p className="text-sm text-green-600">{statusMessage}</p>}
      </CardContent>
    </Card>
  )
}
