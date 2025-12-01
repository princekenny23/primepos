"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Store, Settings2, Plus } from "lucide-react"
import { useTenant } from "@/contexts/tenant-context"
import { KPICards } from "@/components/dashboard/kpi-cards"
import { SalesChart } from "@/components/dashboard/sales-chart"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { LowStockAlerts } from "@/components/dashboard/low-stock-alerts"
import { TopSellingItems } from "@/components/dashboard/top-selling-items"
import { DateRangeFilter } from "@/components/dashboard/date-range-filter"
import { ViewSaleDetailsModal } from "@/components/modals/view-sale-details-modal"
import { QuickAddSaleModal } from "@/components/modals/quick-add-sale-modal"
import { CustomizeDashboardModal } from "@/components/modals/customize-dashboard-modal"
import { useState } from "react"

// Mock data - will be replaced with API calls
const mockKPIData = {
  sales: { value: 45231.89, change: 20.1 },
  customers: { value: 573, change: 18.2 },
  products: { value: 1234, change: 0 },
  expenses: { value: 12345.67, change: -5.3 },
  profit: { value: 32886.22, change: 25.4 },
}

const mockChartData = [
  { date: "Mon", sales: 4000, profit: 2400 },
  { date: "Tue", sales: 3000, profit: 1398 },
  { date: "Wed", sales: 2000, profit: 9800 },
  { date: "Thu", sales: 2780, profit: 3908 },
  { date: "Fri", sales: 1890, profit: 4800 },
  { date: "Sat", sales: 2390, profit: 3800 },
  { date: "Sun", sales: 3490, profit: 4300 },
]

const mockActivities = [
  {
    id: "1",
    type: "sale" as const,
    title: "New Sale Completed",
    description: "Sale #1001 - $125.50",
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    amount: 125.50,
  },
  {
    id: "2",
    type: "inventory" as const,
    title: "Low Stock Alert",
    description: "Product A is running low",
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
  },
  {
    id: "3",
    type: "customer" as const,
    title: "New Customer Added",
    description: "John Doe registered",
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
  },
  {
    id: "4",
    type: "payment" as const,
    title: "Payment Received",
    description: "Invoice #INV-001 paid",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    amount: 500.00,
  },
]

const mockLowStockItems = [
  {
    id: "1",
    name: "Product A",
    sku: "SKU-001",
    currentStock: 5,
    minStock: 10,
    category: "Electronics",
  },
  {
    id: "2",
    name: "Product B",
    sku: "SKU-002",
    currentStock: 3,
    minStock: 15,
    category: "Clothing",
  },
]

const mockTopSellingItems = [
  { id: "1", name: "Product A", sku: "SKU-001", quantity: 150, revenue: 4500, change: 15 },
  { id: "2", name: "Product B", sku: "SKU-002", quantity: 120, revenue: 6000, change: 8 },
  { id: "3", name: "Product C", sku: "SKU-003", quantity: 95, revenue: 1900, change: -5 },
  { id: "4", name: "Product D", sku: "SKU-004", quantity: 80, revenue: 3200, change: 12 },
  { id: "5", name: "Product E", sku: "SKU-005", quantity: 65, revenue: 3250, change: 20 },
]

export default function DashboardPage() {
  const { currentTenant, currentOutlet, isLoading } = useTenant()
  const [showQuickSale, setShowQuickSale] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)
  const [selectedSale, setSelectedSale] = useState<any>(null)
  const [showSaleDetails, setShowSaleDetails] = useState(false)

  const handleViewSale = (saleId: string) => {
    // Mock sale data - in production, fetch from API
    setSelectedSale({
      id: saleId,
      date: new Date().toISOString(),
      customer: "John Doe",
      items: [
        { id: "1", name: "Product A", quantity: 2, price: 29.99, total: 59.98 },
        { id: "2", name: "Product B", quantity: 1, price: 49.99, total: 49.99 },
      ],
      subtotal: 109.97,
      tax: 10.99,
      discount: 0,
      total: 120.96,
      paymentMethod: "Card",
      status: "completed",
    })
    setShowSaleDetails(true)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">Dashboard</h1>
              {!isLoading && currentOutlet && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
                  <Store className="h-4 w-4" />
                  <span>{currentOutlet.name}</span>
                </div>
              )}
            </div>
            {!isLoading && currentTenant && (
              <p className="text-muted-foreground">
                Welcome back! Here's what's happening at <span className="font-medium">{currentTenant.name}</span> today.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <DateRangeFilter />
            <Button variant="outline" onClick={() => setShowCustomize(true)}>
              <Settings2 className="mr-2 h-4 w-4" />
              Customize
            </Button>
            <Button onClick={() => setShowQuickSale(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Quick Sale
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <KPICards data={mockKPIData} />

        {/* Charts and Activity */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Sales Overview</CardTitle>
              <CardDescription>Sales and profit trends over the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <SalesChart data={mockChartData} type="area" />
            </CardContent>
          </Card>

          <RecentActivity activities={mockActivities} />
        </div>

        {/* Low Stock and Top Selling */}
        <div className="grid gap-4 md:grid-cols-2">
          <LowStockAlerts items={mockLowStockItems} />
          <TopSellingItems items={mockTopSellingItems} />
        </div>

        {/* Recent Sales with Click to View */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
            <CardDescription>Click on any sale to view details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0 cursor-pointer hover:bg-accent/50 p-2 rounded transition-colors"
                  onClick={() => handleViewSale(`1000${item}`)}
                >
                  <div>
                    <p className="font-medium">Sale #{1000 + item}</p>
                    <p className="text-sm text-muted-foreground">2 hours ago</p>
                  </div>
                  <p className="font-semibold">${(Math.random() * 500 + 50).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <QuickAddSaleModal open={showQuickSale} onOpenChange={setShowQuickSale} />
      <CustomizeDashboardModal open={showCustomize} onOpenChange={setShowCustomize} />
      <ViewSaleDetailsModal
        open={showSaleDetails}
        onOpenChange={setShowSaleDetails}
        sale={selectedSale}
      />
    </DashboardLayout>
  )
}
