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
import { Receipt, DollarSign, FileText, TrendingUp, CheckCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { ExportReportModal } from "@/components/modals/export-report-modal"
import { PrintReportModal } from "@/components/modals/print-report-modal"
import { ReportSettingsModal } from "@/components/modals/report-settings-modal"
import { useBusinessStore } from "@/stores/businessStore"
import { Badge } from "@/components/ui/badge"

export default function TaxReportsPage() {
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const [showExport, setShowExport] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [taxData, setTaxData] = useState<any[]>([])
  const [taxSummary, setTaxSummary] = useState<any>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadReportData = async () => {
      if (!currentBusiness) return
      
      setIsLoading(true)
      try {
        // Simulated data - replace with actual API call
        setTimeout(() => {
          setTaxData([
            { id: 1, date: "2024-01-15", transactionId: "TXN-001", taxableAmount: 10000, taxRate: 16.5, taxAmount: 1650, type: "VAT" },
            { id: 2, date: "2024-01-16", transactionId: "TXN-002", taxableAmount: 5000, taxRate: 16.5, taxAmount: 825, type: "VAT" },
            { id: 3, date: "2024-01-17", transactionId: "TXN-003", taxableAmount: 15000, taxRate: 16.5, taxAmount: 2475, type: "VAT" },
            { id: 4, date: "2024-01-18", transactionId: "TXN-004", taxableAmount: 8000, taxRate: 0, taxAmount: 0, type: "Exempt" },
            { id: 5, date: "2024-01-19", transactionId: "TXN-005", taxableAmount: 12000, taxRate: 16.5, taxAmount: 1980, type: "VAT" },
          ])
          
          setTaxSummary({
            totalTaxable: 50000,
            totalTax: 6930,
            vatCollected: 6930,
            exemptAmount: 8000,
            transactions: 5,
          })
          
          setIsLoading(false)
        }, 1000)
      } catch (error) {
        console.error("Failed to load tax report:", error)
        setTaxData([])
        setTaxSummary({})
        setIsLoading(false)
      }
    }
    
    loadReportData()
  }, [currentBusiness, currentOutlet])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Tax Report</h1>
          <p className="text-muted-foreground">Tax calculations, compliance, and tax summaries</p>
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
              <CardTitle className="text-sm font-medium">Total Tax Collected</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentBusiness?.currencySymbol || "MWK"} {taxSummary.totalTax?.toLocaleString('en-US') || "0"}
              </div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "This period"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">VAT Collected</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentBusiness?.currencySymbol || "MWK"} {taxSummary.vatCollected?.toLocaleString('en-US') || "0"}
              </div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "16.5% VAT"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxable Amount</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentBusiness?.currencySymbol || "MWK"} {taxSummary.totalTaxable?.toLocaleString('en-US') || "0"}
              </div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "Total taxable"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{taxSummary.transactions || 0}</div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "Taxable transactions"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tax Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Tax Summary</CardTitle>
            <CardDescription>Overview of tax collections and compliance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Total Taxable Sales</p>
                <p className="text-2xl font-bold">
                  {currentBusiness?.currencySymbol || "MWK"} {taxSummary.totalTaxable?.toLocaleString('en-US') || "0"}
                </p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Exempt Amount</p>
                <p className="text-2xl font-bold">
                  {currentBusiness?.currencySymbol || "MWK"} {taxSummary.exemptAmount?.toLocaleString('en-US') || "0"}
                </p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Total Tax Due</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {currentBusiness?.currencySymbol || "MWK"} {taxSummary.totalTax?.toLocaleString('en-US') || "0"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tax Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Tax Transactions</CardTitle>
            <CardDescription>Detailed breakdown of tax calculations by transaction</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Taxable Amount</TableHead>
                  <TableHead>Tax Rate</TableHead>
                  <TableHead>Tax Amount</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <p className="text-muted-foreground">Loading tax data...</p>
                    </TableCell>
                  </TableRow>
                ) : taxData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <p className="text-muted-foreground">No tax data available</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  taxData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{new Date(item.date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-mono text-sm">{item.transactionId}</TableCell>
                      <TableCell>
                        {currentBusiness?.currencySymbol || "MWK"} {item.taxableAmount.toLocaleString('en-US')}
                      </TableCell>
                      <TableCell>{item.taxRate}%</TableCell>
                      <TableCell className="font-semibold">
                        {currentBusiness?.currencySymbol || "MWK"} {item.taxAmount.toLocaleString('en-US')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.type === "Exempt" ? "secondary" : "default"}>
                          {item.type}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <ExportReportModal
        open={showExport}
        onOpenChange={setShowExport}
        reportType="Tax Report"
      />
      <PrintReportModal
        open={showPrint}
        onOpenChange={setShowPrint}
        reportType="Tax Report"
      />
      <ReportSettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </DashboardLayout>
  )
}

