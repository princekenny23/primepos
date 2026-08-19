"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ShoppingCart, Package, UserPlus, DollarSign, AlertCircle, Truck, Wallet, ClipboardCheck, Users, LogIn } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { formatCurrency } from "@/lib/utils/currency"
import type { Business } from "@/lib/types"

interface Activity {
  id: string
  type: "sale" | "inventory" | "customer" | "payment" | "purchase" | "expense" | "product" | "stock_take" | "shift" | "login" | "alert"
  title: string
  description: string
  timestamp: Date
  amount?: number
}

interface RecentActivityProps {
  activities: Activity[]
  business?: Business | null
}

const activityIcons = {
  sale: ShoppingCart,
  inventory: Package,
  customer: UserPlus,
  payment: DollarSign,
  purchase: Truck,
  expense: Wallet,
  product: Package,
  stock_take: ClipboardCheck,
  shift: Users,
  login: LogIn,
  alert: AlertCircle,
}

const activityColors = {
  sale: "text-blue-500",
  inventory: "text-purple-500",
  customer: "text-green-500",
  payment: "text-yellow-500",
  purchase: "text-indigo-500",
  expense: "text-amber-600",
  product: "text-cyan-600",
  stock_take: "text-violet-600",
  shift: "text-teal-600",
  login: "text-slate-600",
  alert: "text-red-500",
}

export function RecentActivity({ activities, business }: RecentActivityProps) {
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
                        <p className="text-sm font-semibold">
                          {formatCurrency(activity.amount, business, { showSymbol: true, decimals: 2 })}
                        </p>
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

