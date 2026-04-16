"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { formatCurrency } from "@/lib/utils/currency"
import { CheckCircle, XCircle } from "lucide-react"
import { expenseService } from "@/lib/services/expenseService"

interface Expense {
  id: string
  expense_number: string
  title: string
  amount: number
  category: string
  vendor?: string
  description: string
  expense_date: string
}

interface ExpenseApprovalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense: Expense | null
  action: "approve" | "reject" | null
  currentBusiness: any
  onSuccess?: () => void
}

export function ExpenseApprovalModal({
  open,
  onOpenChange,
  expense,
  action,
  currentBusiness,
  onSuccess,
}: ExpenseApprovalModalProps) {
  const { toast } = useToast()
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!expense || !action) return

    setIsSubmitting(true)
    try {
      if (action === "approve") {
        await expenseService.approve(expense.id, notes)
      } else {
        await expenseService.reject(expense.id, notes)
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("expense-updated", { detail: { action, expenseId: expense.id } }))
      }

      setNotes("")
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${action} expense.`,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setNotes("")
    onOpenChange(false)
  }

  if (!expense) return null

  const isApprove = action === "approve"

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isApprove ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            {isApprove ? "Approve Expense" : "Reject Expense"}
          </DialogTitle>
          <DialogDescription>
            {isApprove 
              ? "Confirm expense approval and add optional notes."
              : "Please provide a reason for rejecting this expense."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Expense Details */}
          <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Expense #:</span>
                <span className="text-sm font-medium">{expense.expense_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Title:</span>
                <span className="text-sm font-medium">{expense.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Amount:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency(expense.amount, currentBusiness)}
                </span>
              </div>
              {expense.vendor && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Vendor:</span>
                  <span className="text-sm font-medium">{expense.vendor}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes/Reason Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900">
              {isApprove ? "Approval Notes (Optional)" : "Rejection Reason *"}
            </label>
            <Textarea
              placeholder={isApprove 
                ? "Add any notes about this approval..." 
                : "Please explain why this expense is being rejected..."}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-24 resize-none"
              required={!isApprove}
            />
            {!isApprove && (
              <p className="text-xs text-gray-500">
                A rejection reason is required and will be visible to the submitter.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || (!isApprove && !notes.trim())}
            className={isApprove 
              ? "bg-green-600 hover:bg-green-700" 
              : "bg-red-600 hover:bg-red-700"}
          >
            {isSubmitting ? "Processing..." : (isApprove ? "Approve" : "Reject")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
