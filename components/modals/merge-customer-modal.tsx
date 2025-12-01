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
import { Merge, Search, AlertTriangle } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface MergeCustomerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: any
}

export function MergeCustomerModal({ open, onOpenChange, customer }: MergeCustomerModalProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<string>("")

  if (!customer) return null

  // Mock customers for merge selection
  const mergeCandidates = [
    { id: "2", name: "Jane Smith", email: "jane@example.com", phone: "+1 (555) 222-2222" },
    { id: "3", name: "Bob Johnson", email: "bob@example.com", phone: "+1 (555) 333-3333" },
  ]

  const filteredCandidates = mergeCandidates.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  )

  const handleMerge = async () => {
    if (!selectedCustomer) {
      toast({
        title: "Customer Required",
        description: "Please select a customer to merge with.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    // In production, this would call API
    setTimeout(() => {
      setIsLoading(false)
      toast({
        title: "Customers Merged",
        description: "Customer records have been merged successfully.",
      })
      setSelectedCustomer("")
      setSearchTerm("")
      onOpenChange(false)
    }, 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Merge Customer
          </DialogTitle>
          <DialogDescription>
            Merge duplicate customer records into one
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              Merging customers will combine all transactions, loyalty points, and history. This action cannot be undone.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Primary Customer (Keep)</Label>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{customer.name}</p>
              <p className="text-sm text-muted-foreground">{customer.email}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="merge-search">Search Customer to Merge</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="merge-search"
                placeholder="Search by name, email, or phone..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Select Customer to Merge Into Primary</Label>
            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {filteredCandidates.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    <div>
                      <p className="font-medium">{candidate.name}</p>
                      <p className="text-xs text-muted-foreground">{candidate.email} • {candidate.phone}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCustomer && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                After merging, all data from the selected customer will be transferred to {customer.name}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            disabled={isLoading || !selectedCustomer}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isLoading ? "Merging..." : "Merge Customers"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

