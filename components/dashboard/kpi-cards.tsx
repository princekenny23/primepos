"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, DollarSign, Users, Package, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface KPICardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: React.ReactNode
  trend?: "up" | "down"
}

function KPICard({ title, value, change, changeLabel, icon, trend }: KPICardProps) {
  const isPositive = trend === "up" || (change !== undefined && change >= 0)
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-4 w-4 text-muted-foreground">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <p className={cn(
            "text-xs flex items-center gap-1 mt-1",
            isPositive ? "text-green-500" : "text-red-500"
          )}>
            {isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{Math.abs(change)}%</span>
            {changeLabel && <span className="text-muted-foreground"> {changeLabel}</span>}
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
  }
}

export function KPICards({ data }: KPICardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <KPICard
        title="Today's Sales"
        value={`MWK ${data.sales.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        change={data.sales.change}
        changeLabel="from yesterday"
        icon={<DollarSign className="h-4 w-4" />}
        trend={data.sales.change >= 0 ? "up" : "down"}
      />
      <KPICard
        title="Customers"
        value={data.customers.value.toLocaleString('en-US')}
        change={data.customers.change}
        changeLabel="this month"
        icon={<Users className="h-4 w-4" />}
        trend={data.customers.change >= 0 ? "up" : "down"}
      />
      <KPICard
        title="Products in Stock"
        value={data.products.value.toLocaleString('en-US')}
        change={data.products.change}
        changeLabel="total items"
        icon={<Package className="h-4 w-4" />}
      />
      <KPICard
        title="Expenses"
        value={`MWK ${data.expenses.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        change={data.expenses.change}
        changeLabel="this month"
        icon={<ArrowDownRight className="h-4 w-4" />}
        trend={data.expenses.change >= 0 ? "down" : "up"}
      />
      <KPICard
        title="Profit"
        value={`MWK ${data.profit.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        change={data.profit.change}
        changeLabel="this month"
        icon={<ArrowUpRight className="h-4 w-4" />}
        trend={data.profit.change >= 0 ? "up" : "down"}
      />
    </div>
  )
}

