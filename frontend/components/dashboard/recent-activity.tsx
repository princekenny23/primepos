"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { notificationService, type Notification } from "@/lib/services/notificationService"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"
import { NotificationDetailModal } from "@/components/modals/notification-detail-modal"
import { PageLoading } from "@/components/ui/page-loading"
import { APP_REFRESH_EVENT } from "@/lib/utils/page-refresh"

const notificationIcons: Record<string, string> = {
  sale: "💰", stock: "⚠️", payment: "💳", customer: "👤", staff: "👥",
  report: "📊", system: "🔔", shift: "🕐", inventory: "📦", delivery: "🚚",
}

const priorityColors: Record<string, string> = {
  urgent: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  normal: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  low: "bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-200",
}

export function RecentActivity() {
  const { currentBusiness, currentOutlet: businessOutlet } = useBusinessStore()
  const { currentOutlet: tenantOutlet } = useTenant()
  const currentOutlet = tenantOutlet || businessOutlet
  const outletId = currentOutlet?.id
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const loadNotifications = useCallback(async () => {
    if (!currentBusiness) {
      setNotifications([])
      setIsLoading(false)
      return
    }
    try {
      setIsLoading(true)
      const result = await notificationService.list({
        page_size: 10,
        ...(outletId ? { outlet_id: outletId } : {}),
      })
      setNotifications(result.results)
    } catch (error) {
      console.error("Failed to load dashboard notifications:", error)
      setNotifications([])
    } finally {
      setIsLoading(false)
    }
  }, [currentBusiness, outletId])

  useEffect(() => {
    void loadNotifications()
    const intervalId = window.setInterval(() => void loadNotifications(), 30000)
    window.addEventListener(APP_REFRESH_EVENT, loadNotifications)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener(APP_REFRESH_EVENT, loadNotifications)
    }
  }, [loadNotifications])

  const openNotification = async (notification: Notification) => {
    setSelectedNotification(notification)
    setDetailOpen(true)
    if (!notification.read) {
      try {
        const updated = await notificationService.markRead(notification.id)
        setNotifications((previous) => previous.map((item) => item.id === notification.id ? { ...item, ...updated, read: true } : item))
        setSelectedNotification((previous) => previous?.id === notification.id ? { ...previous, ...updated, read: true } : previous)
      } catch (error) {
        console.error("Failed to mark notification as read:", error)
      }
    }
  }

  const description = useMemo(
    () => currentOutlet?.name ? `Latest notifications for ${currentOutlet.name}` : "Latest notifications",
    [currentOutlet?.name]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activities</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {isLoading ? <PageLoading label="Loading recent notifications…" className="min-h-64" /> : notifications.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No notifications</p>
          ) : (
            <div className="space-y-1">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void openNotification(notification)}
                  className={`block w-full rounded-lg border-b p-3 text-left transition-colors hover:bg-accent last:border-0 ${!notification.read ? "bg-blue-50/70 dark:bg-blue-950/20" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg" aria-hidden="true">{notificationIcons[notification.type] || "📢"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{notification.title}</p>
                        {!notification.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                      </div>
                      <p className="mb-2 text-sm text-muted-foreground">{notification.message}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </span>
                        <Badge variant="outline" className={`text-xs ${priorityColors[notification.priority] || ""}`}>
                          {notification.priority}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
      <NotificationDetailModal
        notification={selectedNotification}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setSelectedNotification(null)
        }}
      />
    </Card>
  )
}

