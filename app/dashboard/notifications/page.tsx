"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bell, Check, CheckCheck, Trash2, Filter } from "lucide-react"
import { useState } from "react"
import { ViewNotificationDetailsModal } from "@/components/modals/view-notification-details-modal"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function NotificationsPage() {
  const [showDetails, setShowDetails] = useState(false)
  const [showMarkAllRead, setShowMarkAllRead] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState<any>(null)
  const [filter, setFilter] = useState<string>("all")

  // Mock notifications
  const notifications = [
    {
      id: "1",
      type: "sale",
      title: "New Sale Completed",
      message: "Sale #1001 completed for $125.50",
      timestamp: "2024-01-15T10:30:00",
      read: false,
      priority: "normal",
    },
    {
      id: "2",
      type: "stock",
      title: "Low Stock Alert",
      message: "Product B is running low (12 units remaining)",
      timestamp: "2024-01-15T09:15:00",
      read: false,
      priority: "high",
    },
    {
      id: "3",
      type: "payment",
      title: "Payment Received",
      message: "Payment of $89.99 received via Card",
      timestamp: "2024-01-15T08:45:00",
      read: true,
      priority: "normal",
    },
    {
      id: "4",
      type: "customer",
      title: "New Customer Registered",
      message: "John Doe has been added to your customer database",
      timestamp: "2024-01-14T16:20:00",
      read: true,
      priority: "low",
    },
    {
      id: "5",
      type: "report",
      title: "Daily Report Ready",
      message: "Your daily sales report for January 14 is ready",
      timestamp: "2024-01-14T23:59:00",
      read: false,
      priority: "normal",
    },
  ]

  const filteredNotifications = notifications.filter(notif => {
    if (filter === "unread") return !notif.read
    if (filter === "read") return notif.read
    return true
  })

  const unreadCount = notifications.filter(n => !n.read).length

  const handleMarkAsRead = (id: string) => {
    // In production, this would call API
  }

  const handleMarkAllAsRead = () => {
    // In production, this would call API
    setShowMarkAllRead(false)
  }

  const handleDelete = (id: string) => {
    // In production, this would call API
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
      case "report":
        return "📊"
      default:
        return "🔔"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
      case "normal":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
      case "low":
        return "bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-200"
      default:
        return ""
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Notifications</h1>
            <p className="text-muted-foreground">View and manage your notifications</p>
          </div>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                onClick={() => setShowMarkAllRead(true)}
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                Mark All as Read
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Notifications</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{notifications.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unread</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{unreadCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Read</CardTitle>
              <Check className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {notifications.length - unreadCount}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Notifications</SelectItem>
                  <SelectItem value="unread">Unread Only</SelectItem>
                  <SelectItem value="read">Read Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notifications List */}
        <Card>
          <CardHeader>
            <CardTitle>All Notifications</CardTitle>
            <CardDescription>
              {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border rounded-lg cursor-pointer hover:bg-muted transition-colors ${
                    !notification.read ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800" : ""
                  }`}
                  onClick={() => {
                    setSelectedNotification(notification)
                    setShowDetails(true)
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="text-2xl">{getNotificationIcon(notification.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{notification.title}</h4>
                          {!notification.read && (
                            <Badge variant="default" className="h-4 px-1.5 text-xs">
                              New
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={`h-4 px-1.5 text-xs ${getPriorityColor(notification.priority)}`}
                          >
                            {notification.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(notification.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMarkAsRead(notification.id)
                          }}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(notification.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <ViewNotificationDetailsModal
        open={showDetails}
        onOpenChange={setShowDetails}
        notification={selectedNotification}
      />

      {/* Mark All as Read Confirmation */}
      <AlertDialog open={showMarkAllRead} onOpenChange={setShowMarkAllRead}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark All as Read?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark all {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""} as read? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkAllAsRead}>
              Mark All as Read
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}

