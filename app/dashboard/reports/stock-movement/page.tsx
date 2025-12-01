"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
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
import { useState } from "react"
import { ExportReportModal } from "@/components/modals/export-report-modal"
import { PrintReportModal } from "@/components/modals/print-report-modal"
import { ReportSettingsModal } from "@/components/modals/report-settings-modal"

export default function StockMovementReportsPage() {
  const [showExport, setShowExport] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Mock stock movement data
  const stockMovements = [
    { product: "Product A", type: "Sale", quantity: -25, date: "2024-01-15", balance: 45 },
    { product: "Product A", type: "Purchase", quantity: 50, date: "2024-01-14", balance: 70 },
    { product: "Product B", type: "Sale", quantity: -12, date: "2024-01-15", balance: 8 },
    { product: "Product B", type: "Adjustment", quantity: -3, date: "2024-01-13", balance: 20 },
    { product: "Product C", type: "Transfer In", quantity: 30, date: "2024-01-12", balance: 30 },
    { product: "Product C", type: "Transfer Out", quantity: -15, date: "2024-01-11", balance: 0 },
  ]

  const movementSummary = [
    { type: "Sales", count: 125, quantity: -1250 },
    { type: "Purchases", count: 45, quantity: 5000 },
    { type: "Adjustments", count: 12, quantity: -50 },
    { type: "Transfers", count: 8, quantity: 200 },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Stock Movement Report</h1>
          <p className="text-muted-foreground">Track inventory movements and changes</p>
        </div>

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
              <div className="text-2xl font-bold">190</div>
              <p className="text-xs text-muted-foreground">This period</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock In</CardTitle>
              <ArrowUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">+5,200</div>
              <p className="text-xs text-muted-foreground">Units received</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock Out</CardTitle>
              <ArrowDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">-1,300</div>
              <p className="text-xs text-muted-foreground">Units sold</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Movement</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">+3,900</div>
              <p className="text-xs text-muted-foreground">Net increase</p>
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
                {movementSummary.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{item.type}</TableCell>
                    <TableCell>{item.count}</TableCell>
                    <TableCell className={`font-semibold ${
                      item.quantity > 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {item.quantity > 0 ? "+" : ""}{item.quantity}
                    </TableCell>
                  </TableRow>
                ))}
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
      </div>

      {/* Modals */}
      <ExportReportModal
        open={showExport}
        onOpenChange={setShowExport}
        reportType="Stock Movement Report"
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
    </DashboardLayout>
  )
}

