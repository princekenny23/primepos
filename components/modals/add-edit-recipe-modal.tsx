"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, X, ChefHat } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface AddEditRecipeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipe?: any
}

interface Ingredient {
  id: string
  name: string
  quantity: string
  unit: string
  cost: string
}

export function AddEditRecipeModal({ open, onOpenChange, recipe }: AddEditRecipeModalProps) {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    recipe?.ingredients || []
  )
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    quantity: "",
    unit: "g",
    cost: "",
  })

  const handleAddIngredient = () => {
    if (!newIngredient.name || !newIngredient.quantity) {
      toast({
        title: "Required Fields",
        description: "Please enter ingredient name and quantity.",
        variant: "destructive",
      })
      return
    }

    setIngredients([
      ...ingredients,
      {
        id: Date.now().toString(),
        ...newIngredient,
      },
    ])
    setNewIngredient({ name: "", quantity: "", unit: "g", cost: "" })
  }

  const handleRemoveIngredient = (id: string) => {
    setIngredients(ingredients.filter(ing => ing.id !== id))
  }

  const totalCost = ingredients.reduce(
    (sum, ing) => sum + (parseFloat(ing.cost) || 0),
    0
  )

  const handleSave = async () => {
    if (ingredients.length === 0) {
      toast({
        title: "Ingredients Required",
        description: "Please add at least one ingredient to the recipe.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)

    // In production, this would call API
    setTimeout(() => {
      setIsSaving(false)
      toast({
        title: recipe ? "Recipe Updated" : "Recipe Created",
        description: `Recipe has been ${recipe ? "updated" : "created"} successfully.`,
      })
      onOpenChange(false)
    }, 1000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5" />
            {recipe ? "Edit Recipe" : "Add Recipe"}
          </DialogTitle>
          <DialogDescription>
            {recipe ? "Update recipe information" : "Create a new recipe"}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recipe-name">Recipe Name *</Label>
              <Input
                id="recipe-name"
                placeholder="e.g., Burger Recipe, Pizza Dough"
                defaultValue={recipe?.name}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="menu-item">Menu Item *</Label>
              <Select defaultValue={recipe?.menuItem} required>
                <SelectTrigger id="menu-item">
                  <SelectValue placeholder="Select menu item" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="burger">Burger</SelectItem>
                  <SelectItem value="pizza">Pizza</SelectItem>
                  <SelectItem value="pasta">Pasta</SelectItem>
                  <SelectItem value="salad">Salad</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="portions">Number of Portions *</Label>
            <Input
              id="portions"
              type="number"
              min="1"
              placeholder="e.g., 4"
              defaultValue={recipe?.portions}
              required
            />
          </div>

          {/* Ingredients */}
          <div className="space-y-2">
            <Label>Ingredients *</Label>
            <div className="border rounded-lg p-3 space-y-3">
              <div className="grid gap-2 md:grid-cols-5">
                <Input
                  placeholder="Ingredient name"
                  value={newIngredient.name}
                  onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                />
                <Input
                  placeholder="Quantity"
                  type="number"
                  value={newIngredient.quantity}
                  onChange={(e) => setNewIngredient({ ...newIngredient, quantity: e.target.value })}
                />
                <Select
                  value={newIngredient.unit}
                  onValueChange={(value) => setNewIngredient({ ...newIngredient, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="g">g</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="L">L</SelectItem>
                    <SelectItem value="pcs">pcs</SelectItem>
                    <SelectItem value="cups">cups</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Cost"
                  type="number"
                  step="0.01"
                  value={newIngredient.cost}
                  onChange={(e) => setNewIngredient({ ...newIngredient, cost: e.target.value })}
                />
                <Button type="button" onClick={handleAddIngredient} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {ingredients.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingredient</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ingredients.map((ing) => (
                      <TableRow key={ing.id}>
                        <TableCell className="font-medium">{ing.name}</TableCell>
                        <TableCell>{ing.quantity}</TableCell>
                        <TableCell>{ing.unit}</TableCell>
                        <TableCell>${parseFloat(ing.cost || "0").toFixed(2)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleRemoveIngredient(ing.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {ingredients.length > 0 && (
                <div className="pt-2 border-t">
                  <div className="flex justify-between font-semibold">
                    <span>Total Cost:</span>
                    <span>${totalCost.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || ingredients.length === 0}>
            {isSaving ? "Saving..." : recipe ? "Update Recipe" : "Create Recipe"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

