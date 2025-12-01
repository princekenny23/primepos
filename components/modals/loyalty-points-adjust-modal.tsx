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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Award, Plus, Minus } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface LoyaltyPointsAdjustModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: any
}

export function LoyaltyPointsAdjustModal({ open, onOpenChange, customer }: LoyaltyPointsAdjustModalProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [adjustmentType, setAdjustmentType] = useState<"add" | "subtract" | "set">("add")
  const [points, setPoints] = useState<string>("")

  if (!customer) return null

  const currentPoints = customer.points || 0
  const newPoints = adjustmentType === "add"
    ? currentPoints + parseInt(points || "0")
    : adjustmentType === "subtract"
    ? currentPoints - parseInt(points || "0")
    : parseInt(points || "0")

  const handleAdjust = async () => {
    if (!points || parseInt(points) <= 0) {
      toast({
        title: "Invalid Points",
        description: "Please enter a valid number of points.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    // In production, this would call API
    setTimeout(() => {
      setIsLoading(false)
      toast({
        title: "Points Adjusted",
        description: `Loyalty points have been ${adjustmentType === "add" ? "added" : adjustmentType === "subtract" ? "subtracted" : "set"} successfully.`,
      })
      setPoints("")
      onOpenChange(false)
    }, 1000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Adjust Loyalty Points
          </DialogTitle>
          <DialogDescription>
            Adjust loyalty points for {customer.name}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Current Points</p>
            <p className="text-2xl font-bold">{currentPoints.toLocaleString()}</p>
          </div>

          <Tabs value={adjustmentType} onValueChange={(value) => {
            setAdjustmentType(value as "add" | "subtract" | "set")
            setPoints("")
          }}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="add">
                <Plus className="h-4 w-4 mr-2" />
                Add
              </TabsTrigger>
              <TabsTrigger value="subtract">
                <Minus className="h-4 w-4 mr-2" />
                Subtract
              </TabsTrigger>
              <TabsTrigger value="set">Set</TabsTrigger>
            </TabsList>

            <TabsContent value="add" className="space-y-2 mt-4">
              <Label htmlFor="add-points">Points to Add</Label>
              <Input
                id="add-points"
                type="number"
                min="1"
                placeholder="0"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
              {points && (
                <p className="text-sm text-muted-foreground">
                  New total: {newPoints.toLocaleString()} points
                </p>
              )}
            </TabsContent>

            <TabsContent value="subtract" className="space-y-2 mt-4">
              <Label htmlFor="subtract-points">Points to Subtract</Label>
              <Input
                id="subtract-points"
                type="number"
                min="1"
                max={currentPoints}
                placeholder="0"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
              {points && (
                <p className="text-sm text-muted-foreground">
                  New total: {Math.max(0, newPoints).toLocaleString()} points
                </p>
              )}
            </TabsContent>

            <TabsContent value="set" className="space-y-2 mt-4">
              <Label htmlFor="set-points">Set Points To</Label>
              <Input
                id="set-points"
                type="number"
                min="0"
                placeholder="0"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
              {points && (
                <p className="text-sm text-muted-foreground">
                  Points will be set to: {newPoints.toLocaleString()}
                </p>
              )}
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              placeholder="Optional reason for adjustment"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdjust}
            disabled={isLoading || !points || parseInt(points) <= 0 || (adjustmentType === "subtract" && parseInt(points) > currentPoints)}
          >
            {isLoading ? "Processing..." : `Apply ${adjustmentType === "add" ? "Addition" : adjustmentType === "subtract" ? "Subtraction" : "Set"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

