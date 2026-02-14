"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Printer, Key, MessageSquare, Mail, FileText } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { PrinterSettings } from "@/components/settings/printer-settings"

export function IntegrationsTab() {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)

  const integrations = [
    {
      id: "printer",
      name: "Printer Setup",
      description: "Configure receipt and label printers",
      icon: Printer,
      enabled: true,
    },
    {
      id: "api",
      name: "API Keys",
      description: "Manage API keys for integrations",
      icon: Key,
      enabled: true,
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      description: "Send notifications via WhatsApp",
      icon: MessageSquare,
      enabled: false,
    },
    {
      id: "sms",
      name: "SMS Gateway",
      description: "Send SMS notifications",
      icon: MessageSquare,
      enabled: false,
    },
    {
      id: "mra",
      name: "MRA EIS",
      description: "Mauritius Revenue Authority E-Invoicing System",
      icon: FileText,
      enabled: false,
    },
  ]

  const handleSave = async () => {
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
      toast({
        title: "Settings Saved",
        description: "Integration settings have been updated successfully.",
      })
    }, 1000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>Connect external services and configure integrations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {integrations.map((integration) => {
          const Icon = integration.icon
          return (
            <div key={integration.id} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h4 className="font-semibold">{integration.name}</h4>
                    <p className="text-sm text-muted-foreground">{integration.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={integration.enabled ? "default" : "secondary"}>
                    {integration.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                  <Checkbox
                    checked={integration.enabled}
                    onCheckedChange={(checked) => {
                      // In production, this would update the integration status
                    }}
                  />
                </div>
              </div>

              {integration.enabled && (
                <div className="space-y-2">
                  {integration.id === "printer" && (
                    <PrinterSettings />
                  )}

                  {integration.id === "api" && (
                    <>
                      <Label htmlFor="api-key">API Key</Label>
                      <Input id="api-key" type="password" defaultValue="sk_live_..." />
                      <Button variant="outline" size="sm">Generate New Key</Button>
                    </>
                  )}

                  {integration.id === "whatsapp" && (
                    <>
                      <Label htmlFor="whatsapp-number">WhatsApp Business Number</Label>
                      <Input id="whatsapp-number" defaultValue="+1 (555) 123-4567" />
                      <Label htmlFor="whatsapp-api-key">WhatsApp API Key</Label>
                      <Input id="whatsapp-api-key" type="password" />
                    </>
                  )}

                  {integration.id === "sms" && (
                    <>
                      <Label htmlFor="sms-provider">SMS Provider</Label>
                      <Input id="sms-provider" defaultValue="Twilio" />
                      <Label htmlFor="sms-api-key">SMS API Key</Label>
                      <Input id="sms-api-key" type="password" />
                    </>
                  )}

                  {integration.id === "mra" && (
                    <>
                      <Label htmlFor="mra-username">MRA Username</Label>
                      <Input id="mra-username" />
                      <Label htmlFor="mra-password">MRA Password</Label>
                      <Input id="mra-password" type="password" />
                      <Label htmlFor="mra-endpoint">MRA Endpoint URL</Label>
                      <Input id="mra-endpoint" defaultValue="https://eis.mra.mu/api" />
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

