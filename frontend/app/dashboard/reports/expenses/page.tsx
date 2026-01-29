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
import { TrendingDown, DollarSign, Receipt, AlertCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { ExportReportModal } from "@/components/modals/export-report-modal"
import { PrintReportModal } from "@/components/modals/print-report-modal"
import { ReportSettingsModal } from "@/components/modals/report-settings-modal"
import { expenseService } from "@/lib/services/expenseService"
import { useBusinessStore } from "@/stores/businessStore"
import { useRealAPI } from "@/lib/utils/api-config"

export default function ExpensesReportsPage() {
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const [showExport, setShowExport] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [expenses, setExpenses] = useState<any[]>([])
  const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const useReal = useRealAPI()

  useEffect(() => {
    const loadExpenseData = async () => {
      if (!currentBusiness) return
      
      setIsLoading(true)
      try {
        if (useReal) {
          const response = await expenseService.list({
            tenant: currentBusiness.id,
            outlet: currentOutlet?.id,
          })
          
          const expenseList = response.results || []
          setExpenses(expenseList)
          
          // Calculate category breakdown
          const breakdown: Record<string, { category: string; total: number }> = {}
          expenseList.forEach((expense: any) => {
            const category = expense.category || "Other"
            if (!breakdown[category]) {
              breakdown[category] = { category, total: 0 }
            }
            breakdown[category].total += expense.amount || 0
          })
          
          const total = expenseList.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
          setCategoryBreakdown(
            Object.values(breakdown)
              .map(item => ({
                ...item,
                percentage: total > 0 ? (item.total / total) * 100 : 0,
              }))
              .sort((a, b) => b.total - a.total)
          )
        } else {
          setExpenses([])
          setCategoryBreakdown([])
        }
      } catch (error) {
        console.error("Failed to load expense report:", error)
        setExpenses([])
        setCategoryBreakdown([])
      } finally {
        setIsLoading(false)
      }
    }
    
    loadExpenseData()
  }, [currentBusiness, currentOutlet, useReal])

  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0)

  return (
    <DashboardLayout>
      <PageLayout
        title="Expense Reports"
        description="Track and analyze your business expenses"
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
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentBusiness?.currencySymbol || "MWK"} {totalExpenses.toLocaleString('en-US')}
              </div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "This period"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{expenses.length}</div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "Expense entries"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categoryBreakdown.length}</div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "Expense categories"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Expense</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentBusiness?.currencySymbol || "MWK"} {(expenses.length > 0 ? totalExpenses / expenses.length : 0).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "Per transaction"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Expense List */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Expenses</CardTitle>
            <CardDescription>Detailed expense transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <p className="text-muted-foreground">Loading expenses...</p>
                    </TableCell>
                  </TableRow>
                ) : expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <p className="text-muted-foreground">No expenses found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  expenses.map((expense, idx) => (
                    <TableRow key={expense.id || idx}>
                      <TableCell>{new Date(expense.date || expense.created_at || "").toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{expense.category}</TableCell>
                      <TableCell>{expense.vendor || "N/A"}</TableCell>
                      <TableCell className="font-semibold text-red-600">
                        {currentBusiness?.currencySymbol || "MWK"} {(expense.amount || 0).toLocaleString('en-US')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
            <CardDescription>Expenses by category</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Percentage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8">
                      <p className="text-muted-foreground">Loading category breakdown...</p>
                    </TableCell>
                  </TableRow>
                ) : categoryBreakdown.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8">
                      <p className="text-muted-foreground">No category data available</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  categoryBreakdown.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.category}</TableCell>
                      <TableCell className="font-semibold text-red-600">
                        {currentBusiness?.currencySymbol || "MWK"} {item.total.toLocaleString('en-US')}
                      </TableCell>
                      <TableCell>{item.percentage.toFixed(1)}%</TableCell>
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
        reportType="Expense Report"
      />
      <ReportSettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
      />
      </PageLayout>
    </DashboardLayout>
  )
}

