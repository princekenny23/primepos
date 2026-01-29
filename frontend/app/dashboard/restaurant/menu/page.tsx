"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Utensils, DollarSign, Edit, Trash2 } from "lucide-react"
import { useState, useCallback } from "react"
import { AddEditMenuItemModal } from "@/components/modals/add-edit-menu-item-modal"
import { productService } from "@/lib/services/productService"
import { useBusinessStore } from "@/stores/businessStore"
import { useRealAPI } from "@/lib/utils/api-config"
import { useToast } from "@/components/ui/use-toast"

export default function MenuPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { currentBusiness, currentOutlet } = useBusinessStore()
  
  // Redirect if not restaurant business
  useEffect(() => {
    if (currentBusiness && currentBusiness.type !== "restaurant") {
      router.push("/dashboard")
    }
  }, [currentBusiness, router])
  
  // Show loading while checking business type
  if (!currentBusiness || currentBusiness.type !== "restaurant") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    )
  }
  const useReal = useRealAPI()
  const [searchTerm, setSearchTerm] = useState("")
  const [showAddMenuItem, setShowAddMenuItem] = useState(false)
  const [selectedMenuItem, setSelectedMenuItem] = useState<any>(null)
  const [menuItems, setMenuItems] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadMenuItems = useCallback(async () => {
    if (!currentBusiness) {
      setMenuItems([])
      setIsLoading(false)
      return
    }
    
    setIsLoading(true)
    try {
      if (useReal) {
        const response = await productService.list({ 
          is_active: true 
        })
        const products = Array.isArray(response) ? response : response.results || []
        setMenuItems(products.map((product: any) => ({
          id: product.id,
          name: product.name,
          category: product.category?.name || "Uncategorized",
          price: parseFloat(product.price) || 0,
          available: product.isActive !== false,
          description: product.description || "",
        })))
      } else {
        setMenuItems([])
      }
    } catch (error: any) {
      console.error("Failed to load menu items:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to load menu items. Please try again.",
        variant: "destructive",
      })
      setMenuItems([])
    } finally {
      setIsLoading(false)
    }
  }, [currentBusiness, useReal, toast])

  useEffect(() => {
    loadMenuItems()
  }, [loadMenuItems])

  const filteredItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const categories = Array.from(new Set(menuItems.map(item => item.category)))
  const availableCount = menuItems.filter(item => item.available).length

  return (
    <DashboardLayout>
      <PageLayout
        title="Menu Management"
        description="Manage your restaurant menu items"
        actions={
          <Button onClick={() => {
            setSelectedMenuItem(null)
            setShowAddMenuItem(true)
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Menu Item
          </Button>
        }
      >

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Utensils className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{menuItems.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <Utensils className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{availableCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <Utensils className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or category..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Menu Items Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Menu Items</CardTitle>
            <CardDescription>
              {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <p className="text-muted-foreground">Loading menu items...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <p className="text-muted-foreground">No menu items found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.description}</TableCell>
                    <TableCell className="font-semibold">
                      MWK {item.price.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.available ? "default" : "secondary"}>
                        {item.available ? "Available" : "Unavailable"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedMenuItem(item)
                            setShowAddMenuItem(true)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageLayout>

      {/* Modals */}
      <AddEditMenuItemModal
        open={showAddMenuItem}
        onOpenChange={(open) => {
          setShowAddMenuItem(open)
          if (!open) {
            setSelectedMenuItem(null)
            loadMenuItems() // Refresh menu items after modal closes
          }
        }}
        menuItem={selectedMenuItem}
      />
    </DashboardLayout>
  )
}

