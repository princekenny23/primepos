"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Bell,
  ShoppingCart,
  Package,
  CreditCard,
  Users,
  FileText,
  X,
} from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import { type Notification } from "@/lib/services/notificationService"

interface NotificationDetailModalProps {
  notification: Notification | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

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

const priorityColors: Record<string, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  info: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
}

export function NotificationDetailModal({
  notification,
  open,
  onOpenChange,
}: NotificationDetailModalProps) {
  if (!notification) return null

  const IconComponent = notificationIcons[notification.type] || Bell
  const priorityColor = priorityColors[notification.priority] || priorityColors.info

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3 mb-2">
            <IconComponent className="h-6 w-6 mt-1 text-muted-foreground" />
            <div className="flex-1">
              <DialogTitle>{notification.title}</DialogTitle>
              <DialogDescription>
                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="space-y-4 py-4">
          {/* Status and Priority */}
          <div className="flex gap-2">
            {!notification.read && (
              <Badge variant="default">Unread</Badge>
            )}
            <Badge className={priorityColor}>
              {notification.priority.charAt(0).toUpperCase() + notification.priority.slice(1)} Priority
            </Badge>
          </div>

          <Separator />

          {/* Message */}
          <div>
            <p className="text-sm font-medium mb-2">Details</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {notification.message}
            </p>
          </div>

          {/* Metadata if available */}
          {notification.metadata && Object.keys(notification.metadata).length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Additional Information</p>
                <div className="space-y-2">
                  {Object.entries(notification.metadata).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-muted-foreground capitalize">
                        {key.replace(/_/g, " ")}:
                      </span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Timestamp */}
          <Separator />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Created: {format(new Date(notification.created_at), "PPpp")}</p>
            {notification.updated_at && (
              <p>Updated: {format(new Date(notification.updated_at), "PPpp")}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
