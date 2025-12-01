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
import { Plus, Search, ChefHat, Edit, Trash2 } from "lucide-react"
import { useState } from "react"
import { AddEditRecipeModal } from "@/components/modals/add-edit-recipe-modal"

export default function RecipesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [showAddRecipe, setShowAddRecipe] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null)

  // Mock recipes data
  const recipes = [
    {
      id: "1",
      name: "Burger Recipe",
      menuItem: "Burger",
      portions: 4,
      ingredients: 8,
      cost: 8.50,
      lastUpdated: "2024-01-10",
    },
    {
      id: "2",
      name: "Pizza Dough",
      menuItem: "Pizza",
      portions: 2,
      ingredients: 5,
      cost: 3.25,
      lastUpdated: "2024-01-12",
    },
    {
      id: "3",
      name: "Pasta Sauce",
      menuItem: "Pasta",
      portions: 6,
      ingredients: 7,
      cost: 4.75,
      lastUpdated: "2024-01-08",
    },
    {
      id: "4",
      name: "Caesar Salad",
      menuItem: "Salad",
      portions: 1,
      ingredients: 6,
      cost: 3.50,
      lastUpdated: "2024-01-15",
    },
  ]

  const filteredRecipes = recipes.filter(recipe =>
    recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recipe.menuItem.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Recipe Management</h1>
            <p className="text-muted-foreground">Manage recipes and ingredient costs</p>
          </div>
          <Button onClick={() => {
            setSelectedRecipe(null)
            setShowAddRecipe(true)
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Recipe
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Recipes</CardTitle>
              <ChefHat className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{recipes.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Ingredients</CardTitle>
              <ChefHat className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {recipes.reduce((sum, r) => sum + r.ingredients, 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Cost</CardTitle>
              <ChefHat className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                MWK {(recipes.reduce((sum, r) => sum + r.cost, 0) / recipes.length).toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Portions</CardTitle>
              <ChefHat className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {recipes.reduce((sum, r) => sum + r.portions, 0)}
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
                placeholder="Search by recipe name or menu item..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Recipes Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Recipes</CardTitle>
            <CardDescription>
              {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipe Name</TableHead>
                  <TableHead>Menu Item</TableHead>
                  <TableHead>Portions</TableHead>
                  <TableHead>Ingredients</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecipes.map((recipe) => (
                  <TableRow key={recipe.id}>
                    <TableCell className="font-medium">{recipe.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{recipe.menuItem}</Badge>
                    </TableCell>
                    <TableCell>{recipe.portions}</TableCell>
                    <TableCell>{recipe.ingredients}</TableCell>
                    <TableCell className="font-semibold">
                      MWK {recipe.cost.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {new Date(recipe.lastUpdated).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedRecipe(recipe)
                            setShowAddRecipe(true)
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
      <AddEditRecipeModal
        open={showAddRecipe}
        onOpenChange={setShowAddRecipe}
        recipe={selectedRecipe}
      />
    </DashboardLayout>
  )
}

