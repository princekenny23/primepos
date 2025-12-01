"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Check, Clock, User, MapPin } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface ViewNotificationDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  notification: any
}

export function ViewNotificationDetailsModal({ 
  open, 
  onOpenChange, 
  notification 
}: ViewNotificationDetailsModalProps) {
  const { toast } = useToast()

  if (!notification) return null

  const handleMarkAsRead = () => {
    // In production, this would call API
    toast({
      title: "Notification Marked as Read",
      description: "Notification has been marked as read.",
    })
    onOpenChange(false)
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="text-4xl">{getNotificationIcon(notification.type)}</div>
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2">
                {notification.title}
                {!notification.read && (
                  <Badge variant="default" className="h-5 px-2 text-xs">
                    New
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={`h-5 px-2 text-xs ${getPriorityColor(notification.priority)}`}
                >
                  {notification.priority}
                </Badge>
              </DialogTitle>
              <DialogDescription className="mt-2">
                {new Date(notification.timestamp).toLocaleString()}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Message</p>
            <p className="text-sm text-muted-foreground">{notification.message}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Timestamp</span>
              </div>
              <p className="font-medium">
                {new Date(notification.timestamp).toLocaleString()}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Status</span>
              </div>
              <p className="font-medium">
                {notification.read ? "Read" : "Unread"}
              </p>
            </div>
          </div>

          {notification.type === "sale" && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                You can view the full sale details in the Sales module.
              </p>
            </div>
          )}

          {notification.type === "stock" && (
            <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
              <p className="text-sm text-orange-800 dark:text-orange-200">
                Consider restocking this product soon to avoid stockouts.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          {!notification.read && (
            <Button variant="outline" onClick={handleMarkAsRead}>
              <Check className="mr-2 h-4 w-4" />
              Mark as Read
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

