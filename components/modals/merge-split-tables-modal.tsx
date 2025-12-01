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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Merge, Split } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface MergeSplitTablesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MergeSplitTablesModal({ open, onOpenChange }: MergeSplitTablesModalProps) {
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)
  const [actionType, setActionType] = useState<"merge" | "split">("merge")
  const [selectedTables, setSelectedTables] = useState<string[]>([])

  // Mock tables
  const availableTables = [
    { id: "1", number: 1, capacity: 4 },
    { id: "2", number: 2, capacity: 2 },
    { id: "3", number: 3, capacity: 6 },
    { id: "4", number: 4, capacity: 4 },
  ]

  const handleTableSelect = (tableId: string) => {
    if (actionType === "merge") {
      if (selectedTables.includes(tableId)) {
        setSelectedTables(selectedTables.filter(id => id !== tableId))
      } else {
        setSelectedTables([...selectedTables, tableId])
      }
    } else {
      setSelectedTables([tableId])
    }
  }

  const handleProcess = async () => {
    if (actionType === "merge" && selectedTables.length < 2) {
      toast({
        title: "Selection Required",
        description: "Please select at least 2 tables to merge.",
        variant: "destructive",
      })
      return
    }

    if (actionType === "split" && selectedTables.length === 0) {
      toast({
        title: "Selection Required",
        description: "Please select a table to split.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)

    // In production, this would call API
    setTimeout(() => {
      setIsProcessing(false)
      toast({
        title: actionType === "merge" ? "Tables Merged" : "Table Split",
        description: `Tables have been ${actionType === "merge" ? "merged" : "split"} successfully.`,
      })
      setSelectedTables([])
      onOpenChange(false)
    }, 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {actionType === "merge" ? (
              <Merge className="h-5 w-5" />
            ) : (
              <Split className="h-5 w-5" />
            )}
            {actionType === "merge" ? "Merge Tables" : "Split Table"}
          </DialogTitle>
          <DialogDescription>
            {actionType === "merge" 
              ? "Combine multiple tables into one order"
              : "Split a table into separate orders"}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={actionType} onValueChange={(value) => {
          setActionType(value as "merge" | "split")
          setSelectedTables([])
        }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="merge">
              <Merge className="h-4 w-4 mr-2" />
              Merge
            </TabsTrigger>
            <TabsTrigger value="split">
              <Split className="h-4 w-4 mr-2" />
              Split
            </TabsTrigger>
          </TabsList>

          <TabsContent value="merge" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Select Tables to Merge</Label>
              <div className="grid grid-cols-2 gap-2">
                {availableTables.map((table) => (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => handleTableSelect(table.id)}
                    className={`p-3 border-2 rounded-lg text-left transition-colors ${
                      selectedTables.includes(table.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="font-medium">Table {table.number}</div>
                    <div className="text-xs text-muted-foreground">
                      {table.capacity} seats
                    </div>
                  </button>
                ))}
              </div>
              {selectedTables.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedTables.length} table{selectedTables.length !== 1 ? "s" : ""} selected
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="split" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Select Table to Split</Label>
              <Select onValueChange={(value) => setSelectedTables([value])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select table" />
                </SelectTrigger>
                <SelectContent>
                  {availableTables.map((table) => (
                    <SelectItem key={table.id} value={table.id}>
                      Table {table.number} ({table.capacity} seats)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleProcess}
            disabled={isProcessing || (actionType === "merge" && selectedTables.length < 2) || (actionType === "split" && selectedTables.length === 0)}
          >
            {isProcessing ? "Processing..." : actionType === "merge" ? "Merge Tables" : "Split Table"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

