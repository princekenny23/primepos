"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
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
import { Plus, Folder, Edit, Trash2, ArrowLeft } from "lucide-react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { AddCategoryModal } from "@/components/modals/add-category-modal"
import { categoryService } from "@/lib/services/productService"
import { useBusinessStore } from "@/stores/businessStore"
import type { Category } from "@/lib/types"

export default function CategoriesPage() {
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<any>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadCategories = async () => {
      if (!currentBusiness) return
      
      setIsLoading(true)
      try {
        const cats = await categoryService.list({
          outlet: currentOutlet?.id ? String(currentOutlet.id) : undefined,
        })
        setCategories(cats)
      } catch (error) {
        console.error("Failed to load categories:", error)
        setCategories([])
      } finally {
        setIsLoading(false)
      }
    }
    
    loadCategories()
  }, [currentBusiness, currentOutlet])

  const handleCategorySaved = () => {
    // Reload categories after save
    if (currentBusiness) {
      categoryService.list({
        outlet: currentOutlet?.id ? String(currentOutlet.id) : undefined,
      }).then(cats => {
        setCategories(cats)
      })
    }
  }

  return (
    <DashboardLayout>
      <PageLayout
        title="Categories"
        description="Organize your products into categories"
        actions={
          <Button 
            onClick={() => {
              setSelectedCategory(null)
              setShowAddCategory(true)
            }}
            className="bg-white border-white text-[#1e3a8a] hover:bg-blue-50 hover:border-blue-50"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        }
      >
        <div>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Product Categories</h3>
            <p className="text-sm text-gray-600">
              {isLoading ? "Loading..." : `${categories.length} categor${categories.length !== 1 ? "ies" : "y"} defined`}
            </p>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-600">Loading categories...</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Folder className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-600">No categories found</p>
              <Button
                variant="outline"
                className="mt-4 border-gray-300"
                onClick={() => {
                  setSelectedCategory(null)
                  setShowAddCategory(true)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Category
              </Button>
            </div>
          ) : (
            <div className="rounded-md border border-gray-300 bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-gray-900 font-semibold">Category</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Description</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id} className="border-gray-300">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Folder className="h-4 w-4 text-primary" />
                          <span className="font-medium">{category.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {category.description || "No description"}
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setSelectedCategory(category)
                              setShowAddCategory(true)
                            }}
                            className="border-gray-300"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive border-gray-300"
                            onClick={() => {
                              // TODO: Implement delete functionality
                              alert("Delete functionality coming soon")
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </PageLayout>

      <AddCategoryModal
        open={showAddCategory}
        onOpenChange={(open) => {
          setShowAddCategory(open)
          if (!open) {
            setSelectedCategory(null)
            handleCategorySaved()
          }
        }}
        category={selectedCategory}
        onSuccess={handleCategorySaved}
      />
    </DashboardLayout>
  )
}

