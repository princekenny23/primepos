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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeftRight } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface TransferTableModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TransferTableModal({ open, onOpenChange }: TransferTableModalProps) {
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)
  const [fromTable, setFromTable] = useState<string>("")
  const [toTable, setToTable] = useState<string>("")

  // Mock tables
  const availableTables = [
    { id: "1", number: 1, capacity: 4, status: "Occupied" },
    { id: "2", number: 2, capacity: 2, status: "Available" },
    { id: "3", number: 3, capacity: 6, status: "Occupied" },
    { id: "4", number: 4, capacity: 4, status: "Available" },
  ]

  const handleTransfer = async () => {
    if (!fromTable || !toTable) {
      toast({
        title: "Selection Required",
        description: "Please select both source and destination tables.",
        variant: "destructive",
      })
      return
    }

    if (fromTable === toTable) {
      toast({
        title: "Invalid Selection",
        description: "Source and destination tables must be different.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)

    // In production, this would call API
    setTimeout(() => {
      setIsProcessing(false)
      toast({
        title: "Table Transferred",
        description: "Order has been transferred successfully.",
      })
      setFromTable("")
      setToTable("")
      onOpenChange(false)
    }, 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Transfer Table
          </DialogTitle>
          <DialogDescription>
            Transfer an order from one table to another
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="from-table">From Table *</Label>
            <Select value={fromTable} onValueChange={setFromTable} required>
              <SelectTrigger id="from-table">
                <SelectValue placeholder="Select source table" />
              </SelectTrigger>
              <SelectContent>
                {availableTables
                  .filter(t => t.status === "Occupied")
                  .map((table) => (
                    <SelectItem key={table.id} value={table.id}>
                      Table {table.number} ({table.capacity} seats)
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="to-table">To Table *</Label>
            <Select value={toTable} onValueChange={setToTable} required>
              <SelectTrigger id="to-table">
                <SelectValue placeholder="Select destination table" />
              </SelectTrigger>
              <SelectContent>
                {availableTables
                  .filter(t => t.id !== fromTable)
                  .map((table) => (
                    <SelectItem key={table.id} value={table.id}>
                      Table {table.number} ({table.capacity} seats)
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              All items and orders from the source table will be transferred to the destination table.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={isProcessing || !fromTable || !toTable || fromTable === toTable}
          >
            {isProcessing ? "Transferring..." : "Transfer Table"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

