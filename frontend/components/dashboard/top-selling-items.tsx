"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { formatCurrency } from "@/lib/utils/currency"
import type { Business } from "@/lib/types"

interface TopSellingItem {
  id: string
  name: string
  sku: string
  quantity: number
  revenue: number
  change: number
}

interface TopSellingItemsProps {
  items: TopSellingItem[]
  business?: Business | null
}

const CHART_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
  "#22C55E",
  "#F97316",
]

const TopSellingTooltip = ({
  active,
  payload,
  business,
}: {
  active?: boolean
  payload?: any[]
  business?: Business | null
}) => {
  if (!active || !payload?.length) return null
  const data = payload[0]?.payload
  if (!data) return null

  const hasRevenue = (data.revenue || 0) > 0
  return (
    <div className="rounded-md border bg-background p-2 text-sm shadow-sm">
      <p className="font-medium">{data.name}</p>
      {hasRevenue ? (
        <p className="text-muted-foreground">
          {formatCurrency(data.revenue, business, { showSymbol: true, decimals: 2 })}
        </p>
      ) : (
        <p className="text-muted-foreground">{data.quantity.toLocaleString()} sold</p>
      )}
    </div>
  )
}

export function TopSellingItems({ items, business }: TopSellingItemsProps) {
  const chartData = items
    .map((item) => ({
      name: item.name,
      value: item.revenue > 0 ? item.revenue : item.quantity,
      revenue: item.revenue,
      quantity: item.quantity,
    }))
    .filter((item) => item.value > 0)

  const totalValue = chartData.reduce((sum, item) => sum + item.value, 0)

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle>Top Selling Items</CardTitle>
        <CardDescription>Best performing products this period</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {chartData.length === 0 ? (
          <div className="flex h-44 items-center justify-center text-muted-foreground">
            No top selling data available
          </div>
        ) : (
          <>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={42}
                    outerRadius={66}
                    paddingAngle={2}
                  >
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<TopSellingTooltip business={business} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 text-center text-sm text-muted-foreground">
              Total: {formatCurrency(totalValue, business, { showSymbol: true, decimals: 2 })}
            </div>

            <ul className="mt-3 space-y-1.5 max-h-[8.5rem] overflow-y-auto pr-1">
              {chartData.slice(0, 5).map((item, index) => (
                <li key={`${item.name}-${index}`} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="truncate">{item.name}</span>
                  </div>
                  <span className="font-medium">
                    {formatCurrency(item.value, business, { showSymbol: true, decimals: 2 })}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}

