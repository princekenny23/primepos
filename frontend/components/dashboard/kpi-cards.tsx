"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, DollarSign, Users, ArrowUpRight, ArrowDownRight, ShoppingCart, CreditCard } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/currency"
import type { Business } from "@/lib/types"

interface KPICardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: React.ReactNode
  trend?: "up" | "down"
  business?: Business | null
}

function KPICard({ title, value, change, changeLabel, icon, trend, business }: KPICardProps) {
  const isPositive = trend === "up" || (change !== undefined && change >= 0)
  
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-2 px-3">
        <CardTitle className="text-xs font-medium leading-tight">{title}</CardTitle>
        <div className="h-4 w-4 text-blue-900">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="px-3 py-1.5">
        <div className="text-lg font-bold leading-tight">{value}</div>
        {change !== undefined && (
          <p className={cn(
            "text-xs flex items-center gap-0.5 mt-0.5 leading-tight",
            isPositive ? "text-green-500" : "text-red-500"
          )}>
            {isPositive ? (
              <TrendingUp className="h-2.5 w-2.5" />
            ) : (
              <TrendingDown className="h-2.5 w-2.5" />
            )}
            <span>{Math.abs(change)}%</span>
            {changeLabel && <span className="text-muted-foreground text-xs"> {changeLabel}</span>}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

interface KPICardsProps {
  data: {
    sales: { value: number; change: number }
    customers: { value: number; change: number }
    products: { value: number; change: number }
    expenses: { value: number; change: number }
    profit: { value: number; change: number }
    transactions: { value: number; change: number }
    avgOrderValue: { value: number; change: number }
    lowStockItems: { value: number; change: number }
    outstandingCredit: { value: number; change: number }
    returns: { value: number; change: number }
  }
  business?: Business | null
}

export function KPICards({ data, business }: KPICardsProps) {
  return (
    <div className="space-y-4">
      {/* Group 1: Sales Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Today's Sales"
          value={formatCurrency(data.sales.value, business)}
          change={data.sales.change}
          changeLabel="from yesterday"
          icon={<DollarSign className="h-6 w-6" />}
          trend={data.sales.change >= 0 ? "up" : "down"}
          business={business}
        />
        <KPICard
          title="Transactions"
          value={data.transactions.value.toLocaleString('en-US')}
          change={data.transactions.change}
          changeLabel="from yesterday"
          icon={<ShoppingCart className="h-6 w-6" />}
          trend={data.transactions.change >= 0 ? "up" : "down"}
          business={business}
        />
        <KPICard
          title="Expenses"
          value={formatCurrency(data.expenses.value, business)}
          change={data.expenses.change}
          changeLabel="this month"
          icon={<ArrowDownRight className="h-6 w-6" />}
          trend={data.expenses.change >= 0 ? "down" : "up"}
          business={business}
        />
        <KPICard
          title="Profit"
          value={formatCurrency(data.profit.value, business)}
          change={data.profit.change}
          changeLabel="today"
          icon={<ArrowUpRight className="h-6 w-6" />}
          trend={data.profit.change >= 0 ? "up" : "down"}
          business={business}
        />
      </div>

      {/* Group 2: Business Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Customers"
          value={data.customers.value.toLocaleString('en-US')}
          change={data.customers.change}
          changeLabel="total"
          icon={<Users className="h-6 w-6" />}
          trend={data.customers.change >= 0 ? "up" : "down"}
          business={business}
        />
        <KPICard
          title="Outstanding Credit"
          value={formatCurrency(data.outstandingCredit.value, business)}
          change={data.outstandingCredit.change}
          changeLabel="receivables"
          icon={<CreditCard className="h-6 w-6" />}
          business={business}
        />
        <KPICard
          title="Employees"
          value={data.products.value.toLocaleString('en-US')}
          change={data.products.change}
          changeLabel="total"
          icon={<Users className="h-6 w-6" />}
          business={business}
        />
        <KPICard
          title="Purchases (Avg Order Value)"
          value={formatCurrency(data.avgOrderValue.value, business)}
          change={data.avgOrderValue.change}
          changeLabel="this period"
          icon={<ShoppingCart className="h-6 w-6" />}
          trend={data.avgOrderValue.change >= 0 ? "up" : "down"}
          business={business}
        />
      </div>
    </div>
  )
}

