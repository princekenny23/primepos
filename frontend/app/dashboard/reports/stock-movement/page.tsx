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
import { Package, ArrowUp, ArrowDown, RefreshCw } from "lucide-react"
import { useState, useEffect } from "react"
import { inventoryService } from "@/lib/services/inventoryService"
import { DataExchangeModal } from "@/components/modals/data-exchange-modal"
import { PrintReportModal } from "@/components/modals/print-report-modal"
import { ReportSettingsModal } from "@/components/modals/report-settings-modal"
import { dataExchangeConfigs } from "@/lib/utils/data-exchange-config"

export default function StockMovementReportsPage() {
  const [showExport, setShowExport] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const [stockMovements, setStockMovements] = useState<any[]>([])
  const [movementSummary, setMovementSummary] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setIsLoading(true)
      try {
        const resp = await inventoryService.getMovements({ limit: 100 })
        const list = Array.isArray(resp) ? resp : resp.results || []
        if (!mounted) return
        setStockMovements(list)

        // derive summary by movement_type
        const summaryMap: Record<string, { type: string; count: number; quantity: number }> = {}
        for (const m of list) {
          const type = String(m.movement_type || m.type || "unknown")
          const qty = Number(m.quantity || m.qty || 0)
          if (!summaryMap[type]) summaryMap[type] = { type, count: 0, quantity: 0 }
          summaryMap[type].count += 1
          summaryMap[type].quantity += qty
        }
        const summary = Object.values(summaryMap)
        setMovementSummary(summary)
      } catch (error) {
        console.error("Failed to load stock movements:", error)
        setStockMovements([])
        setMovementSummary([])
      } finally {
        setIsLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  return (
    <DashboardLayout>
      <PageLayout
        title="Stock Movement Report"
        description="Track inventory movements and changes"
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
              <CardTitle className="text-sm font-medium">Total Movements</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "—" : stockMovements.length}</div>
              <p className="text-xs text-muted-foreground">This period</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock In</CardTitle>
              <ArrowUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{isLoading ? "—" : movementSummary.filter(s => s.quantity > 0).reduce((sum, s) => sum + s.quantity, 0)}</div>
              <p className="text-xs text-muted-foreground">Units received</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock Out</CardTitle>
              <ArrowDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{isLoading ? "—" : movementSummary.filter(s => s.quantity < 0).reduce((sum, s) => sum + s.quantity, 0)}</div>
              <p className="text-xs text-muted-foreground">Units sold</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Movement</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{isLoading ? "—" : movementSummary.reduce((sum, s) => sum + s.quantity, 0)}</div>
              <p className="text-xs text-muted-foreground">Net change</p>
            </CardContent>
          </Card>
        </div>

        {/* Movement Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Movement Summary</CardTitle>
            <CardDescription>Stock movements by type</CardDescription>
          </CardHeader>
          <CardContent>
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Transactions</TableHead>
                  <TableHead>Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : movementSummary.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8">No movement data</TableCell>
                  </TableRow>
                ) : (
                  movementSummary.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.type}</TableCell>
                      <TableCell>{item.count}</TableCell>
                      <TableCell className={`font-semibold ${item.quantity > 0 ? "text-green-600" : "text-red-600"}`}>
                        {item.quantity > 0 ? "+" : ""}{item.quantity}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Movements */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Stock Movements</CardTitle>
            <CardDescription>Latest inventory transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockMovements.map((movement, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{new Date(movement.date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{movement.product}</TableCell>
                    <TableCell>{movement.type}</TableCell>
                    <TableCell className={`font-semibold ${
                      movement.quantity > 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {movement.quantity > 0 ? "+" : ""}{movement.quantity}
                    </TableCell>
                    <TableCell>{movement.balance}</TableCell>
                  </TableRow>
                ))}
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
        reportType="Stock Movement Report"
      />
      <ReportSettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
      />
      </PageLayout>
    </DashboardLayout>
  )
}

