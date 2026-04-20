"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, DollarSign, Users, ArrowUpRight, ArrowDownRight, CreditCard } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/currency"
import type { Business } from "@/lib/types"

interface KPICardProps {
  title: string
  value: React.ReactNode
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
    <Card className={cn("h-full min-h-[82px] border", colors.bg, colors.border)}>
      <CardHeader className={cn("flex flex-row items-center justify-between space-y-0 px-2.5 py-1.5 rounded-t-lg", colors.header)}>
        <CardTitle className="text-[10px] font-medium leading-tight tracking-wide">{title}</CardTitle>
        <div className={cn("h-3 w-3", colors.icon)}>
          {icon}
        </div>
      </CardHeader>
      <CardContent className="px-2.5 pb-1.5 pt-1">
        <div className="text-sm font-bold leading-tight lg:text-base">{value}</div>
        {change !== undefined && (
          <p className={cn(
            "mt-0.5 flex items-center gap-0.5 text-[10px] leading-tight",
            isPositive ? "text-green-500" : "text-red-500"
          )}>
            {isPositive ? (
              <TrendingUp className="h-2 w-2" />
            ) : (
              <TrendingDown className="h-2 w-2" />
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
    lowStockItems: { value: number; change: number }
    outstandingCredit: { value: number; change: number }
    returns: { value: number; change: number }
  }
  business?: Business | null
}

export function KPICards({ data, business }: KPICardsProps) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      <KPICard
        title="Sales"
        value={
          <span className="inline-flex items-center gap-1">
            <span className="text-[10px] font-semibold tracking-wide">MWK</span>
            {formatCurrency(data.sales.value, business, { symbolOverride: "MWK" })}
          </span>
        }
        change={data.sales.change}
        changeLabel="vs previous period"
        icon={<span className="text-[9px] font-semibold tracking-wide">MWK</span>}
        trend={data.sales.change >= 0 ? "up" : "down"}
        business={business}
        colorVariant="blue"
      />
      <KPICard
        title="Expenses"
        value={formatCurrency(data.expenses.value, business)}
        change={data.expenses.change}
        changeLabel="vs previous period"
        icon={<ArrowDownRight className="h-3.5 w-3.5" />}
        trend={data.expenses.change >= 0 ? "down" : "up"}
        business={business}
        colorVariant="amber"
      />
      <KPICard
        title="Profit"
        value={formatCurrency(data.profit.value, business)}
        change={data.profit.change}
        changeLabel="vs previous period"
        icon={<ArrowUpRight className="h-3.5 w-3.5" />}
        trend={data.profit.change >= 0 ? "up" : "down"}
        business={business}
        colorVariant="green"
      />
      <KPICard
        title="Customers"
        value={data.customers.value.toLocaleString('en-US')}
        change={data.customers.change}
        changeLabel="total"
        icon={<Users className="h-3.5 w-3.5" />}
        trend={data.customers.change >= 0 ? "up" : "down"}
        business={business}
        colorVariant="indigo"
      />
      <KPICard
        title="Outstanding Credit"
        value={formatCurrency(data.outstandingCredit.value, business)}
        change={data.outstandingCredit.change}
        changeLabel="receivables"
        icon={<CreditCard className="h-3.5 w-3.5" />}
        business={business}
        colorVariant="orange"
      />
      <KPICard
        title="Employees"
        value={(data as any).employees?.value?.toLocaleString('en-US') || data.products.value.toLocaleString('en-US')}
        change={(data as any).employees?.change || data.products.change}
        changeLabel="total"
        icon={<Users className="h-3.5 w-3.5" />}
        business={business}
        colorVariant="slate"
      />
    </div>
  )
}

