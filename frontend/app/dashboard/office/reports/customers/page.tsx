"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, FileSpreadsheet, Printer, Search } from "lucide-react"
import { DataExchangeModal } from "@/components/modals/data-exchange-modal"
import { PrintReportModal } from "@/components/modals/print-report-modal"
import { ReportSettingsModal } from "@/components/modals/report-settings-modal"
import { dataExchangeConfigs } from "@/lib/utils/data-exchange-config"
import { useI18n } from "@/contexts/i18n-context"
import { useBusinessStore } from "@/stores/businessStore"
import { customerService } from "@/lib/services/customerService"
import { useToast } from "@/components/ui/use-toast"

export default function CustomersReportsPage() {
  const { t } = useI18n()
  const { currentBusiness } = useBusinessStore()
  const { toast } = useToast()
  
  const [showExport, setShowExport] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  
  const [customers, setCustomers] = useState<any[]>([])

  const loadReportData = async () => {
    if (!currentBusiness) return
    
    setIsLoading(true)
    try {
      const response = await customerService.list({ is_active: true })
      const customerList = Array.isArray(response) ? response : (response.results || [])
      
      // Sort by total spent
      const sortedCustomers = customerList.sort((a: any, b: any) => 
        (b.total_spent || 0) - (a.total_spent || 0)
      )
      
      setCustomers(sortedCustomers)
    } catch (error) {
      console.error("Failed to load customer report:", error)
      toast({
        title: t("common.messages.error"),
        description: "Failed to load customer report data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadReportData()
  }, [currentBusiness])

  const filteredCustomers = customers.filter(customer => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      customer.name?.toLowerCase().includes(search) ||
      customer.email?.toLowerCase().includes(search) ||
      customer.phone?.toLowerCase().includes(search)
    )
  })

  const formatCurrency = (value: number) => {
    return `${currentBusiness?.currencySymbol || "MK"} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const getCustomerTier = (totalSpent: number) => {
    if (totalSpent >= 100000) return { label: "VIP", color: "bg-purple-100 text-purple-800" }
    if (totalSpent >= 50000) return { label: "Gold", color: "bg-yellow-100 text-yellow-800" }
    if (totalSpent >= 10000) return { label: "Silver", color: "bg-gray-100 text-gray-800" }
    return { label: "Regular", color: "bg-blue-100 text-blue-800" }
  }

  return (
    <DashboardLayout>
      <PageLayout
        title={t("reports.menu.customers")}
        description={t("reports.customer_report.title")}
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
        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("customers.search_placeholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
              <Button variant="outline" onClick={loadReportData} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                {t("common.actions.refresh")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle>{t("reports.customer_report.top_customers")}</CardTitle>
            <CardDescription>Best customers by total spending</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                {t("reports.messages.no_data")}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("customers.name")}</TableHead>
                    <TableHead>{t("customers.phone")}</TableHead>
                    <TableHead>{t("customers.email")}</TableHead>
                    <TableHead className="text-right">{t("reports.customer_report.total_spent")}</TableHead>
                    <TableHead className="text-right">{t("customers.loyalty_points")}</TableHead>
                    <TableHead>{t("common.status.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.slice(0, 20).map((customer) => {
                    const tier = getCustomerTier(customer.total_spent || 0)
                    return (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>{customer.phone || "-"}</TableCell>
                        <TableCell>{customer.email || "-"}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(customer.total_spent || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {(customer.loyalty_points || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge className={tier.color}>{tier.label}</Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
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
        data={customers}
      />
      <PrintReportModal
        open={showPrint}
        onOpenChange={setShowPrint}
        reportType={t("reports.menu.customers")}
      />
      <ReportSettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </DashboardLayout>
  )
}
