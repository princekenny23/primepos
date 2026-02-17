"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Grid, Users, Table2, List, Trash2, Edit } from "lucide-react"
import { AddEditTableModal } from "@/components/modals/add-edit-table-modal"
import { useBusinessStore } from "@/stores/businessStore"
import { tableService, type Table } from "@/lib/services/tableService"
import { useToast } from "@/components/ui/use-toast"
import { useTenant } from "@/contexts/tenant-context"
import { getOutletPosMode } from "@/lib/utils/outlet-settings"
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

export default function TablesPage() {
  const router = useRouter()
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const { currentOutlet: tenantOutlet } = useTenant()
  const outlet = tenantOutlet || currentOutlet
  const posMode = getOutletPosMode(outlet, currentBusiness)
  const { toast } = useToast()

  const [showAddTable, setShowAddTable] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [tables, setTables] = useState<Table[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (currentBusiness && posMode !== "restaurant") {
      router.push("/dashboard")
    }
  }, [currentBusiness, posMode, router])

  const loadTables = useCallback(async () => {
    if (!outlet) {
      setTables([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const response = await tableService.list({ outlet: String(outlet.id) })
      setTables(response.results || [])
    } catch (error: any) {
      console.error("Failed to load tables:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to load tables. Please try again.",
        variant: "destructive",
      })
      setTables([])
    } finally {
      setIsLoading(false)
    }
  }, [outlet, toast])

  useEffect(() => {
    loadTables()
  }, [loadTables])

  const handleDeleteTable = async () => {
    if (!selectedTable) return

    try {
      await tableService.delete(selectedTable.id)
      toast({
        title: "Table Deleted",
        description: `${selectedTable.number} has been removed.`,
      })
      setShowDeleteConfirm(false)
      setSelectedTable(null)
      loadTables()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete table",
        variant: "destructive",
      })
    }
  }

  if (!currentBusiness || posMode !== "restaurant") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "occupied":
        return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 border-red-200 dark:border-red-800"
      case "reserved":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800"
      case "available":
        return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200 border-green-200 dark:border-green-800"
      case "out_of_service":
        return "bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-400 border-gray-300 dark:border-gray-800"
      default:
        return ""
    }
  }

  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, string> = {
      occupied: "Occupied",
      reserved: "Reserved",
      available: "Available",
      out_of_service: "Out of Service",
    }
    return statusMap[status] || status
  }

  return (
    <DashboardLayout>
      <PageLayout
        title="Table Management"
        description="Manage restaurant tables and seating"
      >
        <div className="flex justify-end gap-2 mb-6">
          <Button variant="default" onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}>
            {viewMode === "grid" ? <List className="mr-2 h-4 w-4" /> : <Grid className="mr-2 h-4 w-4" />}
            {viewMode === "grid" ? "List View" : "Grid View"}
          </Button>
          <Button variant="default" onClick={() => {
            setSelectedTable(null)
            setShowAddTable(true)
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Table
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Floor Layout</CardTitle>
                <CardDescription>Click on a table to edit or manage it</CardDescription>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-green-500" />
                  Available
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-red-500" />
                  Occupied
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-yellow-500" />
                  Reserved
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-gray-400" />
                  Out of Service
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading tables...</p>
              </div>
            ) : tables.length === 0 ? (
              <div className="text-center py-12">
                <Table2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">No tables configured yet.</p>
                <Button onClick={() => setShowAddTable(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Table
                </Button>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                {tables.map((table) => (
                  <div
                    key={table.id}
                    className={`p-4 border-2 rounded-lg cursor-pointer hover:shadow-md transition-all text-center ${
                      getStatusColor(table.status)
                    }`}
                    onClick={() => {
                      setSelectedTable(table)
                      setShowAddTable(true)
                    }}
                  >
                    <div className="font-bold text-lg mb-1">Table {table.number}</div>
                    <div className="text-xs mb-2">
                      <Users className="h-3 w-3 inline mr-1" />
                      {table.capacity} seats
                    </div>
                    {table.location && (
                      <div className="text-xs text-muted-foreground mb-1 truncate">
                        {table.location}
                      </div>
                    )}
                    <Badge className={getStatusColor(table.status)} variant="outline">
                      {getStatusDisplay(table.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {tables.map((table) => (
                  <div
                    key={table.id}
                    className={`p-4 border rounded-lg hover:bg-muted transition-colors ${
                      table.status === "occupied" ? "border-red-200" :
                      table.status === "reserved" ? "border-yellow-200" :
                      table.status === "out_of_service" ? "border-gray-300" :
                      "border-green-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="font-bold text-lg">Table {table.number}</div>
                        <Badge className={getStatusColor(table.status)}>
                          {getStatusDisplay(table.status)}
                        </Badge>
                        <div className="text-sm text-muted-foreground">
                          Capacity: {table.capacity}
                        </div>
                        {table.location && (
                          <div className="text-sm text-muted-foreground">
                            Location: {table.location}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTable(table)
                            setShowAddTable(true)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => {
                            setSelectedTable(table)
                            setShowDeleteConfirm(true)
                          }}
                          disabled={table.status === "occupied"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <AddEditTableModal
          open={showAddTable}
          onOpenChange={(open) => {
            setShowAddTable(open)
            if (!open) setSelectedTable(null)
          }}
          table={selectedTable}
          onSuccess={loadTables}
        />

        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Table {selectedTable?.number}?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete this table.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTable} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageLayout>
    </DashboardLayout>
  )
}

