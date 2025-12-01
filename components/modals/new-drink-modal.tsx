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
import { Wine } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface NewDrinkModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewDrinkModal({ open, onOpenChange }: NewDrinkModalProps) {
  const { toast } = useToast()
  const [isCreating, setIsCreating] = useState(false)
  const [drinkType, setDrinkType] = useState<"bottle" | "single">("bottle")

  const handleCreate = async () => {
    setIsCreating(true)

    // In production, this would call API
    setTimeout(() => {
      setIsCreating(false)
      toast({
        title: "Drink Created",
        description: "Drink has been added to inventory successfully.",
      })
      onOpenChange(false)
    }, 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wine className="h-5 w-5" />
            New Drink
          </DialogTitle>
          <DialogDescription>
            Add a new drink to your bar inventory
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="drink-name">Drink Name *</Label>
              <Input id="drink-name" placeholder="e.g., Vodka, Whiskey" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select required>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spirits">Spirits</SelectItem>
                  <SelectItem value="beer">Beer</SelectItem>
                  <SelectItem value="wine">Wine</SelectItem>
                  <SelectItem value="cocktails">Cocktails</SelectItem>
                  <SelectItem value="mixers">Mixers</SelectItem>
                  <SelectItem value="non-alcoholic">Non-Alcoholic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="drink-type">Drink Type *</Label>
            <Select value={drinkType} onValueChange={(value) => setDrinkType(value as "bottle" | "single")} required>
              <SelectTrigger id="drink-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bottle">Bottle</SelectItem>
                <SelectItem value="single">Single Serve</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="size">Size *</Label>
              <Select required>
                <SelectTrigger id="size">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="250ml">250ml</SelectItem>
                  <SelectItem value="330ml">330ml</SelectItem>
                  <SelectItem value="500ml">500ml</SelectItem>
                  <SelectItem value="750ml">750ml</SelectItem>
                  <SelectItem value="1L">1L</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {drinkType === "bottle" && (
              <div className="space-y-2">
                <Label htmlFor="bottle-to-shot">Bottle to Shot Ratio *</Label>
                <Input
                  id="bottle-to-shot"
                  type="number"
                  min="1"
                  placeholder="e.g., 16 (for 750ml bottle = 16 shots)"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Number of shots per bottle (typically 16 for 750ml)
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cost">Cost per Bottle/Unit *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-7"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Selling Price per Shot/Unit *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-7"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="initial-stock">Initial Stock</Label>
            <Input
              id="initial-stock"
              type="number"
              min="0"
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Additional notes about this drink"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Drink"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

