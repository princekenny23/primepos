"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
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
import { Plus, Folder, Edit, Trash2 } from "lucide-react"
import { useState } from "react"
import { AddCategoryModal } from "@/components/modals/add-category-modal"

export default function CategoriesPage() {
  const [showAddCategory, setShowAddCategory] = useState(false)

  // Mock categories data
  const categories = [
    { id: "1", name: "Electronics", description: "Electronic products and devices", productCount: 45 },
    { id: "2", name: "Clothing", description: "Apparel and accessories", productCount: 32 },
    { id: "3", name: "Food", description: "Food and beverages", productCount: 28 },
    { id: "4", name: "Home & Garden", description: "Home improvement and garden supplies", productCount: 15 },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Categories</h1>
            <p className="text-muted-foreground">Organize your products into categories</p>
          </div>
          <Button onClick={() => setShowAddCategory(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Product Categories</CardTitle>
            <CardDescription>
              {categories.length} categor{categories.length !== 1 ? "ies" : "y"} defined
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4 text-primary" />
                        <span className="font-medium">{category.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {category.description}
                    </TableCell>
                    <TableCell>{category.productCount} products</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AddCategoryModal
        open={showAddCategory}
        onOpenChange={setShowAddCategory}
      />
    </DashboardLayout>
  )
}

