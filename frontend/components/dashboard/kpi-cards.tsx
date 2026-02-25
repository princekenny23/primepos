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
  colorVariant?: "blue" | "emerald" | "amber" | "green" | "indigo" | "orange" | "slate"
}

function KPICard({ title, value, change, changeLabel, icon, trend, business, colorVariant = "slate" }: KPICardProps) {
  const isPositive = trend === "up" || (change !== undefined && change >= 0)
  
  const colorMap = {
    blue: { bg: "bg-blue-50", border: "border-blue-200", icon: "text-blue-600", header: "bg-blue-100/50" },
    emerald: { bg: "bg-emerald-50", border: "border-emerald-200", icon: "text-emerald-600", header: "bg-emerald-100/50" },
    amber: { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-600", header: "bg-amber-100/50" },
    green: { bg: "bg-green-50", border: "border-green-200", icon: "text-green-600", header: "bg-green-100/50" },
    indigo: { bg: "bg-indigo-50", border: "border-indigo-200", icon: "text-indigo-600", header: "bg-indigo-100/50" },
    orange: { bg: "bg-orange-50", border: "border-orange-200", icon: "text-orange-600", header: "bg-orange-100/50" },
    slate: { bg: "bg-slate-50", border: "border-slate-200", icon: "text-slate-600", header: "bg-slate-100/50" }
  }
  
  const colors = colorMap[colorVariant]
  
  return (
    <Card className={cn("h-full border-2", colors.bg, colors.border)}>
      <CardHeader className={cn("flex flex-row items-center justify-between space-y-0 pb-0 pt-2 px-3 rounded-t-lg", colors.header)}>
        <CardTitle className="text-xs font-medium leading-tight">{title}</CardTitle>
        <div className={cn("h-4 w-4", colors.icon)}>
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
          colorVariant="blue"
        />
        <KPICard
          title="Transactions"
          value={data.transactions.value.toLocaleString('en-US')}
          change={data.transactions.change}
          changeLabel="from yesterday"
          icon={<ShoppingCart className="h-6 w-6" />}
          trend={data.transactions.change >= 0 ? "up" : "down"}
          business={business}
          colorVariant="emerald"
        />
        <KPICard
          title="Expenses"
          value={formatCurrency(data.expenses.value, business)}
          change={data.expenses.change}
          changeLabel="this month"
          icon={<ArrowDownRight className="h-6 w-6" />}
          trend={data.expenses.change >= 0 ? "down" : "up"}
          business={business}
          colorVariant="amber"
        />
        <KPICard
          title="Profit"
          value={formatCurrency(data.profit.value, business)}
          change={data.profit.change}
          changeLabel="today"
          icon={<ArrowUpRight className="h-6 w-6" />}
          trend={data.profit.change >= 0 ? "up" : "down"}
          business={business}
          colorVariant="green"
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
          colorVariant="indigo"
        />
        <KPICard
          title="Outstanding Credit"
          value={formatCurrency(data.outstandingCredit.value, business)}
          change={data.outstandingCredit.change}
          changeLabel="receivables"
          icon={<CreditCard className="h-6 w-6" />}
          business={business}
          colorVariant="orange"
        />
        <KPICard
          title="Employees"
          value={data.products.value.toLocaleString('en-US')}
          change={data.products.change}
          changeLabel="total"
          icon={<Users className="h-6 w-6" />}
          business={business}
          colorVariant="slate"
        />
        <KPICard
          title="Purchases (Avg Order Value)"
          value={formatCurrency(data.avgOrderValue.value, business)}
          change={data.avgOrderValue.change}
          changeLabel="this period"
          icon={<ShoppingCart className="h-6 w-6" />}
          trend={data.avgOrderValue.change >= 0 ? "up" : "down"}
          business={business}
          colorVariant="blue"
        />
      </div>
    </div>
  )
}

