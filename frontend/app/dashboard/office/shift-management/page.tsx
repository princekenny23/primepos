"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { FilterableTabs, TabsContent, type TabConfig } from "@/components/ui/filterable-tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DatePicker } from "@/components/ui/date-picker"
import {
  History,
  Clock,
  PlayCircle,
  Search,
  Download,
  Eye,
  TrendingUp,
  TrendingDown,
  Minus,
  X,
  Menu,
  Share2,
} from "lucide-react"
import { format } from "date-fns"
import { useShift, Shift } from "@/contexts/shift-context"
import { useBusinessStore } from "@/stores/businessStore"
import { shiftService } from "@/lib/services/shiftService"
import { tillService } from "@/lib/services/tillService"
import { CloseShiftModal } from "@/components/modals/close-shift-modal"
import { useI18n } from "@/contexts/i18n-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const LOCAL_PRINT_AGENT_URL =
  process.env.NEXT_PUBLIC_LOCAL_PRINT_AGENT_URL || "http://127.0.0.1:7310"
const LOCAL_PRINT_AGENT_TOKEN =
  process.env.NEXT_PUBLIC_LOCAL_PRINT_AGENT_TOKEN || ""

function encodeTextToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ""
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

function htmlToText(html: string): string {
  if (typeof window === "undefined") return html
  const doc = new DOMParser().parseFromString(html, "text/html")
  return doc.body?.innerText || html
}

async function printTextViaAgent(text: string, printer?: string): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (LOCAL_PRINT_AGENT_TOKEN) {
    headers["X-Primepos-Token"] = LOCAL_PRINT_AGENT_TOKEN
  }
  const contentBase64 = encodeTextToBase64(text)
  const response = await fetch(`${LOCAL_PRINT_AGENT_URL}/print`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      printerName: printer || "",
      contentBase64,
      jobName: "PrimePOS Shift Report",
    }),
  })
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(body || response.statusText)
  }
}

export default function ShiftManagementPage() {
  const router = useRouter()
  const { currentBusiness, currentOutlet, outlets } = useBusinessStore()
  const { shiftHistory } = useShift()
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<string>("history")
  const [selectedOutlet, setSelectedOutlet] = useState<string>("all")
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  })
  const [shifts, setShifts] = useState<Shift[]>([])
  const [activeShifts, setActiveShifts] = useState<Shift[]>([])
  const [tills, setTills] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingActive, setIsLoadingActive] = useState(true)
  const [shiftToClose, setShiftToClose] = useState<Shift | null>(null)
  const [shiftToView, setShiftToView] = useState<Shift | null>(null)
  const [isPrinting, setIsPrinting] = useState(false)

  const buildHistoryFilters = () => {
    const filters: any = {}
    if (dateRange.from) {
      filters.operating_date_from = format(dateRange.from, "yyyy-MM-dd")
    }
    if (dateRange.to) {
      filters.operating_date_to = format(dateRange.to, "yyyy-MM-dd")
    }
    return filters
  }

  const loadShiftHistory = useCallback(async () => {
    if (!currentBusiness) return

    setIsLoading(true)
    try {
      const baseFilters = buildHistoryFilters()
      let history: Shift[] = []

      if (selectedOutlet !== "all") {
        history = await shiftService.getHistory({ ...baseFilters, outlet: selectedOutlet })
      } else if (outlets.length > 0) {
        const results = await Promise.all(
          outlets.map((outlet) => shiftService.getHistory({ ...baseFilters, outlet: outlet.id }))
        )
        history = results.flat()
      } else {
        history = await shiftService.getHistory(baseFilters)
      }

      const uniqueHistory = new Map<string, Shift>()
      history.forEach((shift) => uniqueHistory.set(shift.id, shift))
      setShifts(Array.from(uniqueHistory.values()))
    } catch (error) {
      console.error("Failed to load shift history:", error)
      setShifts([])
    } finally {
      setIsLoading(false)
    }
  }, [currentBusiness, dateRange, selectedOutlet, outlets])

  const loadOpenShifts = async () => {
    if (!currentBusiness) return

    setIsLoadingActive(true)
    try {
      let openShifts: Shift[] = []

      if (selectedOutlet !== "all") {
        openShifts = await shiftService.listOpen({ outlet: selectedOutlet })
      } else if (outlets.length > 0) {
        const results = await Promise.all(
          outlets.map((outlet) => shiftService.listOpen({ outlet: outlet.id }))
        )
        openShifts = results.flat()
      } else {
        openShifts = await shiftService.listOpen()
      }

      const uniqueOpenShifts = new Map<string, Shift>()
      openShifts.forEach((shift) => uniqueOpenShifts.set(shift.id, shift))
      setActiveShifts(Array.from(uniqueOpenShifts.values()))
    } catch (error) {
      console.error("Failed to load active shifts:", error)
      setActiveShifts([])
    } finally {
      setIsLoadingActive(false)
    }
  }

  // Load tills for all outlets
  useEffect(() => {
    const loadTills = async () => {
      if (!currentBusiness) return
      
      try {
        const allTills: any[] = []
        for (const outlet of outlets) {
          try {
            const response = await tillService.list({ outlet: outlet.id })
            const tillsList = response.results || response
            if (Array.isArray(tillsList)) {
              allTills.push(...tillsList)
            }
          } catch (error) {
            console.error(`Failed to load tills for outlet ${outlet.id}:`, error)
          }
        }
        setTills(allTills)
      } catch (error) {
        console.error("Failed to load tills:", error)
        setTills([])
      }
    }
    
    loadTills()
  }, [currentBusiness, outlets])

  // Load shift history
  useEffect(() => {
    loadShiftHistory()
  }, [loadShiftHistory])

  // Load active shifts
  useEffect(() => {
    loadOpenShifts()
  }, [currentBusiness, selectedOutlet, outlets])

  const handleCloseSuccess = () => {
    // Reload both active shifts and history
    loadOpenShifts()
    loadShiftHistory()
  }

  // Filter shifts for history tab - combine active and history shifts
  const filteredShifts = [...shifts, ...activeShifts].filter(shift => {
    if (dateRange.from && shift.operatingDate) {
      const shiftDate = new Date(shift.operatingDate)
      if (shiftDate < dateRange.from) return false
    }
    if (dateRange.to && shift.operatingDate) {
      const shiftDate = new Date(shift.operatingDate)
      if (shiftDate > dateRange.to) return false
    }
    return true
  })

  const calculateSales = (shift: Shift): number => {
    if (shift.status !== "CLOSED" || !shift.closingCashBalance) return 0
    return Math.max(0, shift.closingCashBalance - (shift.openingCashBalance || 0) - (shift.floatingCash || 0))
  }

  const calculateDuration = (shift: Shift): string => {
    if (!shift.startTime || !shift.endTime) return "N/A"
    try {
      const startDate = new Date(shift.startTime)
      const endDate = new Date(shift.endTime)
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return "N/A"
      const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60)
      const hours = Math.floor(duration / 60)
      const minutes = Math.floor(duration % 60)
      return `${hours}h ${minutes}m`
    } catch {
      return "N/A"
    }
  }

  const calculateActiveDuration = (shift: Shift): string => {
    if (!shift.startTime) return "N/A"
    try {
      const startDate = new Date(shift.startTime)
      if (isNaN(startDate.getTime())) return "N/A"
      const duration = (new Date().getTime() - startDate.getTime()) / (1000 * 60)
      const hours = Math.floor(duration / 60)
      const minutes = Math.floor(duration % 60)
      return `${hours}h ${minutes}m`
    } catch {
      return "N/A"
    }
  }

  const calculateDifference = (shift: Shift): number => {
    if (shift.status !== "CLOSED" || !shift.closingCashBalance) return 0
    return shift.closingCashBalance - (shift.openingCashBalance || 0)
  }

  const getOutletName = (outletId: string): string => {
    const outlet = outlets.find(o => o.id === outletId)
    return outlet?.name || "Unknown Outlet"
  }

  const getTillName = (tillId: string): string => {
    const till = tills.find(t => t.id === tillId)
    return till?.name || tillId
  }

  const handleExportToExcel = () => {
    try {
      // Dynamically import xlsx to avoid SSR issues
      const XLSX = require('xlsx')
      
      // Prepare data for Excel
      const excelData = filteredShifts.map(shift => ({
        'Date': (() => {
          if (!shift.operatingDate) return "N/A"
          try {
            const date = new Date(shift.operatingDate)
            if (isNaN(date.getTime())) return "N/A"
            return format(date, "MMM dd, yyyy")
          } catch {
            return "N/A"
          }
        })(),
        'Outlet': getOutletName(shift.outletId),
        'Till': getTillName(shift.tillId),
        'Duration': (() => {
          if (!shift.startTime || !shift.endTime) return "N/A"
          try {
            const startDate = new Date(shift.startTime)
            const endDate = new Date(shift.endTime)
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return "N/A"
            const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60)
            const hours = Math.floor(duration / 60)
            const minutes = Math.floor(duration % 60)
            return `${hours}h ${minutes}m`
          } catch {
            return "N/A"
          }
        })(),
        'Opening Cash': shift.openingCashBalance || 0,
        'Closing Cash': shift.closingCashBalance || "N/A",
        'Sales': shift.status === "CLOSED" && shift.closingCashBalance 
          ? Math.max(0, shift.closingCashBalance - (shift.openingCashBalance || 0) - (shift.floatingCash || 0))
          : "N/A",
        'Difference': shift.status === "CLOSED" && shift.closingCashBalance
          ? shift.closingCashBalance - (shift.openingCashBalance || 0)
          : "N/A",
        'Status': shift.status,
        'Notes': shift.notes || ""
      }))

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      
      // Set column widths
      const columnWidths = [
        { wch: 15 },  // Date
        { wch: 15 },  // Outlet
        { wch: 15 },  // Till
        { wch: 12 },  // Duration
        { wch: 15 },  // Opening Cash
        { wch: 15 },  // Closing Cash
        { wch: 15 },  // Sales
        { wch: 15 },  // Difference
        { wch: 12 },  // Status
        { wch: 20 }   // Notes
      ]
      worksheet['!cols'] = columnWidths

      // Create workbook
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Shifts")

      // Generate filename with date
      const fileName = `shifts-report-${format(new Date(), "yyyy-MM-dd-HHmmss")}.xlsx`
      
      // Write file
      XLSX.writeFile(workbook, fileName)
    } catch (error) {
      console.error("Failed to export Excel file:", error)
    }
  }

  const handlePrintShift = async (shift: Shift) => {
    setIsPrinting(true)
    try {
      // Generate shift report HTML content
      const reportHTML = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; margin: 10px; font-size: 12px; }
              .header { text-align: center; margin-bottom: 10px; border-bottom: 1px solid #000; padding-bottom: 5px; }
              .title { font-size: 16px; font-weight: bold; }
              .business-name { font-size: 14px; margin-top: 2px; }
              .section { margin-top: 10px; }
              .label { font-weight: bold; }
              .row { display: flex; justify-content: space-between; margin: 3px 0; }
              .footer { text-align: center; margin-top: 10px; border-top: 1px solid #000; padding-top: 5px; font-size: 10px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">SHIFT REPORT</div>
              <div class="business-name">${currentBusiness?.name || 'Business'}</div>
            </div>
            
            <div class="section">
              <div class="row">
                <span class="label">Date:</span>
                <span>${shift.operatingDate ? format(new Date(shift.operatingDate), "MMM dd, yyyy") : "N/A"}</span>
              </div>
              <div class="row">
                <span class="label">Outlet:</span>
                <span>${getOutletName(shift.outletId)}</span>
              </div>
              <div class="row">
                <span class="label">Till:</span>
                <span>${getTillName(shift.tillId)}</span>
              </div>
              <div class="row">
                <span class="label">Status:</span>
                <span>${shift.status}</span>
              </div>
            </div>
            
            <div class="section">
              <div class="row">
                <span class="label">Opening Cash:</span>
                <span>MWK ${(shift.openingCashBalance || 0).toFixed(2)}</span>
              </div>
              <div class="row">
                <span class="label">Closing Cash:</span>
                <span>${shift.closingCashBalance ? `MWK ${shift.closingCashBalance.toFixed(2)}` : "N/A"}</span>
              </div>
              <div class="row">
                <span class="label">Duration:</span>
                <span>${calculateDuration(shift)}</span>
              </div>
            </div>
            
            <div class="footer">
              <p>Printed: ${format(new Date(), "MMM dd, yyyy HH:mm:ss")}</p>
            </div>
          </body>
        </html>
      `

      const reportText = htmlToText(reportHTML)
      await printTextViaAgent(reportText)
    } catch (error) {
      console.error("Failed to print shift report:", error)
    } finally {
      setIsPrinting(false)
    }
  }

  const tabs: TabConfig[] = [
    {
      value: "history",
      label: t("shifts.history.title"),
      icon: History,
    },
  ]

  return (
    <DashboardLayout>
      <PageLayout
        title={t("shifts.menu.management")}
        description={t("shifts.description")}
      >
        <FilterableTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        >
          {/* Shift History Tab */}
          <TabsContent value="history" className="space-y-6">
            {/* Start Shift and Export Buttons */}
            <div className="flex justify-end gap-3">
              <Button
                onClick={handleExportToExcel}
                className="bg-blue-900 hover:bg-blue-800 text-white"
              >
                <Download className="mr-2 h-4 w-4" />
                Export Report
              </Button>
              <Button
                onClick={() => router.push("/dashboard/office/shift-management/start-shift")}
                className="bg-blue-900 hover:bg-blue-800 text-white"
              >
                <PlayCircle className="mr-2 h-4 w-4" />
                Start Shift
              </Button>
            </div>

            {/* Filters */}
            <div className="mb-6 pb-4 border-b border-gray-300">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900">Outlet</label>
                  <Select value={selectedOutlet} onValueChange={setSelectedOutlet}>
                    <SelectTrigger className="bg-white border-gray-300">
                      <SelectValue placeholder={t("common.all_outlets")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Outlets</SelectItem>
                      {outlets.map((outlet) => (
                        <SelectItem key={outlet.id} value={outlet.id}>
                          {outlet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900">Date Range</label>
                  <div className="flex gap-2">
                    <DatePicker
                      date={dateRange.from}
                      onDateChange={(date) => setDateRange({ ...dateRange, from: date })}
                      placeholder="From date"
                    />
                    <DatePicker
                      date={dateRange.to}
                      onDateChange={(date) => setDateRange({ ...dateRange, to: date })}
                      placeholder="To date"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Shifts Table */}
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Shift Records</h3>
                <p className="text-sm text-gray-600">
                  {filteredShifts.length} shift{filteredShifts.length !== 1 ? "s" : ""} found
                </p>
              </div>
              <div className="rounded-md border border-gray-300 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-gray-900 font-semibold">Date</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Outlet</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Till</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Duration</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Opening Cash</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Closing Cash</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Sales</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Difference</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Status</TableHead>
                      <TableHead className="text-right text-gray-900 font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-gray-600">
                          Loading shifts...
                        </TableCell>
                      </TableRow>
                    ) : filteredShifts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-gray-600">
                          No shifts found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredShifts.map((shift) => {
                        const sales = calculateSales(shift)
                        const difference = calculateDifference(shift)
                        const duration = calculateDuration(shift)

                        return (
                          <TableRow key={shift.id} className="border-gray-300">
                            <TableCell className="font-medium">
                              {(() => {
                                if (!shift.operatingDate) return "N/A"
                                try {
                                  const date = new Date(shift.operatingDate)
                                  if (isNaN(date.getTime())) return "N/A"
                                  return format(date, "MMM dd, yyyy")
                                } catch {
                                  return "N/A"
                                }
                              })()}
                            </TableCell>
                            <TableCell>{getOutletName(shift.outletId)}</TableCell>
                            <TableCell>{getTillName(shift.tillId)}</TableCell>
                            <TableCell>{duration}</TableCell>
                            <TableCell>MWK {(shift.openingCashBalance || 0).toFixed(2)}</TableCell>
                            <TableCell>
                              {shift.closingCashBalance ? `MWK ${shift.closingCashBalance.toFixed(2)}` : "N/A"}
                            </TableCell>
                            <TableCell>
                              {shift.status === "CLOSED" ? (
                                <span className="font-medium">MWK {sales.toFixed(2)}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {shift.status === "CLOSED" && shift.closingCashBalance ? (
                                <div className="flex items-center gap-1">
                                  {difference > 0 ? (
                                    <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                                  ) : difference < 0 ? (
                                    <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                                  ) : (
                                    <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                  <span
                                    className={
                                      difference > 0
                                        ? "text-green-600"
                                        : difference < 0
                                        ? "text-destructive"
                                        : "text-muted-foreground"
                                    }
                                  >
                                    MWK {Math.abs(difference).toFixed(2)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={shift.status === "OPEN" ? "default" : "secondary"}
                              >
                                {shift.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Menu className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setShiftToView(shift)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handlePrintShift(shift)} disabled={isPrinting}>
                                    <Share2 className="h-4 w-4 mr-2" />
                                    {isPrinting ? "Printing..." : "Print Report"}
                                  </DropdownMenuItem>
                                  {shift.status === "OPEN" && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => setShiftToClose(shift)}>
                                        <X className="h-4 w-4 mr-2" />
                                        Close Shift
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </FilterableTabs>
      </PageLayout>

      {/* Shift Details Dialog */}
      <Dialog open={!!shiftToView} onOpenChange={(open) => !open && setShiftToView(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Shift Details</DialogTitle>
            <DialogDescription>
              Complete shift information and summary
            </DialogDescription>
          </DialogHeader>
          {shiftToView && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Date</label>
                  <p className="text-base font-semibold">
                    {shiftToView.operatingDate 
                      ? format(new Date(shiftToView.operatingDate), "MMM dd, yyyy") 
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Outlet</label>
                  <p className="text-base font-semibold">{getOutletName(shiftToView.outletId)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Till</label>
                  <p className="text-base font-semibold">{getTillName(shiftToView.tillId)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Status</label>
                  <Badge variant={shiftToView.status === "OPEN" ? "default" : "secondary"}>
                    {shiftToView.status}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Started</label>
                  <p className="text-base font-semibold">
                    {shiftToView.startTime 
                      ? format(new Date(shiftToView.startTime), "MMM dd, yyyy HH:mm") 
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Duration</label>
                  <p className="text-base font-semibold">{calculateDuration(shiftToView)}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Cash Summary</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Opening Cash</label>
                    <p className="text-base font-semibold">
                      MWK {(shiftToView.openingCashBalance || 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Closing Cash</label>
                    <p className="text-base font-semibold">
                      {shiftToView.closingCashBalance 
                        ? `MWK ${shiftToView.closingCashBalance.toFixed(2)}` 
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Floating Cash</label>
                    <p className="text-base font-semibold">
                      MWK {(shiftToView.floatingCash || 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Sales</label>
                    <p className="text-base font-semibold">
                      {shiftToView.status === "CLOSED" 
                        ? `MWK ${calculateSales(shiftToView).toFixed(2)}` 
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Difference</label>
                    <p className={`text-base font-semibold ${
                      calculateDifference(shiftToView) > 0 
                        ? "text-green-600" 
                        : calculateDifference(shiftToView) < 0 
                        ? "text-destructive" 
                        : "text-gray-600"
                    }`}>
                      MWK {Math.abs(calculateDifference(shiftToView)).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Shift ID</label>
                    <p className="text-base font-semibold text-gray-600">#{shiftToView.id.slice(-6)}</p>
                  </div>
                </div>
              </div>

              {shiftToView.notes && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
                  <p className="text-sm text-gray-600">{shiftToView.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CloseShiftModal
        open={!!shiftToClose}
        onOpenChange={(open) => !open && setShiftToClose(null)}
        shift={shiftToClose}
        onSuccess={handleCloseSuccess}
      />
    </DashboardLayout>
  )
}
