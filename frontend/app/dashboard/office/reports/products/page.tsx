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
import { useTenant } from "@/contexts/tenant-context"
import { productService } from "@/lib/services/productService"
import { useToast } from "@/components/ui/use-toast"

export default function ProductsReportsPage() {
  const { t } = useI18n()
  const { currentBusiness } = useBusinessStore()
  const { currentOutlet } = useTenant()
  const { toast } = useToast()
  
  const [showExport, setShowExport] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  
  const [products, setProducts] = useState<any[]>([])

  const loadReportData = async () => {
    if (!currentBusiness || !currentOutlet) return
    
    setIsLoading(true)
    try {
      const response = await productService.list({ is_active: true })
      const productList = Array.isArray(response) ? response : (response.results || [])
      
      setProducts(productList)
    } catch (error) {
      console.error("Failed to load product report:", error)
      toast({
        title: t("common.messages.error"),
        description: "Failed to load product report data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadReportData()
  }, [currentBusiness, currentOutlet])

  const filteredProducts = products.filter(product => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      product.name?.toLowerCase().includes(search) ||
      product.sku?.toLowerCase().includes(search) ||
      product.category?.name?.toLowerCase().includes(search)
    )
  })

  const formatCurrency = (value: number) => {
    return `${currentBusiness?.currencySymbol || "MK"} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const getStockStatus = (product: any) => {
    const stock = product.stock || 0
    const threshold = product.low_stock_threshold || 10
    
    if (stock === 0) {
      return { label: t("inventory.stock_status.out_of_stock"), variant: "destructive" as const }
    } else if (stock <= threshold) {
      return { label: t("inventory.stock_status.low_stock"), variant: "secondary" as const }
    }
    return { label: t("inventory.stock_status.in_stock"), variant: "default" as const }
  }

  return (
    <DashboardLayout>
      <PageLayout
        title={t("reports.menu.products")}
        description="Analyze product performance and inventory"
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
                placeholder={t("products.search_placeholder")}
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

        {/* Product Performance */}
        <Card>
          <CardHeader>
            <CardTitle>{t("products.all_products")}</CardTitle>
            <CardDescription>Product inventory and performance</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                {t("reports.messages.no_data")}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("products.product")}</TableHead>
                    <TableHead>{t("products.sku")}</TableHead>
                    <TableHead>{t("products.category")}</TableHead>
                    <TableHead className="text-right">{t("products.price")}</TableHead>
                    <TableHead className="text-right">{t("products.stock")}</TableHead>
                    <TableHead className="text-right">{t("inventory.total_stock_value")}</TableHead>
                    <TableHead>{t("common.status.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.slice(0, 50).map((product) => {
                    const status = getStockStatus(product)
                    const price = product.retail_price || product.price || 0
                    const stock = product.stock || 0
                    return (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="font-mono text-sm">{product.sku || "-"}</TableCell>
                        <TableCell>{product.category?.name || t("common.uncategorized")}</TableCell>
                        <TableCell className="text-right">{formatCurrency(price)}</TableCell>
                        <TableCell className="text-right">{stock}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(stock * price)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
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
        data={products}
      />
      <PrintReportModal
        open={showPrint}
        onOpenChange={setShowPrint}
        reportType={t("reports.menu.products")}
      />
      <ReportSettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </DashboardLayout>
  )
}
