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
import { Search, AlertTriangle, CheckCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { productService } from "@/lib/services/productService"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import Link from "next/link"
import { useI18n } from "@/contexts/i18n-context"
import { useBusinessStore } from "@/stores/businessStore"

export default function ExpiryManagementPage() {
  const { toast } = useToast()
  const { t } = useI18n()
  const { currentOutlet } = useBusinessStore()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [products, setProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadProducts = async () => {
    setIsLoading(true)
    try {
      const response = await productService.list({
        is_active: true,
        outlet: currentOutlet?.id ? String(currentOutlet.id) : undefined,
      })
      const allProducts = response.results || response || []
      const productsWithExpiry = allProducts.filter((p: any) => 
        p.expiry_date || p.manufacturing_date || p.track_expiration
      )
      setProducts(productsWithExpiry)
    } catch (error) {
      console.error("Failed to load products:", error)
      toast({
        title: "Error",
        description: "Failed to load products with expiry information",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOutlet?.id])

  const getExpiryStatus = (expiryDate: string | null | undefined) => {
    if (!expiryDate) return { status: "none", label: "No Expiry", color: "bg-gray-100" }
    const expiry = new Date(expiryDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const days = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (days < 0) return { status: "expired", label: "Expired", color: "bg-red-100" }
    if (days === 0) return { status: "expires-today", label: "Expires Today", color: "bg-red-100" }
    if (days <= 7) return { status: "expiring-soon", label: `${days} days`, color: "bg-orange-100" }
    if (days <= 30) return { status: "expiring-month", label: `${days} days`, color: "bg-yellow-100" }
    return { status: "valid", label: `${days} days`, color: "bg-green-100" }
  }

  const filteredProducts = products.filter((product: any) => {
    const search = searchTerm.toLowerCase()
    const matches = product.name?.toLowerCase().includes(search) || 
                   product.sku?.toLowerCase().includes(search) ||
                   product.barcode?.toLowerCase().includes(search)
    
    if (statusFilter === "all") return matches
    return matches && getExpiryStatus(product.expiry_date).status === statusFilter
  })

  return (
    <DashboardLayout>
      <PageLayout
        title={t("inventory.menu.expiry")}
        description={t("inventory.expiry.description")}
      >
        <div className="space-y-6">
          {/* Search and Filter */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Search products..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="expires-today">Expires Today</SelectItem>
                    <SelectItem value="expiring-soon">Expiring Soon</SelectItem>
                    <SelectItem value="expiring-month">This Month</SelectItem>
                    <SelectItem value="valid">Valid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Products Table */}
          <Card>
            <CardHeader>
              <CardTitle>Products with Expiry</CardTitle>
              <CardDescription>
                {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Mfg Date</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                    </TableRow>
                  ) : filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">No products found</TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((product) => {
                      const status = getExpiryStatus(product.expiry_date)
                      return (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>{product.sku || "N/A"}</TableCell>
                          <TableCell>
                            {product.manufacturing_date 
                              ? new Date(product.manufacturing_date).toLocaleDateString()
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            {product.expiry_date 
                              ? new Date(product.expiry_date).toLocaleDateString()
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge className={status.color}>{status.label}</Badge>
                          </TableCell>
                          <TableCell>{product.stock || 0}</TableCell>
                          <TableCell>
                            <Link href={`/dashboard/inventory/products/${product.id}`}>
                              <Button variant="ghost" size="sm">View</Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    </DashboardLayout>
  )
}

