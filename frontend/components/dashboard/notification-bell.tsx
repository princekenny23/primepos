"use client"

import { useState, useEffect } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { notificationService, type Notification } from "@/lib/services/notificationService"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"
import { NotificationDetailModal } from "@/components/modals/notification-detail-modal"

export function NotificationBell() {
  const { currentBusiness } = useBusinessStore()
  const { currentOutlet } = useTenant()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => {
    if (!currentBusiness) return

    loadNotifications()
    loadUnreadCount()

    // Poll for notifications every 30 seconds
    const interval = setInterval(() => {
      loadNotifications()
      loadUnreadCount()
    }, 30000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBusiness, currentOutlet])

  const loadNotifications = async () => {
    if (!currentBusiness) return

    try {
      setIsLoading(true)
      const filters: any = { page_size: 10 }
      // Filter by current outlet if available
      if (currentOutlet?.id) {
        filters.outlet_id = currentOutlet.id
      }
      const response = await notificationService.list(filters)
      setNotifications(response.results || [])
    } catch (error) {
      console.error("Failed to load notifications:", error)
      setNotifications([])
    } finally {
      setIsLoading(false)
    }
  }

  const loadUnreadCount = async () => {
    if (!currentBusiness) return

    try {
      const count = await notificationService.getUnreadCount()
      setUnreadCount(count?.unread_count ?? 0)
    } catch (error) {
      console.error("Failed to load unread count:", error)
      setUnreadCount(0)
    }
  }

  const handleMarkAsRead = async (id: string | number) => {
    try {
      await notificationService.markRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
      // Refresh unread count
      await loadUnreadCount()
    } catch (error) {
      console.error("Failed to mark notification as read:", error)
    }
  }

  const handleOpenDetail = (notification: Notification) => {
    setSelectedNotification(notification)
    setShowDetail(true)
    if (!notification.read) {
      handleMarkAsRead(notification.id)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "sale":
        return "💰"
      case "stock":
        return "⚠️"
      case "payment":
        return "💳"
      case "customer":
        return "👤"
      case "staff":
        return "👥"
      case "report":
        return "📊"
      case "system":
        return "🔔"
      case "shift":
        return "🕐"
      case "inventory":
        return "📦"
      case "delivery":
        return "🚚"
      default:
        return "📢"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
      case "normal":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
      case "low":
        return "bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-350"
      default:
        return ""
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <div className="relative flex items-center justify-center">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <>
                {/* Blinking blue ring - outer pulsing ring */}
                <span className="absolute inset-0 rounded-full border-2 border-blue-900 animate-ping opacity-75" />
                {/* Blinking blue ring - solid ring */}
                <span className="absolute inset-0 rounded-full border-2 border-blue-900 animate-blink" />
              </>
            )}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="p-2">
          <div className="flex items-center justify-between mb-2 px-2">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <ScrollArea className="h-[400px]">
            <div className="space-y-1">
              {isLoading ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No notifications
                </div>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleOpenDetail(notification)}
                    className="block w-full text-left"
                  >
                    <div
                      className={`p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer ${
                        !notification.read ? "bg-blue-50 dark:bg-blue-950/20" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium truncate">
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <span className="h-2 w-2 bg-primary rounded-full flex-shrink-0 ml-2" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-xs ${getPriorityColor(notification.priority)}`}
                            >
                              {notification.priority}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
          <div className="border-t pt-2 mt-2">
            <Link href="/dashboard/settings/notifications">
              <Button variant="ghost" className="w-full text-sm">
                View All Notifications
              </Button>
            </Link>
          </div>
        </div>
      </DropdownMenuContent>
      <NotificationDetailModal
        notification={selectedNotification}
        open={showDetail}
        onOpenChange={(open) => {
          setShowDetail(open)
          if (!open) {
            setSelectedNotification(null)
          }
        }}
        onMarkAsRead={(notification) => handleMarkAsRead(notification.id)}
        onRefresh={() => {
          loadNotifications()
          loadUnreadCount()
        }}
      />
    </DropdownMenu>
  )
}
