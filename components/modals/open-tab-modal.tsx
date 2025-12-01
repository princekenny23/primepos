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
import { CreditCard, User } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface OpenTabModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OpenTabModal({ open, onOpenChange }: OpenTabModalProps) {
  const { toast } = useToast()
  const [isOpening, setIsOpening] = useState(false)
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [bartender, setBartender] = useState("")

  const handleOpenTab = async () => {
    if (!customerName.trim()) {
      toast({
        title: "Customer Name Required",
        description: "Please enter customer name.",
        variant: "destructive",
      })
      return
    }

    setIsOpening(true)

    // In production, this would call API
    setTimeout(() => {
      setIsOpening(false)
      toast({
        title: "Tab Opened",
        description: "Tab has been opened successfully.",
      })
      setCustomerName("")
      setCustomerPhone("")
      setBartender("")
      onOpenChange(false)
    }, 1000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Open Tab
          </DialogTitle>
          <DialogDescription>
            Open a new tab for a customer
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="customer-name">Customer Name *</Label>
            <Input
              id="customer-name"
              placeholder="Enter customer name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-phone">Phone Number</Label>
            <Input
              id="customer-phone"
              type="tel"
              placeholder="Enter phone number"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bartender">Bartender</Label>
            <Select value={bartender} onValueChange={setBartender}>
              <SelectTrigger id="bartender">
                <SelectValue placeholder="Select bartender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="jane">Jane Bartender</SelectItem>
                <SelectItem value="john">John Waiter</SelectItem>
                <SelectItem value="bob">Bob Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              The customer can order drinks and pay at the end. The tab will remain open until closed.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleOpenTab} disabled={isOpening || !customerName.trim()}>
            {isOpening ? "Opening..." : "Open Tab"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

