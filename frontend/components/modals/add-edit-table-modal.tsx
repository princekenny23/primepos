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
import { tableService, Table } from "@/lib/services/tableService"
import { useBusinessStore } from "@/stores/businessStore"
import { useRealAPI } from "@/lib/utils/api-config"

interface AddEditTableModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  table?: Table | null
  onSuccess?: () => void
}

export function AddEditTableModal({ open, onOpenChange, table, onSuccess }: AddEditTableModalProps) {
  const { toast } = useToast()
  const { currentOutlet, outlets } = useBusinessStore()
  const useReal = useRealAPI()
  const [isLoading, setIsLoading] = useState(false)
  const [tableNumber, setTableNumber] = useState<string>("")
  const [capacity, setCapacity] = useState<string>("2")
  const [status, setStatus] = useState<string>("available")
  const [location, setLocation] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [selectedOutlet, setSelectedOutlet] = useState<string>("")

  useEffect(() => {
    if (table) {
      setTableNumber(table.number || "")
      setCapacity(String(table.capacity || 2))
      setStatus(table.status || "available")
      setLocation(table.location || "")
      setNotes(table.notes || "")
      setSelectedOutlet(typeof table.outlet === 'object' ? table.outlet?.id || "" : table.outlet || "")
    } else {
      setTableNumber("")
      setCapacity("2")
      setStatus("available")
      setLocation("")
      setNotes("")
      setSelectedOutlet(currentOutlet?.id || "")
    }
  }, [table, currentOutlet, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (!tableNumber.trim()) {
        toast({
          title: "Error",
          description: "Please enter a table number",
          variant: "destructive",
        })
        setIsLoading(false)
        return
      }

      // Use current outlet if available, otherwise use selected outlet
      const outletId = currentOutlet?.id || (selectedOutlet && selectedOutlet !== "none" ? selectedOutlet : null)

      const data: any = {
        number: tableNumber.trim(),
        capacity: parseInt(capacity) || 2,
        status: status as 'available' | 'occupied' | 'reserved' | 'out_of_service',
        location: location || '',
        notes: notes || '',
      }
      
      // Only include outlet_id if an outlet is available
      if (outletId) {
        data.outlet_id = typeof outletId === 'string' ? parseInt(outletId) : outletId
      }

      if (useReal) {
        if (table) {
          await tableService.update(table.id, data)
          toast({
            title: "Table Updated",
            description: "Table has been updated successfully.",
          })
        } else {
          await tableService.create(data)
          toast({
            title: "Table Created",
            description: "Table has been created successfully.",
          })
        }
      } else {
        // Simulation mode - still show success but warn user
        console.warn("Real API not enabled. Table not saved to database.")
        await new Promise(resolve => setTimeout(resolve, 1000))
        toast({
          title: "Simulation Mode",
          description: "Table creation simulated. Enable real API to save to database.",
          variant: "default",
        })
      }

      if (onSuccess) {
        onSuccess()
      }
      onOpenChange(false)
    } catch (error: any) {
      console.error("Error saving table:", error)
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          `Failed to ${table ? "update" : "create"} table. Please try again.`
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{table ? "Edit Table" : "Add New Table"}</DialogTitle>
          <DialogDescription>
            {table ? "Update table information" : "Create a new table"}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 py-4 md:grid-cols-2">
            {!currentOutlet && (
              <div className="space-y-2">
                <Label htmlFor="outlet">Outlet</Label>
                <Select value={selectedOutlet || "none"} onValueChange={(value) => setSelectedOutlet(value === "none" ? "" : value)}>
                  <SelectTrigger id="outlet">
                    <SelectValue placeholder="Select outlet (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Outlet</SelectItem>
                    {outlets.filter(o => o.isActive).map(outlet => (
                      <SelectItem key={outlet.id} value={outlet.id}>
                        {outlet.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Optional: Assign table to a specific outlet
                </p>
              </div>
            )}

            {currentOutlet && (
              <div className="space-y-2">
                <Label>Outlet</Label>
                <div className="text-sm text-muted-foreground bg-muted p-2 rounded-md">
                  {currentOutlet.name}
                </div>
                <p className="text-xs text-muted-foreground">
                  Table will be assigned to this outlet
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="table-number">Table Number *</Label>
              <Input
                id="table-number"
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity (Seats) *</Label>
              <Input
                id="capacity"
                type="number"
                min="1"
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
                placeholder="e.g., Main Dining, Patio, VIP"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Additional notes about this table"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : table ? "Update Table" : "Create Table"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
