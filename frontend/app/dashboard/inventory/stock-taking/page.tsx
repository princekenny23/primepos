"use client";

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Plus, MoreVertical, AlertCircle, CheckCircle2, Eye, Users, Upload, Menu, Trash2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { StartStockTakeModal } from "@/components/modals/start-stock-take-modal"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { inventoryService } from "@/lib/services/inventoryService"
import { useBusinessStore } from "@/stores/businessStore"
import { useRealAPI } from "@/lib/utils/api-config"
import Link from "next/link"
import { useI18n } from "@/contexts/i18n-context"

interface StockTake {
  id: string
  outletId: string
  outletName: string
  date: string
  time: string
  createdAt: string
  description?: string
  status: "RUNNING" | "FINISHED"
  progress: number
  totalItems: number
  countedItems: number
  startedBy: string
  participants?: number
  completedAt?: string
  operatingDate?: string
}

export default function StockTakingHistoryPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { currentBusiness, currentOutlet, outlets } = useBusinessStore()
  const { t } = useI18n()
  const [showStartModal, setShowStartModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [allStockTakes, setAllStockTakes] = useState<StockTake[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<StockTake | null>(null)
  const useReal = useRealAPI()

  useEffect(() => {
    const loadStockTakes = async () => {
      if (!currentBusiness) return
      
      setIsLoading(true)
      try {
        if (useReal) {
          const response = await inventoryService.getStockTakes({
            outlet: currentOutlet?.id ? String(currentOutlet.id) : undefined,
          })
          const stockTakes = response.results || []
          
          // Transform all stock takes into unified format
          const transformed = stockTakes.map((st: any) => {
            const isRunning = st.status === 'running'
            const items = st.items || []
            const countedItems = items.filter((i: any) => i.counted_quantity > 0).length
            const totalItems = items.length
            const progress = totalItems > 0 
              ? Math.round((countedItems / totalItems) * 100) 
              : 0

            return {
              id: String(st.id),
              outletId: String(st.outlet?.id || st.outlet || ""),
              outletName: st.outlet?.name || outlets.find(o => o.id === String(st.outlet))?.name || "--",
              date: st.created_at,
              time: new Date(st.created_at).toLocaleTimeString(),
              createdAt: st.created_at,
              description: st.description || "",
              status: isRunning ? "RUNNING" as const : "FINISHED" as const,
              progress: isRunning ? progress : 100,
              totalItems,
              countedItems: isRunning ? countedItems : totalItems,
              startedBy: st.user_name || st.user?.name || st.user?.email || "System",
              participants: 1,
              completedAt: st.completed_at,
              operatingDate: st.operating_date || st.created_at?.split('T')[0] || "--",
            }
          })
          
          // Sort by created date (newest first)
          transformed.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          
          setAllStockTakes(transformed)
        } else {
          setAllStockTakes([])
        }
      } catch (error) {
        console.error("Failed to load stock takes:", error)
        setAllStockTakes([])
      } finally {
        setIsLoading(false)
      }
    }
    
    loadStockTakes()
  }, [currentBusiness, currentOutlet?.id, useReal, outlets])

  const handleJoinStockTake = (id: string) => {
    router.push(`/dashboard/inventory/stock-taking/${id}`)
  }

  const handleViewStockTake = (id: string) => {
    router.push(`/dashboard/inventory/stock-taking/${id}`)
  }

  const handleDeleteStockTake = (stockTake: StockTake) => {
    setPendingDelete(stockTake)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteStockTake = async () => {
    if (!pendingDelete) return
    try {
      await inventoryService.deleteStockTake(pendingDelete.id)
      setAllStockTakes((prev) => prev.filter((st) => st.id !== pendingDelete.id))
      toast({ title: "Deleted", description: "Stock take session deleted." })
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error?.message || "Could not delete stock take.",
        variant: "destructive",
      })
    } finally {
      setDeleteDialogOpen(false)
      setPendingDelete(null)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return format(date, "yyyy/MM/dd HH:mm")
    } catch {
      return dateString
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      const fileName = selectedFile.name.toLowerCase()
      
      // Validate file type
      if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
        toast({
          title: "Invalid File Type",
          description: "Please select an Excel (.xlsx, .xls) or CSV (.csv) file.",
          variant: "destructive",
        })
        return
      }
      
      setImportFile(selectedFile)
    }
  }

  const handleImport = async () => {
    if (!importFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to import.",
        variant: "destructive",
      })
      return
    }

    setIsImporting(true)
    try {
      // TODO: Implement stock take import API call
      // For now, show a placeholder message
      toast({
        title: "Import Feature",
        description: "Stock take import functionality will be implemented soon.",
      })
      
      // Simulate import delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setShowImportModal(false)
      setImportFile(null)
      
      // Reload stock takes after import
      // loadStockTakes() - will be called via useEffect
    } catch (error: any) {
      console.error("Failed to import stock takes:", error)
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import stock takes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <DashboardLayout>
      <PageLayout
        title={t("inventory.menu.stock_taking")}
        description={t("inventory.stock_take.description")}
        actions={
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowImportModal(true)}
              className="bg-white border-white text-[#1e3a8a] hover:bg-blue-50 hover:border-blue-50"
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Stock Take
            </Button>
            <Button 
              onClick={() => setShowStartModal(true)}
              className="bg-white border-white text-[#1e3a8a] hover:bg-blue-50 hover:border-blue-50"
            >
              <Plus className="mr-2 h-4 w-4" />
              Start New Stock Take
            </Button>
          </div>
        }
      >
        {/* Unified Stock Takes Table */}
        <div>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Stock Taking Sessions</h3>
            <p className="text-sm text-gray-600">
              View all stock taking sessions, both running and completed
            </p>
          </div>
          <div className="rounded-md border border-gray-300 bg-white">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Loading stock takes...</p>
              </div>
            ) : allStockTakes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No stock taking sessions found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="text-gray-900 font-semibold">STARTS</TableHead>
                    <TableHead className="text-gray-900 font-semibold">STATUS</TableHead>
                    <TableHead className="text-gray-900 font-semibold">OPERATING DATE</TableHead>
                    <TableHead className="text-gray-900 font-semibold">OUTLET</TableHead>
                    <TableHead className="text-gray-900 font-semibold">USER(S)</TableHead>
                    <TableHead className="text-gray-900 font-semibold">ITEMS</TableHead>
                    <TableHead className="text-gray-900 font-semibold">PERCENTAGE</TableHead>
                    <TableHead className="text-right text-gray-900 font-semibold">ACTION</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allStockTakes.map((stockTake) => (
                    <TableRow key={stockTake.id} className="border-gray-300">
                        {/* Status Icon */}
                        <TableCell>
                          <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded",
                            stockTake.status === "RUNNING" 
                              ? "bg-yellow-100 dark:bg-yellow-900/20" 
                              : "bg-green-100 dark:bg-green-900/20"
                          )}>
                            {stockTake.status === "RUNNING" ? (
                              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
                            )}
                          </div>
                        </TableCell>

                        {/* STARTS */}
                        <TableCell className="font-medium">
                          {formatDate(stockTake.createdAt)}
                        </TableCell>

                        {/* CLOSED */}
                        <TableCell>
                          {stockTake.status === "RUNNING" ? (
                            <span className="text-blue-900 dark:text-blue-900">Running...</span>
                          ) : stockTake.completedAt ? (
                            formatDate(stockTake.completedAt)
                          ) : (
                            formatDate(stockTake.createdAt)
                          )}
                        </TableCell>

                        {/* OPERATING DATE */}
                        <TableCell>
                          {stockTake.operatingDate && stockTake.operatingDate !== "--" 
                            ? stockTake.operatingDate 
                            : "--"}
                        </TableCell>

                        {/* OUTLET */}
                        <TableCell>
                          {stockTake.outletName !== "--" ? stockTake.outletName : "--"}
                        </TableCell>

                        {/* USER(S) */}
                        <TableCell>
                          {stockTake.startedBy || "System"}
                        </TableCell>

                        {/* ITEMS */}
                        <TableCell>
                          {stockTake.countedItems}/{stockTake.totalItems}
                        </TableCell>

                        {/* PERCENTAGE */}
                        <TableCell>
                          {stockTake.progress.toFixed(2)}%
                        </TableCell>

                        {/* ACTION */}
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Menu className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {stockTake.status === "RUNNING" ? (
                                <DropdownMenuItem onClick={() => handleJoinStockTake(stockTake.id)}>
                                  <Users className="mr-2 h-4 w-4" />
                                  Join Stock Take
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handleViewStockTake(stockTake.id)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteStockTake(stockTake)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            }
          </div>
        </div>
      </PageLayout>

      {/* Start New Stock Take Modal */}
      <StartStockTakeModal
        open={showStartModal}
        onOpenChange={setShowStartModal}
      />

      {/* Import Stock Take Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Stock Take</DialogTitle>
            <DialogDescription>
              Upload an Excel or CSV file to import stock take data. The file should contain product information and counted quantities.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>File (Excel or CSV)</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  {importFile ? importFile.name : "No file selected"}
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="stock-take-file-upload"
                  aria-label="Upload stock take file"
                  title="Upload stock take file"
                />
                <Label htmlFor="stock-take-file-upload">
                  <Button variant="outline" asChild>
                    <span>Choose File</span>
                  </Button>
                </Label>
              </div>
            </div>

            <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 p-3 text-sm text-blue-900 dark:text-blue-200">
              <p className="font-medium mb-1">File Format Requirements:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Product SKU or Barcode</li>
                <li>Counted Quantity</li>
                <li>Optional: Notes</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowImportModal(false)
                setImportFile(null)
              }}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!importFile || isImporting}>
              {isImporting ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete stock take?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected stock take session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteStockTake}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
