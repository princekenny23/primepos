"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { distributionService } from "@/lib/services/distributionService"
import { useToast } from "@/components/ui/use-toast"
import { DistributionTabs } from "@/app/dashboard/distribution/_components/distribution-tabs"

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_transit: "In Transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
}

function normalizeDeliveryStatus(value: unknown): string {
  const raw = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_")

  if (!raw) return "pending"

  if (
    raw === "pending" ||
    raw === "pending_dispatch" ||
    raw === "pending_assignment" ||
    raw === "awaiting_dispatch" ||
    raw === "awaiting_assignment" ||
    raw === "draft" ||
    raw === "new" ||
    raw === "created"
  ) {
    return "pending"
  }

  if (raw === "assigned" || raw === "dispatched") return "assigned"
  if (raw === "in_transit" || raw === "on_route" || raw === "out_for_delivery") return "in_transit"
  if (raw === "delivered" || raw === "completed") return "delivered"
  if (raw === "cancelled" || raw === "canceled" || raw === "void") return "cancelled"

  return raw
}

export default function DeliveriesPage() {
  const ITEMS_PER_PAGE = 10
  const { toast } = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignOrderId, setAssignOrderId] = useState<number | null>(null)
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([])
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState("")
  const [selectedDriverId, setSelectedDriverId] = useState("")
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelOrderId, setCancelOrderId] = useState<number | null>(null)

  const loadRows = async () => {
    setLoading(true)
    try {
      const response = await distributionService.listDeliveryOrders()
      setRows(response.results || response || [])
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load delivery orders", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRows()
  }, [])

  const totalPages = Math.max(1, Math.ceil(rows.length / ITEMS_PER_PAGE))
  const currentRows = rows.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const openAssignDialog = async (id: number) => {
    try {
      setActionLoadingId(id)
      const [vehiclesResponse, driversResponse] = await Promise.all([
        distributionService.listAvailableVehicles(),
        distributionService.listAvailableDrivers(),
      ])

      const vehicles = vehiclesResponse.results || vehiclesResponse || []
      const drivers = driversResponse.results || driversResponse || []

      setAvailableVehicles(vehicles)
      setAvailableDrivers(drivers)
      setSelectedVehicleId(vehicles.length > 0 ? String(vehicles[0].id) : "")
      setSelectedDriverId(drivers.length > 0 ? String(drivers[0].id) : "")
      setAssignOrderId(id)
      setAssignOpen(true)
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load available resources", variant: "destructive" })
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleAssign = async () => {
    if (!assignOrderId || !selectedVehicleId || !selectedDriverId) return
    try {
      setActionLoadingId(assignOrderId)
      await distributionService.assignDeliveryOrder(assignOrderId, {
        vehicle_id: Number(selectedVehicleId),
        driver_id: Number(selectedDriverId),
      })
      setAssignOpen(false)
      setAssignOrderId(null)
      await loadRows()
      setCurrentPage(1)
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to assign delivery order", variant: "destructive" })
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleStartTrip = async (id: number) => {
    try {
      setActionLoadingId(id)
      await distributionService.startTrip(id)
      await loadRows()
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to start trip", variant: "destructive" })
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleConfirmDelivery = async (id: number) => {
    try {
      setActionLoadingId(id)
      await distributionService.confirmDelivery(id)
      await loadRows()
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to confirm delivery", variant: "destructive" })
    } finally {
      setActionLoadingId(null)
    }
  }

  const openCancelDialog = (id: number) => {
    setCancelOrderId(id)
    setCancelOpen(true)
  }

  const handleCancelDelivery = async () => {
    if (!cancelOrderId) return
    try {
      setActionLoadingId(cancelOrderId)
      await distributionService.cancelDelivery(cancelOrderId)
      await loadRows()
      setCancelOpen(false)
      setCancelOrderId(null)
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to cancel delivery", variant: "destructive" })
    } finally {
      setActionLoadingId(null)
    }
  }

  const renderActions = (row: any) => {
    const isBusy = actionLoadingId === row.id
    const status = normalizeDeliveryStatus(row.delivery_status)

    if (status === "delivered" || status === "cancelled") {
      return <span className="text-xs text-muted-foreground">No actions</span>
    }

    return (
      <div className="flex flex-wrap gap-1 justify-end">
        {status === "pending" && (
          <Button size="sm" variant="outline" disabled={isBusy} onClick={() => openAssignDialog(row.id)}>
            Assign
          </Button>
        )}
        {status === "assigned" && (
          <Button size="sm" variant="outline" disabled={isBusy} onClick={() => handleStartTrip(row.id)}>
            Start Trip
          </Button>
        )}
        {status === "in_transit" && (
          <Button size="sm" variant="outline" disabled={isBusy} onClick={() => handleConfirmDelivery(row.id)}>
            Confirm Delivery
          </Button>
        )}
        <Button size="sm" variant="destructive" disabled={isBusy} onClick={() => openCancelDialog(row.id)}>
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <DistributionTabs activeTab="delivery-orders" />
        <Card>
          <CardHeader><CardTitle>Delivery Orders</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Sales Order</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[180px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6}>Loading...</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6}>No delivery orders found.</TableCell></TableRow>
                ) : currentRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>#{row.id}</TableCell>
                    <TableCell>{row.sales_order_receipt_number || row.sales_order}</TableCell>
                    <TableCell>{row.assigned_driver_name || "-"}</TableCell>
                    <TableCell>{row.assigned_vehicle_plate || "-"}</TableCell>
                    <TableCell>
                      {STATUS_LABELS[normalizeDeliveryStatus(row.delivery_status)] || String(row.delivery_status || "-")}
                    </TableCell>
                    <TableCell className="w-[180px] text-right">{renderActions(row)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {rows.length > ITEMS_PER_PAGE && (
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}>
                  Prev
                </Button>
                <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}>
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Driver and Vehicle</DialogTitle>
            <DialogDescription>Select available resources for this delivery order.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 py-2">
            <select
              aria-label="Available vehicle"
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="h-10 rounded-md border bg-background px-3"
            >
              <option value="">Select vehicle</option>
              {availableVehicles.map((vehicle) => (
                <option key={vehicle.id} value={String(vehicle.id)}>
                  {vehicle.plate_number}
                </option>
              ))}
            </select>

            <select
              aria-label="Available driver"
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="h-10 rounded-md border bg-background px-3"
            >
              <option value="">Select driver</option>
              {availableDrivers.map((driver) => (
                <option key={driver.id} value={String(driver.id)}>
                  {driver.name}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={!selectedVehicleId || !selectedDriverId || actionLoadingId === assignOrderId}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cancelOpen}
        onOpenChange={(open) => {
          setCancelOpen(open)
          if (!open) setCancelOrderId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Delivery Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this delivery order?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelDelivery}
              disabled={!cancelOrderId || actionLoadingId === cancelOrderId}
            >
              Cancel Delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
