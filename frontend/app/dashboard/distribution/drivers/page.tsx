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

export default function DriversPage() {
  const ITEMS_PER_PAGE = 10
  const { toast } = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [licenseNumber, setLicenseNumber] = useState("")
  const [idNumber, setIdNumber] = useState("")
  const [addDriverOpen, setAddDriverOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const driversResponse = await distributionService.listDrivers()
      setRows(driversResponse.results || driversResponse || [])
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load drivers", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const totalPages = Math.max(1, Math.ceil(rows.length / ITEMS_PER_PAGE))
  const currentRows = rows.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const onCreate = async () => {
    if (!name.trim() || !licenseNumber.trim()) return
    try {
      await distributionService.createDriver({
        name: name.trim(),
        phone: phone.trim(),
        license_number: licenseNumber.trim(),
        id_number: idNumber.trim(),
      })
      setName("")
      setPhone("")
      setLicenseNumber("")
      setIdNumber("")
      setAddDriverOpen(false)
      await loadData()
      setCurrentPage(1)
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create driver", variant: "destructive" })
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <DistributionTabs activeTab="drivers" />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Drivers</CardTitle>
            <Button onClick={() => setAddDriverOpen(true)}>Add Driver</Button>
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>ID Number</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5}>Loading...</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={5}>No drivers found.</TableCell></TableRow>
                ) : currentRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.name || "-"}</TableCell>
                    <TableCell>{row.phone || "-"}</TableCell>
                    <TableCell>{row.license_number || "-"}</TableCell>
                    <TableCell>{row.id_number || "-"}</TableCell>
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

        <Dialog open={addDriverOpen} onOpenChange={setAddDriverOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Driver</DialogTitle>
              <DialogDescription>Create a new driver profile.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-3 py-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Driver name" />
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
              <Input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="License number" />
              <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="ID number" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDriverOpen(false)}>Cancel</Button>
              <Button onClick={onCreate}>Save Driver</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
