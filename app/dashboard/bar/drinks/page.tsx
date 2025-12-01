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
import { Plus, Search, Wine, TrendingUp, AlertTriangle } from "lucide-react"
import { useState } from "react"
import { NewDrinkModal } from "@/components/modals/new-drink-modal"

export default function DrinksPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [showNewDrink, setShowNewDrink] = useState(false)

  // Mock drinks data
  const drinks = [
    {
      id: "1",
      name: "Vodka",
      category: "Spirits",
      type: "Bottle",
      size: "750ml",
      cost: 25.00,
      price: 8.00,
      stock: 12,
      bottleToShot: 16,
      status: "In Stock",
    },
    {
      id: "2",
      name: "Whiskey",
      category: "Spirits",
      type: "Bottle",
      size: "750ml",
      cost: 35.00,
      price: 10.00,
      stock: 8,
      bottleToShot: 16,
      status: "In Stock",
    },
    {
      id: "3",
      name: "Beer",
      category: "Beer",
      type: "Bottle",
      size: "330ml",
      cost: 2.50,
      price: 5.00,
      stock: 3,
      bottleToShot: 1,
      status: "Low Stock",
    },
    {
      id: "4",
      name: "Wine",
      category: "Wine",
      type: "Bottle",
      size: "750ml",
      cost: 15.00,
      price: 45.00,
      stock: 20,
      bottleToShot: 5,
      status: "In Stock",
    },
    {
      id: "5",
      name: "Cocktail Mix",
      category: "Mixers",
      type: "Bottle",
      size: "1L",
      cost: 8.00,
      price: 12.00,
      stock: 15,
      bottleToShot: 20,
      status: "In Stock",
    },
  ]

  const filteredDrinks = drinks.filter(drink =>
    drink.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    drink.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalDrinks = drinks.length
  const lowStockCount = drinks.filter(d => d.status === "Low Stock").length
  const totalValue = drinks.reduce((sum, d) => sum + (d.cost * d.stock), 0)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Drink Inventory</h1>
            <p className="text-muted-foreground">Manage bar drinks and inventory</p>
          </div>
          <Button onClick={() => setShowNewDrink(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Drink
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Drinks</CardTitle>
              <Wine className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalDrinks}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{lowStockCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">MWK {totalValue.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <Wine className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(drinks.map(d => d.category)).size}
              </div>
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

        {/* Drinks Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Drinks</CardTitle>
            <CardDescription>
              {filteredDrinks.length} drink{filteredDrinks.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type/Size</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Bottle:Shot</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrinks.map((drink) => (
                  <TableRow key={drink.id}>
                    <TableCell className="font-medium">{drink.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{drink.category}</Badge>
                    </TableCell>
                    <TableCell>{drink.type} ({drink.size})</TableCell>
                    <TableCell className="font-semibold">
                      MWK {drink.cost.toFixed(2)}
                    </TableCell>
                    <TableCell className="font-semibold">
                      MWK {drink.price.toFixed(2)}
                    </TableCell>
                    <TableCell>{drink.stock}</TableCell>
                    <TableCell>{drink.bottleToShot}:1</TableCell>
                    <TableCell>
                      <Badge
                        variant={drink.status === "In Stock" ? "default" : "destructive"}
                      >
                        {drink.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <NewDrinkModal
        open={showNewDrink}
        onOpenChange={setShowNewDrink}
      />
    </DashboardLayout>
  )
}

