"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTenant } from "@/contexts/tenant-context"
import { useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function OutletSettingsPage() {
  const params = useParams()
  const outletId = params.id as string
  const { outlets } = useTenant()
  const outlet = outlets.find((o) => o.id === outletId)

  if (!outlet) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">Outlet not found</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/outlets">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Outlet Settings</h1>
            <p className="text-muted-foreground">{outlet.name} - Configuration</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Update outlet details and contact information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="outlet-name">Outlet Name</Label>
                <Input id="outlet-name" defaultValue={outlet.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outlet-address">Address</Label>
                <Input id="outlet-address" defaultValue={outlet.address} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outlet-phone">Phone</Label>
                <Input id="outlet-phone" type="tel" defaultValue={outlet.phone} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outlet-email">Email</Label>
                <Input id="outlet-email" type="email" defaultValue={outlet.email} />
              </div>
              <Button>Save Changes</Button>
            </CardContent>
          </Card>

          {/* POS Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>POS Configuration</CardTitle>
              <CardDescription>Configure POS settings for this outlet</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="printer-setup">Printer Setup</Label>
                <Select defaultValue={outlet.settings?.printerSetup || "Thermal Printer"}>
                  <SelectTrigger id="printer-setup">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Thermal Printer">Thermal Printer</SelectItem>
                    <SelectItem value="Mobile Printer">Mobile Printer</SelectItem>
                    <SelectItem value="Network Printer">Network Printer</SelectItem>
                    <SelectItem value="None">No Printer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pos-mode">POS Mode</Label>
                <Select defaultValue={outlet.settings?.posMode || "Standard"}>
                  <SelectTrigger id="pos-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Standard">Standard</SelectItem>
                    <SelectItem value="Express">Express</SelectItem>
                    <SelectItem value="Quick">Quick</SelectItem>
                    <SelectItem value="Restaurant">Restaurant</SelectItem>
                    <SelectItem value="Retail">Retail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="receipt-template">Receipt Template</Label>
                <Select defaultValue={outlet.settings?.receiptTemplate || "Default"}>
                  <SelectTrigger id="receipt-template">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Default">Default</SelectItem>
                    <SelectItem value="Compact">Compact</SelectItem>
                    <SelectItem value="Minimal">Minimal</SelectItem>
                    <SelectItem value="Detailed">Detailed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button>Save Configuration</Button>
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>Outlet Status</CardTitle>
              <CardDescription>Manage outlet activation status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Outlet Status</Label>
                  <p className="text-sm text-muted-foreground">
                    {outlet.isActive ? "Outlet is currently active" : "Outlet is inactive"}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm ${
                    outlet.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {outlet.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <Button variant={outlet.isActive ? "destructive" : "default"}>
                {outlet.isActive ? "Deactivate Outlet" : "Activate Outlet"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}

