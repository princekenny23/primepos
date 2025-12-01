"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { Clock, ShoppingCart, Package, Users, AlertTriangle, TrendingUp } from "lucide-react"

interface Activity {
  id: string
  type: "sale" | "stock" | "staff" | "alert" | "report"
  action: string
  user: string
  timestamp: string
  details?: string
}

export function ActivityLogSidebar() {
  // Mock activity data
  const activities: Activity[] = [
    {
      id: "1",
      type: "sale",
      action: "New Sale",
      user: "John Doe",
      timestamp: new Date().toISOString(),
      details: "Sale #1001 - MWK 125.50",
    },
    {
      id: "2",
      type: "stock",
      action: "Stock Low Alert",
      user: "System",
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      details: "Product B - 12 units remaining",
    },
    {
      id: "3",
      type: "staff",
      action: "New Staff Added",
      user: "Admin",
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      details: "Jane Doe added to system",
    },
    {
      id: "4",
      type: "sale",
      action: "Sale Completed",
      user: "John Doe",
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      details: "Sale #1000 - MWK 89.99",
    },
    {
      id: "5",
      type: "stock",
      action: "Stock Adjustment",
      user: "Admin",
      timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      details: "Product A - +50 units",
    },
    {
      id: "6",
      type: "report",
      action: "Report Generated",
      user: "John Doe",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      details: "Sales Report - January 2024",
    },
  ]

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "sale":
        return <ShoppingCart className="h-4 w-4 text-green-500" />
      case "stock":
        return <Package className="h-4 w-4 text-blue-500" />
      case "staff":
        return <Users className="h-4 w-4 text-purple-500" />
      case "alert":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      case "report":
        return <TrendingUp className="h-4 w-4 text-indigo-500" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case "sale":
        return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
      case "stock":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
      case "staff":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200"
      case "alert":
        return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200"
      case "report":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"
      default:
        return ""
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm">Recent Activity</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Latest system activities
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium truncate">
                      {activity.action}
                    </p>
                    <Badge
                      variant="outline"
                      className={`text-xs ${getActivityColor(activity.type)}`}
                    >
                      {activity.type}
                    </Badge>
                  </div>
                  {activity.details && (
                    <p className="text-xs text-muted-foreground mb-1 truncate">
                      {activity.details}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{activity.user}</span>
                    <span>•</span>
                    <span>
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="p-4 border-t">
        <a
          href="/dashboard/activity-log"
          className="text-xs text-primary hover:underline"
        >
          View Full Activity Log →
        </a>
      </div>
    </div>
  )
}

