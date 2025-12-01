"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Printer } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface KitchenOrderTicketModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: any
}

export function KitchenOrderTicketModal({ open, onOpenChange, order }: KitchenOrderTicketModalProps) {
  const { toast } = useToast()

  if (!order) return null

  const handlePrint = () => {
    // In production, this would trigger print
    toast({
      title: "Printing KOT",
      description: "Kitchen Order Ticket is being sent to printer...",
    })
    setTimeout(() => {
      onOpenChange(false)
    }, 1000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kitchen Order Ticket (KOT)</DialogTitle>
          <DialogDescription>
            Print preview for {order.orderId}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 text-sm p-4 border rounded-lg bg-white">
          <div className="text-center border-b pb-2">
            <p className="font-bold text-lg">KITCHEN ORDER TICKET</p>
            <p className="text-xs text-muted-foreground">{order.orderId}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Table {order.table} • {order.time}
            </p>
          </div>

          <div className="space-y-2 border-b pb-2">
            {order.items.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between">
                <div className="flex-1">
                  <p className="font-medium">
                    {item.quantity}x {item.name}
                  </p>
                  {item.notes && (
                    <p className="text-xs text-muted-foreground italic">
                      Note: {item.notes}
                    </p>
                  )}
                </div>
                <Badge variant={item.status === "Ready" ? "default" : "outline"}>
                  {item.status}
                </Badge>
              </div>
            ))}
          </div>

          <div className="text-center text-xs text-muted-foreground pt-2 border-t">
            <p>Thank you!</p>
            <p className="mt-1">{new Date().toLocaleString()}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print KOT
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

