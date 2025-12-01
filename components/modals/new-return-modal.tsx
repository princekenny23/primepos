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
import { ArrowLeft, Search } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface NewReturnModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewReturnModal({ open, onOpenChange }: NewReturnModalProps) {
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)
  const [saleId, setSaleId] = useState("")
  const [selectedSale, setSelectedSale] = useState<any>(null)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [reason, setReason] = useState("")

  // Mock sale data
  const sales = [
    {
      id: "1",
      saleId: "#1001",
      date: "2024-01-15",
      customer: "John Doe",
      total: 125.50,
      items: [
        { id: "item-1", name: "Product A", quantity: 2, price: 29.99, total: 59.98 },
        { id: "item-2", name: "Product B", quantity: 1, price: 49.99, total: 49.99 },
        { id: "item-3", name: "Product C", quantity: 1, price: 15.53, total: 15.53 },
      ],
    },
    {
      id: "2",
      saleId: "#1002",
      date: "2024-01-14",
      customer: "Jane Smith",
      total: 89.99,
      items: [
        { id: "item-4", name: "Product D", quantity: 1, price: 89.99, total: 89.99 },
      ],
    },
  ]

  const handleSearchSale = () => {
    const sale = sales.find(s => s.saleId === saleId)
    if (sale) {
      setSelectedSale(sale)
    } else {
      toast({
        title: "Sale Not Found",
        description: "Please enter a valid sale ID.",
        variant: "destructive",
      })
    }
  }

  const handleToggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedItems(newSelected)
  }

  const handleProcessReturn = async () => {
    if (!selectedSale || selectedItems.size === 0) {
      toast({
        title: "Selection Required",
        description: "Please select a sale and at least one item to return.",
        variant: "destructive",
      })
      return
    }

    if (!reason) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for the return.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)

    // In production, this would call API
    setTimeout(() => {
      setIsProcessing(false)
      toast({
        title: "Return Processed",
        description: "Return has been processed successfully.",
      })
      setSaleId("")
      setSelectedSale(null)
      setSelectedItems(new Set())
      setReason("")
      onOpenChange(false)
    }, 1500)
  }

  const returnTotal = selectedSale
    ? selectedSale.items
        .filter((item: any) => selectedItems.has(item.id))
        .reduce((sum: number, item: any) => sum + item.total, 0)
    : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeft className="h-5 w-5" />
            New Return
          </DialogTitle>
          <DialogDescription>
            Process a product return by selecting the original sale
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Sale Search */}
          <div className="space-y-2">
            <Label htmlFor="sale-id">Sale ID *</Label>
            <div className="flex gap-2">
              <Input
                id="sale-id"
                placeholder="Enter sale ID (e.g., #1001)"
                value={saleId}
                onChange={(e) => setSaleId(e.target.value)}
              />
              <Button onClick={handleSearchSale}>
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
            </div>
          </div>

          {/* Sale Details */}
          {selectedSale && (
            <>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Sale Details</p>
                <p className="font-medium">{selectedSale.saleId}</p>
                <p className="text-sm text-muted-foreground">
                  Customer: {selectedSale.customer} • Date: {new Date(selectedSale.date).toLocaleDateString()}
                </p>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <Label>Select Items to Return</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSale.items.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.id)}
                            onChange={() => handleToggleItem(item.id)}
                            className="h-4 w-4"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>${item.price.toFixed(2)}</TableCell>
                        <TableCell className="font-semibold">
                          ${item.total.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {selectedItems.size > 0 && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Return Total: ${returnTotal.toFixed(2)}
                  </p>
                </div>
              )}

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="reason">Return Reason *</Label>
                <Select value={reason} onValueChange={setReason} required>
                  <SelectTrigger id="reason">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="defective">Defective Product</SelectItem>
                    <SelectItem value="wrong-item">Wrong Item</SelectItem>
                    <SelectItem value="not-satisfied">Not Satisfied</SelectItem>
                    <SelectItem value="customer-request">Customer Request</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleProcessReturn}
            disabled={isProcessing || !selectedSale || selectedItems.size === 0 || !reason}
          >
            {isProcessing ? "Processing..." : "Process Return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

