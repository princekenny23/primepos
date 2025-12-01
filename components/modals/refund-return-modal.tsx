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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface RefundReturnModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RefundReturnModal({ open, onOpenChange }: RefundReturnModalProps) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<"refund" | "return">("refund")
  const [saleId, setSaleId] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const handleProcess = async () => {
    if (!saleId.trim()) {
      toast({
        title: "Sale ID Required",
        description: "Please enter a sale ID to process.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)

    // In production, this would call API
    setTimeout(() => {
      setIsProcessing(false)
      toast({
        title: activeTab === "refund" ? "Refund Processed" : "Return Processed",
        description: `${activeTab === "refund" ? "Refund" : "Return"} has been processed successfully.`,
      })
      setSaleId("")
      onOpenChange(false)
    }, 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {activeTab === "refund" ? (
              <RefreshCw className="h-5 w-5" />
            ) : (
              <ArrowLeft className="h-5 w-5" />
            )}
            {activeTab === "refund" ? "Process Refund" : "Process Return"}
          </DialogTitle>
          <DialogDescription>
            {activeTab === "refund" 
              ? "Refund a completed sale transaction"
              : "Process a product return"}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "refund" | "return")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="refund">Refund</TabsTrigger>
            <TabsTrigger value="return">Return</TabsTrigger>
          </TabsList>

          <TabsContent value="refund" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="refund-sale-id">Sale ID *</Label>
              <Input
                id="refund-sale-id"
                placeholder="Enter sale ID or scan barcode"
                value={saleId}
                onChange={(e) => setSaleId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="refund-reason">Reason</Label>
              <Select>
                <SelectTrigger id="refund-reason">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer-request">Customer Request</SelectItem>
                  <SelectItem value="defective">Defective Product</SelectItem>
                  <SelectItem value="wrong-item">Wrong Item</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="return" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="return-sale-id">Sale ID *</Label>
              <Input
                id="return-sale-id"
                placeholder="Enter sale ID or scan barcode"
                value={saleId}
                onChange={(e) => setSaleId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="return-product">Product</Label>
              <Select>
                <SelectTrigger id="return-product">
                  <SelectValue placeholder="Select product to return" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Product A</SelectItem>
                  <SelectItem value="2">Product B</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="return-quantity">Quantity</Label>
              <Input id="return-quantity" type="number" min="1" placeholder="1" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="return-reason">Reason</Label>
              <Select>
                <SelectTrigger id="return-reason">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="defective">Defective</SelectItem>
                  <SelectItem value="wrong-item">Wrong Item</SelectItem>
                  <SelectItem value="not-satisfied">Not Satisfied</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleProcess} disabled={isProcessing || !saleId.trim()}>
            {isProcessing ? "Processing..." : `Process ${activeTab === "refund" ? "Refund" : "Return"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

