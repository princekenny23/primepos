"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, FileSpreadsheet, Printer, Search, PieChart } from "lucide-react"
import { DataExchangeModal } from "@/components/modals/data-exchange-modal"
import { PrintReportModal } from "@/components/modals/print-report-modal"
import { ReportSettingsModal } from "@/components/modals/report-settings-modal"
import { dataExchangeConfigs } from "@/lib/utils/data-exchange-config"
import { useI18n } from "@/contexts/i18n-context"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"
import { expenseService } from "@/lib/services/expenseService"
import { useToast } from "@/components/ui/use-toast"
import { format } from "date-fns"

export default function ExpensesReportsPage() {
  const { t } = useI18n()
  const { currentBusiness } = useBusinessStore()
  const { currentOutlet } = useTenant()
  const { toast } = useToast()
  
  const [showExport, setShowExport] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  
  const [startDate, setStartDate] = useState(() => {
    const now = new Date()
    return format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd')
  })
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  
  const [expenses, setExpenses] = useState<any[]>([])
  const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>([])

  const loadReportData = async () => {
    if (!currentBusiness || !currentOutlet) return
    
    setIsLoading(true)
    try {
      const response = await expenseService.list({
        outlet: currentOutlet.id,
        status: 'approved',
      })
      const expenseList = Array.isArray(response) ? response : (response.results || [])
      
      setExpenses(expenseList)
      
      // Calculate category breakdown
      const totalExpenses = expenseList.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
      const categoryTotals: Record<string, { total: number; count: number }> = {}
      expenseList.forEach((e: any) => {
        const category = e.category?.name || e.category || "Uncategorized"
        if (!categoryTotals[category]) {
          categoryTotals[category] = { total: 0, count: 0 }
        }
        categoryTotals[category].total += e.amount || 0
        categoryTotals[category].count += 1
      })
      
      const breakdown = Object.entries(categoryTotals).map(([category, data]) => ({
        category,
        total: data.total,
        count: data.count,
        percentage: totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0,
      })).sort((a, b) => b.total - a.total)
      
      setCategoryBreakdown(breakdown)
    } catch (error) {
      console.error("Failed to load expense report:", error)
      toast({
        title: t("common.messages.error"),
        description: "Failed to load expense data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadReportData()
  }, [currentBusiness, currentOutlet])

  const handleApplyFilters = () => {
    loadReportData()
  }

  const filteredExpenses = expenses.filter(expense => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      expense.description?.toLowerCase().includes(search) ||
      expense.vendor?.toLowerCase().includes(search) ||
      expense.expense_number?.toLowerCase().includes(search)
    )
  })

  const formatCurrency = (value: number) => {
    return `${currentBusiness?.currencySymbol || "MK"} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <DashboardLayout>
      <PageLayout
        title={t("reports.menu.expenses")}
        description={t("reports.expense_report.description")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowExport(true)}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {t("reports.actions.export_excel")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowPrint(true)}>
              <Printer className="mr-2 h-4 w-4" />
              {t("reports.actions.print")}
            </Button>
          </div>
        }
      >
        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">{t("common.filters")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>{t("common.time.from")}</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("common.time.to")}</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("common.search")}</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("reports.expenses.search_placeholder")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <Button onClick={handleApplyFilters} disabled={isLoading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  {t("common.actions.apply")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              {t("reports.expense_report.by_category")}
            </CardTitle>
            <CardDescription>Expenses breakdown by category</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : categoryBreakdown.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                {t("reports.messages.no_data")}
          </div>
            ) : (
            <Table>
              <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.category")}</TableHead>
                    <TableHead className="text-right">{t("expenses.count")}</TableHead>
                    <TableHead className="text-right">{t("expenses.amount")}</TableHead>
                    <TableHead className="text-right">{t("expenses.percentage")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                  {categoryBreakdown.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.category}</TableCell>
                      <TableCell className="text-right">{item.count}</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {formatCurrency(item.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{item.percentage.toFixed(1)}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            )}
          </CardContent>
        </Card>

        {/* Expense List */}
        <Card>
          <CardHeader>
            <CardTitle>{t("expenses.recent_expenses")}</CardTitle>
            <CardDescription>Detailed expense transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                {t("reports.messages.no_data")}
        </div>
            ) : (
            <Table>
              <TableHeader>
                  <TableRow>
                    <TableHead>{t("expenses.date")}</TableHead>
                    <TableHead>{t("expenses.expense_number")}</TableHead>
                    <TableHead>{t("expenses.category")}</TableHead>
                    <TableHead>{t("expenses.vendor")}</TableHead>
                    <TableHead>{t("expenses.description")}</TableHead>
                    <TableHead className="text-right">{t("expenses.amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                  {filteredExpenses.slice(0, 50).map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        {expense.expense_date ? format(new Date(expense.expense_date), 'MMM dd, yyyy') : "-"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {expense.expense_number || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {expense.category?.name || expense.category || "Uncategorized"}
                        </Badge>
                      </TableCell>
                      <TableCell>{expense.vendor || "-"}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {expense.description || "-"}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {formatCurrency(expense.amount || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            )}
          </CardContent>
        </Card>
      </PageLayout>

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
        reportType={t("reports.menu.expenses")}
      />
      <ReportSettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </DashboardLayout>
  )
}
