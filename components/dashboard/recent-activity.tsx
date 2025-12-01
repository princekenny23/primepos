"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ShoppingCart, Package, UserPlus, DollarSign, AlertCircle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface Activity {
  id: string
  type: "sale" | "inventory" | "customer" | "payment" | "alert"
  title: string
  description: string
  timestamp: Date
  amount?: number
}

interface RecentActivityProps {
  activities: Activity[]
}

const activityIcons = {
  sale: ShoppingCart,
  inventory: Package,
  customer: UserPlus,
  payment: DollarSign,
  alert: AlertCircle,
}

const activityColors = {
  sale: "text-blue-500",
  inventory: "text-purple-500",
  customer: "text-green-500",
  payment: "text-yellow-500",
  alert: "text-red-500",
}

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest updates and transactions</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-4">
            {activities.map((activity) => {
              const Icon = activityIcons[activity.type]
              const colorClass = activityColors[activity.type]
              
              return (
                <div key={activity.id} className="flex items-start gap-4 pb-4 border-b last:border-0">
                  <div className={`${colorClass} mt-1`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{activity.title}</p>
                    <p className="text-sm text-muted-foreground">{activity.description}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                      </p>
                      {activity.amount && (
                        <p className="text-sm font-semibold">${activity.amount.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

