"use client"

import { useEffect, useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { adminService, type AdminTenant, type TenantPaymentSummary } from "@/lib/services/adminService"

interface RecordTenantPaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenant?: AdminTenant | null
  onRecorded?: () => Promise<void> | void
}

export function RecordTenantPaymentModal({
  open,
  onOpenChange,
  tenant,
  onRecorded,
}: RecordTenantPaymentModalProps) {
  const { toast } = useToast()
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [paymentSummary, setPaymentSummary] = useState<TenantPaymentSummary | null>(null)

  const loadPaymentHistory = async () => {
    if (!tenant?.id) return

    setIsLoadingHistory(true)
    try {
      const data = await adminService.getTenantPayments(tenant.id)
      setPaymentSummary(data)
    } catch (error: any) {
      toast({
        title: "Failed to load payment history",
        description: error.message || "Could not fetch tenant payments.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingHistory(false)
    }
  }

  useEffect(() => {
    if (open && tenant?.id) {
      loadPaymentHistory()
    }
  }, [open, tenant?.id])

  useEffect(() => {
    if (!open) {
      setAmount("")
      setReason("")
      setNotes("")
    }
  }, [open])

  if (!tenant) return null

  const handleRecordPayment = async () => {
    const parsedAmount = Number(amount)

    if (!parsedAmount || parsedAmount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Enter a valid payment amount greater than zero.",
        variant: "destructive",
      })
      return
    }

    if (!reason.trim()) {
      toast({
        title: "Reason required",
        description: "Provide a reason for this manual payment.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      await adminService.recordTenantPayment(tenant.id, {
        amount: parsedAmount,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      })

      toast({
        title: "Payment recorded",
        description: `Payment was saved for ${tenant.name}.`,
      })

      setAmount("")
      setReason("")
      setNotes("")

      await loadPaymentHistory()
      if (onRecorded) {
        await onRecorded()
      }
    } catch (error: any) {
      toast({
        title: "Payment not recorded",
        description: error.message || "Failed to save payment.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Record Tenant Payment</DialogTitle>
          <DialogDescription>
            Add a manual subscription payment for {tenant.name} and review payment history.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2 py-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Amount (MWK)</Label>
              <Input
                id="payment-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-reason">Reason</Label>
              <Input
                id="payment-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. March manual subscription"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-notes">Notes (Optional)</Label>
              <Textarea
                id="payment-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Transaction reference, payer details, or internal note"
                className="min-h-[100px]"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-md border p-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Paid</span>
              <span className="text-sm font-semibold">
                MWK {(paymentSummary?.total_paid || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="rounded-md border p-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Payments Recorded</span>
              <Badge variant="outline">{paymentSummary?.payment_count || 0}</Badge>
            </div>

            <div className="rounded-md border">
              <div className="border-b px-3 py-2 text-sm font-medium">Payment History</div>
              <ScrollArea className="h-[240px]">
                <div className="space-y-2 p-3">
                  {isLoadingHistory && (
                    <p className="text-sm text-muted-foreground">Loading payment history...</p>
                  )}

                  {!isLoadingHistory && (paymentSummary?.payments?.length || 0) === 0 && (
                    <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
                  )}

                  {!isLoadingHistory && paymentSummary?.payments?.map((payment) => (
                    <div key={payment.id} className="rounded-md border p-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">
                          MWK {payment.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(payment.payment_date).toLocaleString()}
                        </p>
                      </div>
                      <p className="text-sm">{payment.reason}</p>
                      {payment.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{payment.notes}</p>
                      )}
                      {payment.recorded_by_name && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Recorded by: {payment.recorded_by_name}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleRecordPayment} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
