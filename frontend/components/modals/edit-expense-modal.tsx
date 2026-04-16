"use client"

import { useState, useEffect } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DatePicker } from "@/components/ui/date-picker"
import { useToast } from "@/components/ui/use-toast"
import { expenseService } from "@/lib/services/expenseService"
import { Receipt } from "lucide-react"

interface Expense {
  id: string
  expense_number: string
  title: string
  category: string
  vendor?: string
  description: string
  amount: number
  payment_method: string
  payment_reference?: string
  expense_date: string
  outlet_id?: string
  status: "pending" | "approved" | "rejected"
}

interface EditExpenseModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense: Expense | null
  currentBusiness: any
  onSuccess?: () => void
}

const expenseCategories = [
  "Supplies",
  "Utilities",
  "Rent",
  "Marketing",
  "Travel",
  "Equipment",
  "Maintenance",
  "Other"
]

const paymentMethods = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "check", label: "Check" },
  { value: "other", label: "Other" }
]

export function EditExpenseModal({
  open,
  onOpenChange,
  expense,
  currentBusiness,
  onSuccess,
}: EditExpenseModalProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    vendor: "",
    description: "",
    amount: "",
    payment_method: "cash",
    payment_reference: "",
    expense_date: new Date(),
  })

  useEffect(() => {
    if (expense && open) {
      setFormData({
        title: expense.title || "",
        category: expense.category || "",
        vendor: expense.vendor || "",
        description: expense.description || "",
        amount: expense.amount?.toString() || "",
        payment_method: expense.payment_method || "cash",
        payment_reference: expense.payment_reference || "",
        expense_date: expense.expense_date ? new Date(expense.expense_date) : new Date(),
      })
    }
  }, [expense, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expense) return

    setIsSubmitting(true)
    try {
      await expenseService.update(expense.id, {
        ...formData,
        amount: parseFloat(formData.amount),
        expense_date: formData.expense_date.toISOString().split('T')[0],
      })

      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update expense.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false)
    }
  }

  if (!expense) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-blue-600" />
            Edit Expense - {expense.expense_number}
          </DialogTitle>
          <DialogDescription>
            Update expense details. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g., Office Supplies"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Category and Date */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">
                Category <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
                disabled={isSubmitting}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">
                Expense Date <span className="text-red-500">*</span>
              </label>
              <DatePicker
                date={formData.expense_date}
                onDateChange={(date) => setFormData({ ...formData, expense_date: date || new Date() })}
              />
            </div>
          </div>

          {/* Amount and Payment Method */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">
                Amount ({currentBusiness?.currency || "USD"}) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">
                Payment Method <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.payment_method}
                onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                disabled={isSubmitting}
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Vendor and Payment Reference */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">Vendor</label>
              <Input
                placeholder="e.g., Staples"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">Payment Reference</label>
              <Input
                placeholder="e.g., Invoice #, Transaction ID"
                value={formData.payment_reference}
                onChange={(e) => setFormData({ ...formData, payment_reference: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900">Description</label>
            <Textarea
              placeholder="Additional details about this expense..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="h-24 resize-none"
              disabled={isSubmitting}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.title || !formData.category || !formData.amount}
              className="bg-blue-900 hover:bg-blue-800"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
