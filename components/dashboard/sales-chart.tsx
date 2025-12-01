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

interface SalesChartProps {
  data: Array<{
    date: string
    sales: number
    profit: number
  }>
  type?: "line" | "area"
}

export function SalesChart({ data, type = "area" }: SalesChartProps) {
  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="sales" 
            stroke="#3B82F6" 
            strokeWidth={2}
            name="Sales"
          />
          <Line 
            type="monotone" 
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
          <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Area 
          type="monotone" 
          dataKey="sales" 
          stroke="#3B82F6" 
          fillOpacity={1}
          fill="url(#colorSales)"
          name="Sales"
        />
        <Area 
          type="monotone" 
          dataKey="profit" 
          stroke="#10B981" 
          fillOpacity={1}
          fill="url(#colorProfit)"
          name="Profit"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

