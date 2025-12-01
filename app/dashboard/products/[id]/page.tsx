"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Package, TrendingUp, History, Building2 } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ViewProductHistoryModal } from "@/components/modals/view-product-history-modal"
import { useState } from "react"

export default function ProductDetailPage() {
  const params = useParams()
  const productId = params.id as string
  const [showHistory, setShowHistory] = useState(false)

  // Mock product data
  const product = {
    id: productId,
    name: "Product A",
    sku: "SKU-001",
    category: "Electronics",
    cost: 20.00,
    price: 29.99,
    stock: 45,
    minStock: 10,
    barcode: "1234567890123",
    unit: "piece",
    tax: 10,
    supplier: "Supplier ABC",
    description: "High-quality electronic product",
  }

  // Mock stock history
  const stockHistory = [
    { date: "2024-01-15", type: "Sale", quantity: -2, balance: 45, user: "John Doe" },
    { date: "2024-01-14", type: "Purchase", quantity: 50, balance: 47, user: "Jane Smith" },
    { date: "2024-01-13", type: "Adjustment", quantity: -3, balance: -3, user: "Admin" },
  ]

  // Mock sales history
  const salesHistory = [
    { date: "2024-01-15", saleId: "#1001", quantity: 2, price: 29.99, total: 59.98, customer: "Customer A" },
    { date: "2024-01-14", saleId: "#1000", quantity: 1, price: 29.99, total: 29.99, customer: "Customer B" },
    { date: "2024-01-13", saleId: "#999", quantity: 3, price: 29.99, total: 89.97, customer: "Customer C" },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/products">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{product.name}</h1>
            <p className="text-muted-foreground">SKU: {product.sku}</p>
          </div>
        </div>

        <Tabs defaultValue="details" className="space-y-4">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="stock-history">Stock History</TabsTrigger>
            <TabsTrigger value="sales-history">Sales History</TabsTrigger>
            <TabsTrigger value="supplier">Supplier Info</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Product Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Product Name</p>
                    <p className="font-medium">{product.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">SKU</p>
                    <p className="font-medium">{product.sku}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Category</p>
                    <p className="font-medium">{product.category}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Barcode</p>
                    <p className="font-medium">{product.barcode}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Unit</p>
                    <p className="font-medium">{product.unit}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="font-medium">{product.description}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pricing & Stock</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Cost</p>
                    <p className="font-medium">MWK {product.cost.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Price</p>
                    <p className="font-medium">MWK {product.price.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tax Rate</p>
                    <p className="font-medium">{product.tax}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current Stock</p>
                    <p className="font-medium text-2xl">{product.stock}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Minimum Stock</p>
                    <p className="font-medium">{product.minStock}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      product.stock > product.minStock
                        ? "bg-green-100 text-green-800"
                        : product.stock > 0
                        ? "bg-orange-100 text-orange-800"
                        : "bg-red-100 text-red-800"
                    }`}>
                      {product.stock > product.minStock ? "In Stock" : 
                       product.stock > 0 ? "Low Stock" : "Out of Stock"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="stock-history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Stock History</CardTitle>
                <CardDescription>Track all stock movements for this product</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>User</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockHistory.map((entry, index) => (
                      <TableRow key={index}>
                        <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                        <TableCell>{entry.type}</TableCell>
                        <TableCell className={entry.quantity > 0 ? "text-green-600" : "text-red-600"}>
                          {entry.quantity > 0 ? "+" : ""}{entry.quantity}
                        </TableCell>
                        <TableCell>{entry.balance}</TableCell>
                        <TableCell>{entry.user}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4">
                  <Button variant="outline" onClick={() => setShowHistory(true)}>
                    <History className="mr-2 h-4 w-4" />
                    View Full History
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sales-history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sales History</CardTitle>
                <CardDescription>Recent sales transactions for this product</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Sale ID</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Customer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesHistory.map((sale, index) => (
                      <TableRow key={index}>
                        <TableCell>{new Date(sale.date).toLocaleDateString()}</TableCell>
                        <TableCell>{sale.saleId}</TableCell>
                        <TableCell>{sale.quantity}</TableCell>
                        <TableCell>MWK {sale.price.toFixed(2)}</TableCell>
                        <TableCell className="font-semibold">MWK {sale.total.toFixed(2)}</TableCell>
                        <TableCell>{sale.customer}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="supplier" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Supplier Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Supplier Name</p>
                  <p className="font-medium">{product.supplier}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contact Email</p>
                  <p className="font-medium">supplier@example.com</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">+1 (555) 123-4567</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">123 Supplier St, City, State 12345</p>
                </div>
                <div className="pt-4">
                  <Link href="/dashboard/suppliers">
                    <Button variant="outline">View All Suppliers</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ViewProductHistoryModal
        open={showHistory}
        onOpenChange={setShowHistory}
        productId={productId}
        productName={product.name}
      />
    </DashboardLayout>
  )
}

