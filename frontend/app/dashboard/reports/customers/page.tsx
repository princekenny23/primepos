"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ReportFilters } from "@/components/reports/report-filters"
import { Users, DollarSign, Award, ShoppingCart } from "lucide-react"
import { useState, useEffect } from "react"
import { ExportReportModal } from "@/components/modals/export-report-modal"
import { PrintReportModal } from "@/components/modals/print-report-modal"
import { ReportSettingsModal } from "@/components/modals/report-settings-modal"
import { reportService } from "@/lib/services/reportService"
import { customerService } from "@/lib/services/customerService"
import { saleService } from "@/lib/services/saleService"
import { useBusinessStore } from "@/stores/businessStore"
import { useRealAPI } from "@/lib/utils/api-config"

export default function CustomersReportsPage() {
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const [showExport, setShowExport] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [topCustomers, setTopCustomers] = useState<any[]>([])
  const [customerSegments, setCustomerSegments] = useState<any[]>([])
  const [stats, setStats] = useState({ totalCustomers: 0, totalSpent: 0, totalPoints: 0, avgOrders: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const useReal = useRealAPI()

  useEffect(() => {
    const loadReportData = async () => {
      if (!currentBusiness) return
      
      setIsLoading(true)
      try {
        if (useReal) {
          const [customersData, salesData] = await Promise.all([
            customerService.list({ tenant: currentBusiness.id, is_active: true }),
            saleService.list({ tenant: currentBusiness.id, outlet: currentOutlet?.id, status: "completed", limit: 1000 }),
          ])
          
          const customers = Array.isArray(customersData) ? customersData : customersData.results || []
          const sales = Array.isArray(salesData) ? salesData : salesData.results || []
          
          // Calculate customer stats from sales
          const customerStats: Record<string, { name: string; orders: number; totalSpent: number; points: number; lastOrder: string }> = {}
          
          sales.forEach((sale: any) => {
            if (sale.customer_id || sale.customer?.id) {
              const customerId = sale.customer_id || sale.customer?.id
              const customer = customers.find((c: any) => c.id === customerId)
              if (customer) {
                if (!customerStats[customerId]) {
                  customerStats[customerId] = {
                    name: customer.name,
                    orders: 0,
                    totalSpent: 0,
                    points: customer.loyalty_points || customer.points || 0,
                    lastOrder: sale.created_at || sale.date,
                  }
                }
                customerStats[customerId].orders += 1
                customerStats[customerId].totalSpent += sale.total || 0
                if (new Date(sale.created_at || sale.date) > new Date(customerStats[customerId].lastOrder)) {
                  customerStats[customerId].lastOrder = sale.created_at || sale.date
                }
              }
            }
          })
          
          setTopCustomers(
            Object.values(customerStats)
              .sort((a, b) => b.totalSpent - a.totalSpent)
              .slice(0, 10)
          )
          
          // Calculate segments
          const vipCustomers = customers.filter((c: any) => (c.total_spent || c.totalSpent || 0) >= 5000)
          const regularCustomers = customers.filter((c: any) => {
            const spent = c.total_spent || c.totalSpent || 0
            return spent >= 1000 && spent < 5000
          })
          const newCustomers = customers.filter((c: any) => (c.total_spent || c.totalSpent || 0) < 1000)
          
          setCustomerSegments([
            {
              segment: "VIP Customers",
              count: vipCustomers.length,
              avgSpent: vipCustomers.length > 0 
                ? vipCustomers.reduce((sum: number, c: any) => sum + (c.total_spent || c.totalSpent || 0), 0) / vipCustomers.length
                : 0,
              totalSpent: vipCustomers.reduce((sum: number, c: any) => sum + (c.total_spent || c.totalSpent || 0), 0),
            },
            {
              segment: "Regular Customers",
              count: regularCustomers.length,
              avgSpent: regularCustomers.length > 0
                ? regularCustomers.reduce((sum: number, c: any) => sum + (c.total_spent || c.totalSpent || 0), 0) / regularCustomers.length
                : 0,
              totalSpent: regularCustomers.reduce((sum: number, c: any) => sum + (c.total_spent || c.totalSpent || 0), 0),
            },
            {
              segment: "New Customers",
              count: newCustomers.length,
              avgSpent: newCustomers.length > 0
                ? newCustomers.reduce((sum: number, c: any) => sum + (c.total_spent || c.totalSpent || 0), 0) / newCustomers.length
                : 0,
              totalSpent: newCustomers.reduce((sum: number, c: any) => sum + (c.total_spent || c.totalSpent || 0), 0),
            },
          ])
          
          const totalSpent = customers.reduce((sum: number, c: any) => sum + (c.total_spent || c.totalSpent || 0), 0)
          const totalPoints = customers.reduce((sum: number, c: any) => sum + (c.loyalty_points || c.points || 0), 0)
          const totalOrders = sales.length
          
          setStats({
            totalCustomers: customers.length,
            totalSpent,
            totalPoints,
            avgOrders: customers.length > 0 ? Math.round(totalOrders / customers.length) : 0,
          })
        } else {
          setTopCustomers([])
          setCustomerSegments([])
          setStats({ totalCustomers: 0, totalSpent: 0, totalPoints: 0, avgOrders: 0 })
        }
      } catch (error) {
        console.error("Failed to load customer report:", error)
        setTopCustomers([])
        setCustomerSegments([])
      } finally {
        setIsLoading(false)
      }
    }
    
    loadReportData()
  }, [currentBusiness, currentOutlet, useReal])

  return (
    <DashboardLayout>
      <PageLayout
        title="Customer Reports"
        description="Analyze customer behavior and loyalty"
      >

        <ReportFilters
          onExport={() => setShowExport(true)}
          onPrint={() => setShowPrint(true)}
          onSettings={() => setShowSettings(true)}
        />

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCustomers}</div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "Active customers"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentBusiness?.currencySymbol || "MWK"} {stats.totalSpent.toLocaleString('en-US')}
              </div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "Lifetime value"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Points</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPoints.toLocaleString('en-US')}</div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "Loyalty points"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgOrders}</div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "Per customer"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Customers</CardTitle>
            <CardDescription>Best customers by total spending</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Total Spent</TableHead>
                  <TableHead>Loyalty Points</TableHead>
                  <TableHead>Last Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <p className="text-muted-foreground">Loading top customers...</p>
                    </TableCell>
                  </TableRow>
                ) : topCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <p className="text-muted-foreground">No customer data available</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  topCustomers.map((customer, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.orders}</TableCell>
                      <TableCell className="font-semibold">
                        {currentBusiness?.currencySymbol || "MWK"} {customer.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{customer.points.toLocaleString('en-US')}</TableCell>
                      <TableCell>{new Date(customer.lastOrder).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Customer Segments */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Segments</CardTitle>
            <CardDescription>Customer breakdown by segment</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Segment</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Avg Spent</TableHead>
                  <TableHead>Total Spent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <p className="text-muted-foreground">Loading customer segments...</p>
                    </TableCell>
                  </TableRow>
                ) : customerSegments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <p className="text-muted-foreground">No segment data available</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  customerSegments.map((segment, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{segment.segment}</TableCell>
                      <TableCell>{segment.count}</TableCell>
                      <TableCell className="font-semibold">
                        {currentBusiness?.currencySymbol || "MWK"} {segment.avgSpent.toLocaleString('en-US')}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {currentBusiness?.currencySymbol || "MWK"} {segment.totalSpent.toLocaleString('en-US')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      {/* Modals */}
      <DataExchangeModal
        open={showExport}
        onOpenChange={setShowExport}
        type="export"
        config={dataExchangeConfigs.reports}
      />
      <PrintReportModal
        open={showPrint}
        onOpenChange={setShowPrint}
        reportType="Customer Report"
      />
      <ReportSettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
      />
      </PageLayout>
    </DashboardLayout>
  )
}

