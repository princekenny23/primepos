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
import { Store, TrendingUp, Users, DollarSign, ShoppingCart, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { useState, useEffect } from "react"
import { DataExchangeModal } from "@/components/modals/data-exchange-modal"
import { useBusinessStore } from "@/stores/businessStore"
import { Badge } from "@/components/ui/badge"

export default function MultiOutletReportsPage() {
  const { currentBusiness } = useBusinessStore()
  const [showExport, setShowExport] = useState(false)
  const [outletData, setOutletData] = useState<any[]>([])
  const [summary, setSummary] = useState<any>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadReportData = async () => {
      if (!currentBusiness) return
      
      setIsLoading(true)
      try {
        // Simulated data - replace with actual API call
        setTimeout(() => {
          setOutletData([
            { 
              id: 1, 
              name: "Downtown Branch", 
              location: "City Center", 
              sales: 45000, 
              transactions: 234, 
              customers: 156, 
              change: 12.5,
              status: "active"
            },
            { 
              id: 2, 
              name: "Mall Location", 
              location: "Shopping Mall", 
              sales: 38000, 
              transactions: 189, 
              customers: 134, 
              change: 8.3,
              status: "active"
            },
            { 
              id: 3, 
              name: "Airport Kiosk", 
              location: "International Airport", 
              sales: 28000, 
              transactions: 145, 
              customers: 98, 
              change: -2.1,
              status: "active"
            },
            { 
              id: 4, 
              name: "Suburban Store", 
              location: "Residential Area", 
              sales: 22000, 
              transactions: 112, 
              customers: 87, 
              change: 15.7,
              status: "active"
            },
            { 
              id: 5, 
              name: "Online Store", 
              location: "Virtual", 
              sales: 17000, 
              transactions: 89, 
              customers: 98, 
              change: 25.4,
              status: "active"
            },
          ])
          
          setSummary({
            totalOutlets: 5,
            totalSales: 150000,
            totalTransactions: 769,
            totalCustomers: 573,
            avgSalesPerOutlet: 30000,
            topPerformer: "Downtown Branch",
            growth: 11.2
          })
          
          setIsLoading(false)
        }, 1000)
      } catch (error) {
        console.error("Failed to load multi-outlet report:", error)
        setOutletData([])
        setSummary({})
        setIsLoading(false)
      }
    }
    
    loadReportData()
  }, [currentBusiness])

  const sortedOutlets = [...outletData].sort((a, b) => b.sales - a.sales)

  return (
    <DashboardLayout>
      <PageLayout
        title="Multi-Outlet Report"
        description="Compare performance across all outlets and locations"
      >

        <ReportFilters
          onExport={() => setShowExport(true)}
          onPrint={() => {}}
          onSettings={() => {}}
        />

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Outlets</CardTitle>
              <Store className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalOutlets || 0}</div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "Active locations"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentBusiness?.currencySymbol || "MWK"} {summary.totalSales?.toLocaleString('en-US') || "0"}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3 text-green-600 dark:text-green-400" />
                <span className="text-green-600 dark:text-green-400">
                  {summary.growth || 0}%
                </span> growth
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalTransactions || 0}</div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "Across all outlets"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Sales/Outlet</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentBusiness?.currencySymbol || "MWK"} {summary.avgSalesPerOutlet?.toLocaleString('en-US') || "0"}
              </div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "Average performance"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Top Performer */}
        {summary.topPerformer && (
          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                Top Performing Outlet
              </CardTitle>
              <CardDescription>Best performing location this period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{summary.topPerformer}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Leading in sales and customer engagement
                  </p>
                </div>
                <Badge variant="default" className="bg-green-600 dark:bg-green-500">
                  #1 Performer
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Outlet Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Outlet Performance Comparison</CardTitle>
            <CardDescription>Detailed breakdown by outlet location</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Outlet Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Sales</TableHead>
                  <TableHead>Transactions</TableHead>
                  <TableHead>Customers</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <p className="text-muted-foreground">Loading outlet data...</p>
                    </TableCell>
                  </TableRow>
                ) : sortedOutlets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <p className="text-muted-foreground">No outlet data available</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedOutlets.map((outlet, idx) => (
                    <TableRow key={outlet.id}>
                      <TableCell>
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                          idx === 0 ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" :
                          idx === 1 ? "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300" :
                          idx === 2 ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" :
                          "bg-muted text-muted-foreground"
                        } font-bold`}>
                          {idx + 1}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{outlet.name}</TableCell>
                      <TableCell className="text-muted-foreground">{outlet.location}</TableCell>
                      <TableCell className="font-semibold">
                        {currentBusiness?.currencySymbol || "MWK"} {outlet.sales.toLocaleString('en-US')}
                      </TableCell>
                      <TableCell>{outlet.transactions}</TableCell>
                      <TableCell>{outlet.customers}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {outlet.change >= 0 ? (
                            <>
                              <ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-400" />
                              <span className="text-green-600 dark:text-green-400">
                                {outlet.change}%
                              </span>
                            </>
                          ) : (
                            <>
                              <ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-400" />
                              <span className="text-red-600 dark:text-red-400">
                                {Math.abs(outlet.change)}%
                              </span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={outlet.status === "active" ? "default" : "secondary"}>
                          {outlet.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Performance Chart Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Sales Trend by Outlet</CardTitle>
            <CardDescription>Visual comparison of outlet performance over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center bg-muted rounded-lg">
              <p className="text-muted-foreground">Chart visualization will be implemented with backend integration</p>
            </div>
          </CardContent>
        </Card>
      {/* Modals */}
      <DataExchangeModal
        open={showExport}
        onOpenChange={setShowExport}
        type="export"
        config={{
          entityType: "reports",
          fields: [],
          requiredFields: [],
          defaultFormat: "xlsx",
          apiEndpoints: { import: "/api/reports/import", export: "/api/reports/export" }
        }}
        data={outletData}
      />
      </PageLayout>
    </DashboardLayout>
  )
}

