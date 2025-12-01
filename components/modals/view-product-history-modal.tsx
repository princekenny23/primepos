"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { History } from "lucide-react"

interface ViewProductHistoryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  productName: string
}

export function ViewProductHistoryModal({ 
  open, 
  onOpenChange, 
  productId, 
  productName 
}: ViewProductHistoryModalProps) {
  // Mock history data
  const history = [
    { date: "2024-01-15", type: "Sale", quantity: -2, balance: 45, user: "John Doe", reference: "#1001" },
    { date: "2024-01-14", type: "Purchase", quantity: 50, balance: 47, user: "Jane Smith", reference: "PO-001" },
    { date: "2024-01-13", type: "Adjustment", quantity: -3, balance: -3, user: "Admin", reference: "ADJ-001" },
    { date: "2024-01-12", type: "Transfer In", quantity: 10, balance: 0, user: "System", reference: "TRF-001" },
    { date: "2024-01-11", type: "Transfer Out", quantity: -5, balance: -10, user: "System", reference: "TRF-002" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Product History - {productName}
          </DialogTitle>
          <DialogDescription>
            Complete transaction history for this product
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>User</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((entry, index) => (
                <TableRow key={index}>
                  <TableCell>{new Date(entry.date).toLocaleString()}</TableCell>
                  <TableCell>{entry.type}</TableCell>
                  <TableCell>{entry.reference}</TableCell>
                  <TableCell className={entry.quantity > 0 ? "text-green-600" : "text-red-600"}>
                    {entry.quantity > 0 ? "+" : ""}{entry.quantity}
                  </TableCell>
                  <TableCell>{entry.balance}</TableCell>
                  <TableCell>{entry.user}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

