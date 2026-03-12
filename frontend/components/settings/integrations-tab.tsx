"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PrinterSettings } from "@/components/settings/printer-settings"

export function IntegrationsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>Connect external services and configure integrations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <PrinterSettings />
      </CardContent>
    </Card>
  )
}

