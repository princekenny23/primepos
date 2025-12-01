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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Percent, DollarSign } from "lucide-react"
import { format } from "date-fns"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

interface CreateDiscountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateDiscountModal({ open, onOpenChange }: CreateDiscountModalProps) {
  const { toast } = useToast()
  const [isCreating, setIsCreating] = useState(false)
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage")
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [value, setValue] = useState("")
  const [minPurchase, setMinPurchase] = useState("")
  const [maxDiscount, setMaxDiscount] = useState("")
  const [usageLimit, setUsageLimit] = useState("")
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()

  const handleCreate = async () => {
    if (!code || !name || !value || !startDate || !endDate) {
      toast({
        title: "Required Fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    setIsCreating(true)

    // In production, this would call API
    setTimeout(() => {
      setIsCreating(false)
      toast({
        title: "Discount Created",
        description: "Discount code has been created successfully.",
      })
      setCode("")
      setName("")
      setValue("")
      setMinPurchase("")
      setMaxDiscount("")
      setUsageLimit("")
      setStartDate(undefined)
      setEndDate(undefined)
      onOpenChange(false)
    }, 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Discount</DialogTitle>
          <DialogDescription>
            Create a new discount code or promotional offer
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="code">Discount Code *</Label>
              <Input
                id="code"
                placeholder="e.g., SAVE20"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Discount Name *</Label>
              <Input
                id="name"
                placeholder="e.g., 20% Off Sale"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <Tabs value={discountType} onValueChange={(value) => setDiscountType(value as "percentage" | "fixed")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="percentage">
                <Percent className="h-4 w-4 mr-2" />
                Percentage
              </TabsTrigger>
              <TabsTrigger value="fixed">
                <DollarSign className="h-4 w-4 mr-2" />
                Fixed Amount
              </TabsTrigger>
            </TabsList>

            <TabsContent value="percentage" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="percentage-value">Discount Percentage *</Label>
                <div className="relative">
                  <Input
                    id="percentage-value"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="20"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    required
                  />
                  <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="fixed" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="fixed-value">Discount Amount *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="fixed-value"
                    type="number"
                    step="0.01"
                    placeholder="10.00"
                    className="pl-7"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    required
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="min-purchase">Minimum Purchase</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="min-purchase"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-7"
                  value={minPurchase}
                  onChange={(e) => setMinPurchase(e.target.value)}
                />
              </div>
            </div>

            {discountType === "percentage" && (
              <div className="space-y-2">
                <Label htmlFor="max-discount">Maximum Discount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="max-discount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="pl-7"
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="usage-limit">Usage Limit</Label>
            <Input
              id="usage-limit"
              type="number"
              min="0"
              placeholder="0 for unlimited"
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty or set to 0 for unlimited usage
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Expiry Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Discount"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

