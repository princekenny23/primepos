"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, FileSpreadsheet, Printer } from "lucide-react"
import { DataExchangeModal } from "@/components/modals/data-exchange-modal"
import { PrintReportModal } from "@/components/modals/print-report-modal"
import { ReportSettingsModal } from "@/components/modals/report-settings-modal"
import { dataExchangeConfigs } from "@/lib/utils/data-exchange-config"
import { useI18n } from "@/contexts/i18n-context"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"
import { inventoryService } from "@/lib/services/inventoryService"
import { useToast } from "@/components/ui/use-toast"
import { format } from "date-fns"

export default function StockMovementReportsPage() {
  const { t } = useI18n()
  const { currentBusiness } = useBusinessStore()
  const { currentOutlet } = useTenant()
  const { toast } = useToast()
  
  const [showExport, setShowExport] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  const [startDate, setStartDate] = useState(() => {
    const now = new Date()
    return format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd')
  })
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [movementType, setMovementType] = useState<string>("all")
  
  const [movements, setMovements] = useState<any[]>([])

  const loadReportData = async () => {
    if (!currentBusiness || !currentOutlet) return
    
    setIsLoading(true)
    try {
      const response = await inventoryService.getMovements({
        outlet: String(currentOutlet.id),
        movement_type: movementType !== "all" ? movementType : undefined,
      })
      const movementList = Array.isArray(response) ? response : (response.results || [])
      
      setMovements(movementList)
    } catch (error) {
      console.error("Failed to load stock movement report:", error)
      toast({
        title: t("common.messages.error"),
        description: "Failed to load stock movement data",
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

  const getMovementTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      sale: t("inventory.movement_types.sale"),
      purchase: t("inventory.movement_types.purchase"),
      adjustment: t("inventory.movement_types.adjustment"),
      transfer_in: t("inventory.movement_types.transfer_in"),
      transfer_out: t("inventory.movement_types.transfer_out"),
      return: t("inventory.movement_types.return"),
      damage: t("inventory.movement_types.damage"),
      expiry: t("inventory.movement_types.expiry"),
    }
    return labels[type] || type
  }

  const getMovementColor = (type: string) => {
    const inTypes = ['purchase', 'transfer_in', 'return']
    if (inTypes.includes(type)) {
      return "text-green-600"
    }
    return "text-red-600"
  }

  return (
    <DashboardLayout>
      <PageLayout
        title={t("reports.menu.stock_movement")}
        description={t("reports.stock_movement.title")}
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <Label>{t("reports.stock_movement.type")}</Label>
                <Select value={movementType} onValueChange={setMovementType}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("common.all")}</SelectItem>
                    <SelectItem value="sale">{t("inventory.movement_types.sale")}</SelectItem>
                    <SelectItem value="purchase">{t("inventory.movement_types.purchase")}</SelectItem>
                    <SelectItem value="adjustment">{t("inventory.movement_types.adjustment")}</SelectItem>
                    <SelectItem value="transfer_in">{t("inventory.movement_types.transfer_in")}</SelectItem>
                    <SelectItem value="transfer_out">{t("inventory.movement_types.transfer_out")}</SelectItem>
                    <SelectItem value="return">{t("inventory.movement_types.return")}</SelectItem>
                    <SelectItem value="damage">{t("inventory.movement_types.damage")}</SelectItem>
                  </SelectContent>
                </Select>
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

        {/* Stock Movements */}
        <Card>
          <CardHeader>
            <CardTitle>{t("inventory.recent_movements")}</CardTitle>
            <CardDescription>Latest inventory transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : movements.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                {t("reports.messages.no_data")}
          </div>
            ) : (
            <Table>
              <TableHeader>
                  <TableRow>
                    <TableHead>{t("reports.stock_movement.date")}</TableHead>
                    <TableHead>{t("reports.stock_movement.product")}</TableHead>
                    <TableHead>{t("reports.stock_movement.type")}</TableHead>
                    <TableHead className="text-right">{t("reports.stock_movement.quantity")}</TableHead>
                    <TableHead>{t("common.reason")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                  {movements.slice(0, 50).map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>
                        {movement.created_at ? format(new Date(movement.created_at), 'MMM dd, yyyy HH:mm') : "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {movement.product?.name || movement.variation?.product?.name || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getMovementTypeLabel(movement.movement_type)}</Badge>
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${getMovementColor(movement.movement_type)}`}>
                        {['purchase', 'transfer_in', 'return'].includes(movement.movement_type) ? "+" : "-"}
                        {movement.quantity}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {movement.reason || "-"}
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
        data={movements}
      />
      <PrintReportModal
        open={showPrint}
        onOpenChange={setShowPrint}
        reportType={t("reports.menu.stock_movement")}
      />
      <ReportSettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </DashboardLayout>
  )
}
