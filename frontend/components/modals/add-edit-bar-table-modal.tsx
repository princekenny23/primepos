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
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { tabService, type BarTable } from "@/lib/services/barTabService"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"

interface AddEditBarTableModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  table?: BarTable | null
  onSuccess?: () => void
}

export function AddEditBarTableModal({ 
  open, 
  onOpenChange, 
  table, 
  onSuccess 
}: AddEditBarTableModalProps) {
  const { toast } = useToast()
  const { currentOutlet } = useBusinessStore()
  const { currentOutlet: tenantOutlet } = useTenant()
  const outlet = tenantOutlet || currentOutlet
  
  const [isLoading, setIsLoading] = useState(false)
  const [tableNumber, setTableNumber] = useState("")
  const [capacity, setCapacity] = useState("4")
  const [status, setStatus] = useState("available")
  const [location, setLocation] = useState("")

  const isEditing = !!table

  useEffect(() => {
    if (table) {
      setTableNumber(table.number || "")
      setCapacity(String(table.capacity || 4))
      setStatus(table.status || "available")
      setLocation(table.location || "")
    } else {
      setTableNumber("")
      setCapacity("4")
      setStatus("available")
      setLocation("")
    }
  }, [table, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!tableNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter a table number",
        variant: "destructive",
      })
      return
    }

    if (!outlet) {
      toast({
        title: "Error",
        description: "No outlet selected. Please select an outlet first.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const data: Partial<BarTable> = {
        number: tableNumber.trim(),
        table_type: "table",
        capacity: parseInt(capacity) || 4,
        status: status as BarTable["status"],
        location: location || undefined,
        is_active: true,
        outlet: outlet.id,
      }

      if (isEditing && table) {
        await tabService.updateTable(table.id, data)
        toast({
          title: "Table Updated",
          description: `Table ${tableNumber} has been updated.`,
        })
      } else {
        await tabService.createTable(data)
        toast({
          title: "Table Created",
          description: `Table ${tableNumber} has been added.`,
        })
      }

      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      console.error("Failed to save table:", error)
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEditing ? 'update' : 'create'} table`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Table" : "Add New Table"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update table information" : "Create a new table for your bar"}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="table-number">Table Number *</Label>
              <Input
                id="table-number"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="e.g., 1, VIP-1, Patio-A"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity (Seats) *</Label>
              <Input
                id="capacity"
                type="number"
                min="1"
                max="20"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="occupied">Occupied</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                  <SelectItem value="out_of_service">Out of Service</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location/Area</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Main Bar, Patio, VIP Section"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : isEditing ? "Update Table" : "Create Table"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
