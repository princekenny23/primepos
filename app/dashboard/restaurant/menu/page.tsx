"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
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
import { useState } from "react"
import { AddEditMenuItemModal } from "@/components/modals/add-edit-menu-item-modal"

export default function MenuPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [showAddMenuItem, setShowAddMenuItem] = useState(false)
  const [selectedMenuItem, setSelectedMenuItem] = useState<any>(null)

  // Mock menu items
  const menuItems = [
    { id: "1", name: "Burger", category: "Main Course", price: 12.99, available: true, description: "Classic beef burger" },
    { id: "2", name: "Pizza", category: "Main Course", price: 15.99, available: true, description: "Margherita pizza" },
    { id: "3", name: "Pasta", category: "Main Course", price: 13.99, available: true, description: "Spaghetti carbonara" },
    { id: "4", name: "Salad", category: "Appetizer", price: 8.99, available: true, description: "Fresh garden salad" },
    { id: "5", name: "Soup", category: "Appetizer", price: 6.99, available: false, description: "Tomato soup" },
    { id: "6", name: "Ice Cream", category: "Dessert", price: 5.99, available: true, description: "Vanilla ice cream" },
  ]

  const filteredItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const categories = Array.from(new Set(menuItems.map(item => item.category)))
  const availableCount = menuItems.filter(item => item.available).length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Menu Management</h1>
            <p className="text-muted-foreground">Manage your restaurant menu items</p>
          </div>
          <Button onClick={() => {
            setSelectedMenuItem(null)
            setShowAddMenuItem(true)
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Menu Item
          </Button>
        </div>

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
                {filteredItems.map((item) => (
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
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <AddEditMenuItemModal
        open={showAddMenuItem}
        onOpenChange={setShowAddMenuItem}
        menuItem={selectedMenuItem}
      />
    </DashboardLayout>
  )
}

