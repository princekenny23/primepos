"use client"

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
import { Plus, Search, RotateCcw, CheckCircle, XCircle, Clock } from "lucide-react"
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import Link from "next/link"

import { purchaseReturnService } from "@/lib/services/purchaseReturnService"
import { useBusinessStore } from "@/stores/businessStore"

export default function PurchaseReturnsPage() {
  const { toast } = useToast()
  const { currentOutlet } = useBusinessStore()
  const [searchTerm, setSearchTerm] = useState("")
  const [returns, setReturns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    purchaseReturnService.list({
      outlet: currentOutlet?.id ? String(currentOutlet.id) : undefined,
    })
      .then((response) => setReturns(response.results))
      .catch((error) => {
        console.error("Failed to load returns:", error)
        toast({
          title: "Error",
          description: "Failed to load purchase returns",
          variant: "destructive",
        })
      })
      .finally(() => setLoading(false))
  }, [currentOutlet?.id, toast])

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; icon: any }> = {
      draft: { bg: "bg-gray-100", text: "text-gray-800", icon: Clock },
      pending: { bg: "bg-yellow-100", text: "text-yellow-800", icon: Clock },
      approved: { bg: "bg-blue-100", text: "text-blue-800", icon: CheckCircle },
      returned: { bg: "bg-green-100", text: "text-green-800", icon: CheckCircle },
      cancelled: { bg: "bg-red-100", text: "text-red-800", icon: XCircle },
    }
    
    const config = statusConfig[status] || statusConfig.draft
    const Icon = config.icon
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${config.bg} ${config.text}`}>
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  return (
    <DashboardLayout>
      <PageLayout
        title="Purchase Returns"
        description="Handle returns of purchased items to suppliers"
        actions={
          <Link href="/dashboard/inventory/suppliers/returns/new">
            <Button className="bg-white border-white text-[#1e3a8a] hover:bg-blue-50 hover:border-blue-50">
              <Plus className="mr-2 h-4 w-4" />
              New Return
            </Button>
          </Link>
        }
      >
        {/* Filters */}
        <div className="mb-6 pb-4 border-b border-gray-300">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search returns..."
                className="pl-10 bg-white border-gray-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Returns Table */}
        <div>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">All Purchase Returns</h3>
            <p className="text-sm text-gray-600">
              {returns.length} return{returns.length !== 1 ? "s" : ""} found
            </p>
          </div>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-600">Loading...</p>
            </div>
          ) : returns.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No returns found. Create your first purchase return to get started.</p>
            </div>
          ) : (
            <div className="rounded-md border border-gray-300 bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-gray-900 font-semibold">Return Number</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Supplier</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Return Date</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Purchase Order</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Total</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Status</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returns.map((returnItem) => (
                    <TableRow key={returnItem.id} className="border-gray-300">
                      <TableCell className="font-medium">{returnItem.return_number}</TableCell>
                      <TableCell>{returnItem.supplier?.name || "N/A"}</TableCell>
                      <TableCell>{new Date(returnItem.return_date).toLocaleDateString()}</TableCell>
                      <TableCell>{returnItem.purchase_order?.po_number || "N/A"}</TableCell>
                      <TableCell>${returnItem.total?.toFixed(2) || "0.00"}</TableCell>
                      <TableCell>{getStatusBadge(returnItem.status)}</TableCell>
                      <TableCell>
                        <Link href={`/dashboard/inventory/suppliers/returns/${returnItem.id}`}>
                          <Button variant="ghost" size="sm" className="border-gray-300">View</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </PageLayout>
    </DashboardLayout>
  )
}

