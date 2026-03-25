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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CreditCard, Check } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { tabService, type CloseTabData, type Tab, type TabListItem } from "@/lib/services/barTabService"
import { useBusinessStore } from "@/stores/businessStore"

interface CloseTabModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tab: TabListItem | null
  onTabClosed?: () => void
}

export function CloseTabModal({ open, onOpenChange, tab, onTabClosed }: CloseTabModalProps) {
  const { toast } = useToast()
  const { currentBusiness } = useBusinessStore()
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoadingTab, setIsLoadingTab] = useState(false)
  const [tabDetails, setTabDetails] = useState<Tab | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<string>("cash")
  const [amount, setAmount] = useState<string>("")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (!open || !tab?.id) {
      setTabDetails(null)
      return
    }

    let isMounted = true

    const loadTab = async () => {
      setIsLoadingTab(true)
      try {
        const response = await tabService.get(tab.id)
        if (isMounted) {
          setTabDetails(response)
        }
      } catch (error: any) {
        if (isMounted) {
          setTabDetails(null)
          toast({
            title: "Failed to Load Tab",
            description: error?.data?.detail || error?.message || "Could not load the selected tab.",
            variant: "destructive",
          })
          onOpenChange(false)
        }
      } finally {
        if (isMounted) {
          setIsLoadingTab(false)
        }
      }
    }

    void loadTab()

    return () => {
      isMounted = false
    }
  }, [open, tab?.id, onOpenChange, toast])

  const activeItems = useMemo(() => {
    return (tabDetails?.items || []).filter((item) => !item.is_voided)
  }, [tabDetails])

  const subtotal = Number(tabDetails?.subtotal || 0)
  const tax = Number(tabDetails?.tax || 0)
  const total = Number(tabDetails?.total || 0)
  const change = parseFloat(amount || "0") - total

  const handleCloseTab = async () => {
    if (!tabDetails?.id) {
      return
    }

    if (!paymentMethod) {
      toast({
        title: "Payment Method Required",
        description: "Please select a payment method.",
        variant: "destructive",
      })
      return
    }

    if (paymentMethod === "cash" && (!amount || parseFloat(amount) < total)) {
      toast({
        title: "Insufficient Amount",
        description: "Please enter an amount greater than or equal to the total.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)

    try {
      const payload: CloseTabData = {
        payment_method: paymentMethod as CloseTabData["payment_method"],
        notes: notes.trim(),
      }

      if (paymentMethod === "cash") {
        payload.cash_received = parseFloat(amount)
      }

      const response = await tabService.close(tabDetails.id, payload)

      setIsProcessing(false)
      toast({
        title: "Tab Closed",
        description: `Tab ${response.tab.tab_number} closed. Receipt ${response.sale.receipt_number} created.`,
      })
      setPaymentMethod("cash")
      setAmount("")
      setNotes("")
      setTabDetails(null)
      onOpenChange(false)
      onTabClosed?.()
    } catch (error: any) {
      setIsProcessing(false)
      toast({
        title: "Close Tab Failed",
        description: error?.data?.error || error?.data?.detail || error?.message || "Failed to close the tab.",
        variant: "destructive",
      })
    }
  }

  if (!tab) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Close Tab - {tab.tab_number}
          </DialogTitle>
          <DialogDescription>
            Settle payment and close the tab
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {isLoadingTab ? (
            <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
              Loading tab details...
            </div>
          ) : !tabDetails ? (
            <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
              Tab details are not available.
            </div>
          ) : (
            <>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Customer</p>
            <p className="font-medium">{tabDetails.customer_display || tabDetails.customer_name || "Walk-in"}</p>
          </div>

          {/* Tab Items */}
          <div className="space-y-2">
            <Label>Tab Items</Label>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No active items on this tab.
                    </TableCell>
                  </TableRow>
                ) : activeItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.product_name}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{(currentBusiness?.currencySymbol || "MWK")} {Number(item.price).toFixed(2)}</TableCell>
                    <TableCell className="font-semibold">
                      {(currentBusiness?.currencySymbol || "MWK")} {Number(item.total).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totals */}
          <div className="p-3 bg-muted rounded-lg space-y-1">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>{currentBusiness?.currencySymbol || "MWK"} {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tax:</span>
              <span>{currentBusiness?.currencySymbol || "MWK"} {tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total:</span>
              <span>{currentBusiness?.currencySymbol || "MWK"} {total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment */}
          <Tabs value={paymentMethod} onValueChange={setPaymentMethod}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="cash">Cash</TabsTrigger>
              <TabsTrigger value="card">Card</TabsTrigger>
              <TabsTrigger value="mobile">Mobile</TabsTrigger>
              <TabsTrigger value="credit">Credit</TabsTrigger>
            </TabsList>

            <TabsContent value="cash" className="space-y-2 mt-4">
              <Label htmlFor="cash-amount">Amount Received *</Label>
              <Input
                id="cash-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {amount && parseFloat(amount) >= total && (
                <p className="text-sm font-medium text-green-600">
                  Change: {currentBusiness?.currencySymbol || "MWK"} {change.toFixed(2)}
                </p>
              )}
            </TabsContent>

            <TabsContent value="card" className="space-y-2 mt-4">
              <p className="text-sm text-muted-foreground">
                Process card payment through your card reader
              </p>
            </TabsContent>

            <TabsContent value="mobile" className="space-y-2 mt-4">
              <p className="text-sm text-muted-foreground">
                Record this tab as paid via mobile money.
              </p>
            </TabsContent>

            <TabsContent value="credit" className="space-y-2 mt-4">
              <p className="text-sm text-muted-foreground">
                Close the tab as credit. The backend will mark the sale unpaid and assign a default due date.
              </p>
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="close-tab-notes">Notes</Label>
            <Textarea
              id="close-tab-notes"
              placeholder="Optional settlement notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCloseTab}
            disabled={isLoadingTab || !tabDetails || isProcessing || (paymentMethod === "cash" && (!amount || parseFloat(amount) < total))}
            className="bg-green-600 hover:bg-green-700"
          >
            {isProcessing ? "Processing..." : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Close Tab
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

