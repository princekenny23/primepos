"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { notificationService, type Notification } from "@/lib/services/notificationService"
import { 
  Bell, 
  ShoppingCart, 
  Package, 
  CreditCard, 
  Users,
  FileText,
  Search,
  Check,
  Trash2
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { NotificationDetailModal } from "@/components/modals/notification-detail-modal"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"

const notificationIcons: Record<string, React.ComponentType<any>> = {
  sale: ShoppingCart,
  stock: Package,
  payment: CreditCard,
  system: Bell,
  info: Bell,
  customer: Users,
  staff: Users,
  report: FileText,
  inventory: Package,
}

export default function NotificationsPage() {
  const { toast } = useToast()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterType, setFilterType] = useState("all")
  const [filterRead, setFilterRead] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  useEffect(() => {
    loadNotifications()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadNotifications = async () => {
    setIsLoading(true)
    try {
      const response = await notificationService.list()
      setNotifications(response.results || [])
    } catch (error) {
      console.error("Failed to load notifications:", error)
      toast({
        title: "Error",
        description: "Failed to load notifications",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewDetails = (notification: Notification) => {
    setSelectedNotification(notification)
    setShowDetailModal(true)
    
    // Mark as read when viewing details
    if (!notification.read) {
      handleMarkAsRead(notification)
    }
  }

  const handleMarkAsRead = async (notification: Notification) => {
    try {
      await notificationService.markRead(notification.id)
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      )
      if (selectedNotification?.id === notification.id) {
        setSelectedNotification({ ...notification, read: true })
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllRead()
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (error) {
      console.error("Failed to mark all as read:", error)
    }
  }

  const filteredNotifications = notifications.filter(n => {
    const typeMatch = filterType === "all" || n.type === filterType
    const readMatch = filterRead === "all" || 
      (filterRead === "unread" && !n.read) || 
      (filterRead === "read" && n.read)
    const searchMatch = searchQuery === "" || 
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.message.toLowerCase().includes(searchQuery.toLowerCase())
    return typeMatch && readMatch && searchMatch
  })

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <DashboardLayout>
      <PageLayout
        title="Notifications"
        description={`You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
      >
        {/* Filters and Search */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="sale">Sales</SelectItem>
              <SelectItem value="stock">Stock</SelectItem>
              <SelectItem value="payment">Payments</SelectItem>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="report">Reports</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterRead} onValueChange={setFilterRead}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="read">Read</SelectItem>
            </SelectContent>
          </Select>

          <Button 
            variant="default"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
            className="w-full"
          >
            <Check className="mr-2 h-4 w-4" />
            Mark All Read
          </Button>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No notifications found</p>
            </div>
          ) : (
            filteredNotifications.map((notification) => {
              const IconComponent = notificationIcons[notification.type] || Bell
              return (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                    notification.read
                      ? "bg-muted/50 border-muted hover:bg-muted/70"
                      : "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900"
                  }`}
                  onClick={() => handleViewDetails(notification)}
                >
                  <div className="flex items-start gap-3">
                    <IconComponent className="h-5 w-5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium">{notification.title}</p>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                        </div>
                        {!notification.read && (
                          <Badge variant="default" className="text-xs ml-2 flex-shrink-0">
                            New
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </PageLayout>

      {/* Notification Detail Modal */}
      <NotificationDetailModal
        notification={selectedNotification}
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        onMarkAsRead={handleMarkAsRead}
        onRefresh={loadNotifications}
      />
    </DashboardLayout>
  )
}
