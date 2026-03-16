"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { distributionService } from "@/lib/services/distributionService"
import { useToast } from "@/components/ui/use-toast"
import { DistributionTabs } from "@/app/dashboard/distribution/_components/distribution-tabs"

export default function TripHistoryPage() {
  const ITEMS_PER_PAGE = 10
  const { toast } = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const resolveGoodsAmount = (row: any) => {
    const raw = row?.total_goods_amount ?? row?.delivery_order_reference?.total_goods_amount
    if (raw === null || raw === undefined) return "-"
    if (typeof raw === "string" && raw.trim() === "") return "-"
    return String(raw)
  }

  const loadRows = async () => {
    setLoading(true)
    try {
      const response = await distributionService.listTrips()
      setRows(response.results || response || [])
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load trip history", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRows()
  }, [])

  const totalPages = Math.max(1, Math.ceil(rows.length / ITEMS_PER_PAGE))
  const currentRows = rows.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <DistributionTabs activeTab="trip-history" />
        <Card>
          <CardHeader><CardTitle>Trip History</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trip ID</TableHead>
                  <TableHead>Delivery Order</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Distance (km)</TableHead>
                  <TableHead>Fuel Cost</TableHead>
                  <TableHead>Goods Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8}>Loading...</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={8}>No trips found.</TableCell></TableRow>
                ) : currentRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>#{row.id}</TableCell>
                    <TableCell>#{row.delivery_order_reference?.id || row.delivery_order || "-"}</TableCell>
                    <TableCell>{row.vehicle_plate_number || "-"}</TableCell>
                    <TableCell>{row.driver_name || "-"}</TableCell>
                    <TableCell>{row.distance_km ?? "0"}</TableCell>
                    <TableCell>{row.fuel_cost ?? "0.00"}</TableCell>
                    <TableCell>{resolveGoodsAmount(row)}</TableCell>
                    <TableCell>{row.created_at ? new Date(row.created_at).toLocaleString() : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {rows.length > ITEMS_PER_PAGE && (
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                >
                  Prev
                </button>
                <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                <button
                  type="button"
                  className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Next
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
