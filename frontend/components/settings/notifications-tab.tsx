"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Mail, Bell, ExternalLink } from "lucide-react"
import { useState } from "react"
import Link from "next/link"

export function NotificationsTab() {
  const [isSaving, setIsSaving] = useState(false)

  const emailNotifications = [
    { id: "sales", label: "New Sale Notifications", enabled: true },
    { id: "low-stock", label: "Low Stock Alerts", enabled: true },
    { id: "reports", label: "Daily/Weekly Reports", enabled: false },
    { id: "payments", label: "Payment Confirmations", enabled: true },
  ]

  const pushNotifications = [
    { id: "push-sales", label: "New Sale Notifications", enabled: true },
    { id: "push-stock", label: "Stock Alerts", enabled: true },
    { id: "push-orders", label: "New Orders", enabled: false },
  ]

  const handleSave = async () => {
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
    }, 1000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Manage your email and push notification preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Email Notifications</h3>
          </div>
          <div className="space-y-3 ml-7">
            {emailNotifications.map((notification) => (
              <div key={notification.id} className="flex items-center space-x-2">
                <Checkbox
                  id={notification.id}
                  checked={notification.enabled}
                  onCheckedChange={(checked) => {
                    // In production, this would update the notification preference
                  }}
                />
                <Label htmlFor={notification.id} className="cursor-pointer">
                  {notification.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Push Notifications</h3>
          </div>
          <div className="space-y-3 ml-7">
            {pushNotifications.map((notification) => (
              <div key={notification.id} className="flex items-center space-x-2">
                <Checkbox
                  id={notification.id}
                  checked={notification.enabled}
                  onCheckedChange={(checked) => {
                    // In production, this would update the notification preference
                  }}
                />
                <Label htmlFor={notification.id} className="cursor-pointer">
                  {notification.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            You can customize which notifications you receive via email and push notifications.
            Changes will take effect immediately.
          </p>
        </div>

        <div className="flex justify-between items-center">
          <Button 
            variant="outline"
            asChild
          >
            <Link href="/dashboard/settings/notifications">
              <ExternalLink className="mr-2 h-4 w-4" />
              View All Notifications
            </Link>
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

