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
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { DollarSign, Plus, X } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface EditPlanModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan?: any
}

export function EditPlanModal({ open, onOpenChange, plan }: EditPlanModalProps) {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [features, setFeatures] = useState<string[]>(
    plan?.features || []
  )
  const [newFeature, setNewFeature] = useState("")

  const handleAddFeature = () => {
    if (newFeature.trim()) {
      setFeatures([...features, newFeature.trim()])
      setNewFeature("")
    }
  }

  const handleRemoveFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setIsSaving(true)

    // In production, this would call API
    setTimeout(() => {
      setIsSaving(false)
      toast({
        title: plan ? "Plan Updated" : "Plan Created",
        description: `Plan has been ${plan ? "updated" : "created"} successfully.`,
      })
      onOpenChange(false)
    }, 1000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? "Edit Plan" : "Add New Plan"}</DialogTitle>
          <DialogDescription>
            {plan ? "Update subscription plan details" : "Create a new subscription plan"}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="plan-name">Plan Name *</Label>
              <Input
                id="plan-name"
                placeholder="e.g., Starter, Professional"
                defaultValue={plan?.name}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing-cycle">Billing Cycle *</Label>
              <Select defaultValue={plan?.billingCycle || "Monthly"} required>
                <SelectTrigger id="billing-cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Yearly">Yearly</SelectItem>
                  <SelectItem value="14 days">14 days (Trial)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Price *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">MWK</span>
              <Input
                id="price"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="pl-7"
                defaultValue={plan?.price}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Features *</Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Add feature..."
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddFeature()
                    }
                  }}
                />
                <Button type="button" onClick={handleAddFeature} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 border rounded-lg">
                    <span className="flex-1 text-sm">{feature}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleRemoveFeature(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Plan description..."
              className="min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || features.length === 0}>
            {isSaving ? "Saving..." : plan ? "Update Plan" : "Create Plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

