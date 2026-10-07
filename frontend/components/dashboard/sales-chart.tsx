"use client"

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { format, isValid, parseISO } from "date-fns"

interface SalesChartProps {
  data: Array<{
    date: string
    sales: number
    profit: number
  }>
  type?: "line" | "area"
}

export function SalesChart({ data, type = "area" }: SalesChartProps) {
  const formatDateLabel = (value: string) => {
    const parsed = parseISO(value)
    return isValid(parsed) ? format(parsed, "MMM d") : value
  }
  const formatAmount = (value: number) => `MWK ${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`

  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={formatDateLabel} />
          <YAxis yAxisId="sales" tickFormatter={formatAmount} />
          <YAxis yAxisId="profit" orientation="right" tickFormatter={formatAmount} />
          <Tooltip labelFormatter={(label) => formatDateLabel(String(label))} formatter={(value: number) => formatAmount(value)} />
          <Legend />
          <Line 
            type="monotone" 
            yAxisId="sales"
            dataKey="sales" 
            stroke="#3B82F6" 
            strokeWidth={2}
            name="Sales"
          />
          <Line 
            type="monotone" 
            yAxisId="profit"
            dataKey="profit" 
            stroke="#10B981" 
            strokeWidth={2}
            name="Profit"
          />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={formatDateLabel} />
        <YAxis yAxisId="sales" tickFormatter={formatAmount} />
        <YAxis yAxisId="profit" orientation="right" tickFormatter={formatAmount} />
        <Tooltip labelFormatter={(label) => formatDateLabel(String(label))} formatter={(value: number) => formatAmount(value)} />
        <Legend />
        <Area 
          type="monotone" 
          yAxisId="sales"
          dataKey="sales" 
          stroke="#3B82F6" 
          fillOpacity={1}
          fill="url(#colorSales)"
          name="Sales"
        />
        <Line
          type="monotone" 
          yAxisId="profit"
          dataKey="profit" 
          stroke="#10B981" 
          strokeWidth={2}
          dot={false}
          name="Profit"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

