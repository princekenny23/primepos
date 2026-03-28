"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { distributionService } from "@/lib/services/distributionService"
import { useToast } from "@/components/ui/use-toast"
import { DistributionTabs } from "@/app/dashboard/distribution/_components/distribution-tabs"

export default function VehiclesPage() {
  const ITEMS_PER_PAGE = 10
  const { toast } = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [plate, setPlate] = useState("")
  const [make, setMake] = useState("")
  const [model, setModel] = useState("")
  const [fuelType, setFuelType] = useState("diesel")
  const [addVehicleOpen, setAddVehicleOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadRows = async () => {
    setLoading(true)
    try {
      const response = await distributionService.listVehicles()
      setRows(response.results || response || [])
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load vehicles", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRows()
  }, [])

  const totalPages = Math.max(1, Math.ceil(rows.length / ITEMS_PER_PAGE))
  const currentRows = rows.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const onCreate = async () => {
    if (!plate.trim()) return
    try {
      await distributionService.createVehicle({
        plate_number: plate.trim(),
        make: make.trim(),
        model: model.trim(),
        fuel_type: fuelType,
      })
      setPlate("")
      setMake("")
      setModel("")
      setFuelType("diesel")
      setAddVehicleOpen(false)
      await loadRows()
      setCurrentPage(1)
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create vehicle", variant: "destructive" })
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <DistributionTabs activeTab="vehicles" />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Vehicles</CardTitle>
            <Button onClick={() => setAddVehicleOpen(true)}>Add Vehicle</Button>
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plate</TableHead>
                  <TableHead>Make</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Fuel</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5}>Loading...</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={5}>No vehicles found.</TableCell></TableRow>
                ) : currentRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.plate_number}</TableCell>
                    <TableCell>{row.make || "-"}</TableCell>
                    <TableCell>{row.model || "-"}</TableCell>
                    <TableCell>{row.fuel_type || "-"}</TableCell>
                    <TableCell>{row.status || "-"}</TableCell>
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

        <Dialog open={addVehicleOpen} onOpenChange={setAddVehicleOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Vehicle</DialogTitle>
              <DialogDescription>Create a new fleet vehicle.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-3 py-2">
              <Input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="Plate number" />
              <Input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Make" />
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model" />
              <select
                aria-label="Fuel type"
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value)}
                className="h-10 rounded-md border bg-background px-3"
              >
                <option value="diesel">Diesel</option>
                <option value="petrol">Petrol</option>
                <option value="electric">Electric</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddVehicleOpen(false)}>Cancel</Button>
              <Button onClick={onCreate}>Save Vehicle</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
