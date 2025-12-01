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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Clock, Search } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface HoldRecallSaleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HoldRecallSaleModal({ open, onOpenChange }: HoldRecallSaleModalProps) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<"hold" | "recall">("hold")
  const [holdName, setHoldName] = useState("")

  // Mock held sales
  const heldSales = [
    { id: "1", name: "Sale #1001", date: "2024-01-15 10:30", total: 125.50, items: 3 },
    { id: "2", name: "Sale #1002", date: "2024-01-15 11:15", total: 89.99, items: 2 },
  ]

  const handleHold = () => {
    if (!holdName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for this held sale.",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Sale Held",
      description: "Sale has been held successfully.",
    })
    setHoldName("")
    onOpenChange(false)
  }

  const handleRecall = (saleId: string) => {
    toast({
      title: "Sale Recalled",
      description: "Sale has been recalled to cart.",
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Hold / Recall Sale
          </DialogTitle>
          <DialogDescription>
            Hold current sale or recall a previously held sale
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "hold" | "recall")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="hold">Hold Sale</TabsTrigger>
            <TabsTrigger value="recall">Recall Sale</TabsTrigger>
          </TabsList>

          <TabsContent value="hold" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="hold-name">Sale Name / Reference</Label>
              <Input
                id="hold-name"
                placeholder="e.g., Customer Name, Table #5"
                value={holdName}
                onChange={(e) => setHoldName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter a name or reference to identify this held sale
              </p>
            </div>
            <DialogFooter className="sm:justify-start">
              <Button onClick={handleHold}>Hold Sale</Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="recall" className="space-y-4 mt-4">
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search held sales..." className="pl-10" />
              </div>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {heldSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium">{sale.name}</TableCell>
                      <TableCell>{new Date(sale.date).toLocaleString()}</TableCell>
                      <TableCell>{sale.items}</TableCell>
                      <TableCell>${sale.total.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => handleRecall(sale.id)}>
                          Recall
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

