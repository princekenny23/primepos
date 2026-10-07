"use client"

import { PrinterSettings } from "@/components/settings/printer-settings"
import { AndroidDevicePairing } from "@/components/settings/android-device-pairing"

export function IntegrationsTab() {
  return (
    <div className="space-y-6">
        <AndroidDevicePairing />
        <PrinterSettings />
    </div>
  )
}

