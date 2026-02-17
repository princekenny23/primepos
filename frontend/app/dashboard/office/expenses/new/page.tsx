"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useBusinessStore } from "@/stores/businessStore"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useTenant } from "@/contexts/tenant-context"
import { expenseService } from "@/lib/services/expenseService"
import { shiftService, type Shift } from "@/lib/services/shiftService"
import { format, isValid, parseISO } from "date-fns"

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

export default function NewExpensePage() {
  const { currentBusiness } = useBusinessStore()
  const { outlets } = useTenant()
  const { toast } = useToast()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingShifts, setIsLoadingShifts] = useState(false)
  const [openShifts, setOpenShifts] = useState<Shift[]>([])
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    vendor: "",
    description: "",
    amount: "",
    payment_method: "",
    payment_reference: "",
    expense_date: new Date().toISOString().split("T")[0],
    outlet_id: "",
    shift_id: "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const formatShiftTime = (value?: string | null) => {
    if (!value) return "-"
    const parsed = parseISO(value)
    if (!isValid(parsed)) return value
    return format(parsed, "HH:mm")
  }

  const shiftOptions = useMemo(() => {
    return openShifts.map((shift) => {
      const start = formatShiftTime(shift.startTime)
      const end = formatShiftTime(shift.endTime)
      const parsedDate = shift.operatingDate ? parseISO(shift.operatingDate) : null
      const date = parsedDate && isValid(parsedDate) ? format(parsedDate, "MMM dd") : ""
      return {
        id: String(shift.id),
        label: `Shift #${shift.id} • ${date} ${start}${end !== "-" ? ` - ${end}` : ""}`.trim(),
      }
    })
  }, [openShifts])

  useEffect(() => {
    if (outlets.length === 1 && !formData.outlet_id) {
      setFormData((prev) => ({ ...prev, outlet_id: String(outlets[0].id) }))
    }
  }, [outlets, formData.outlet_id])

  useEffect(() => {
    const loadShifts = async () => {
      if (!formData.outlet_id) {
        setOpenShifts([])
        setFormData((prev) => ({ ...prev, shift_id: "" }))
        return
      }

      setIsLoadingShifts(true)
      try {
        const shifts = await shiftService.listOpen({ outlet: formData.outlet_id })
        setOpenShifts(shifts)
        if (shifts.length === 1) {
          setFormData((prev) => ({ ...prev, shift_id: String(shifts[0].id) }))
        } else if (!shifts.find((shift) => String(shift.id) === formData.shift_id)) {
          setFormData((prev) => ({ ...prev, shift_id: "" }))
        }
      } catch (error: any) {
        console.error("Failed to load open shifts:", error)
        setOpenShifts([])
        setFormData((prev) => ({ ...prev, shift_id: "" }))
      } finally {
        setIsLoadingShifts(false)
      }
    }

    loadShifts()
  }, [formData.outlet_id, formData.shift_id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title || !formData.category || !formData.amount || !formData.payment_method || !formData.description) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (Title, Category, Amount, Payment Method, and Description).",
        variant: "destructive",
      })
      return
    }

    if (!formData.shift_id) {
      toast({
        title: "Shift Required",
        description: "Select an open shift to keep cashup reporting accurate.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      await expenseService.create({
        title: formData.title.trim(),
        category: formData.category,
        vendor: formData.vendor.trim() || undefined,
        description: formData.description.trim(),
        amount: parseFloat(formData.amount),
        payment_method: formData.payment_method,
        payment_reference: formData.payment_reference.trim() || undefined,
        expense_date: formData.expense_date,
        outlet_id: formData.outlet_id || undefined,
        shift_id: formData.shift_id || undefined,
      })

      toast({
        title: "Expense Created",
        description: "Expense has been created successfully.",
      })
      router.push("/dashboard/office/expenses")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create expense.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <PageLayout
        title="Add New Expense"
        description="Record a new business expense"
        
      >

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Left Column */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Expense Details</CardTitle>
                  <CardDescription>Enter the expense information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Expense Title *</Label>
                    <Input
                      id="title"
                      placeholder="e.g., Rent, Utilities, Office Supplies"
                      value={formData.title}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => handleInputChange("category", value)}
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseCategories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vendor">Vendor/Supplier</Label>
                    <Input
                      id="vendor"
                      placeholder="Enter vendor name"
                      value={formData.vendor}
                      onChange={(e) => handleInputChange("vendor", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      placeholder="Enter expense description"
                      value={formData.description}
                      onChange={(e) => handleInputChange("description", e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={formData.amount}
                        onChange={(e) => handleInputChange("amount", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expense_date">Date *</Label>
                      <Input
                        id="expense_date"
                        type="date"
                        value={formData.expense_date}
                        onChange={(e) => handleInputChange("expense_date", e.target.value)}
                      />
                    </div>
                  </div>

                  {outlets.length > 1 && (
                    <div className="space-y-2">
                      <Label htmlFor="outlet">Outlet</Label>
                      <Select
                        value={formData.outlet_id}
                        onValueChange={(value) => handleInputChange("outlet_id", value)}
                      >
                        <SelectTrigger id="outlet">
                          <SelectValue placeholder="Select outlet" />
                        </SelectTrigger>
                        <SelectContent>
                          {outlets.map(outlet => (
                            <SelectItem key={outlet.id} value={String(outlet.id)}>
                              {outlet.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="shift">Shift *</Label>
                    <Select
                      value={formData.shift_id}
                      onValueChange={(value) => handleInputChange("shift_id", value)}
                      disabled={!formData.outlet_id || isLoadingShifts}
                    >
                      <SelectTrigger id="shift">
                        <SelectValue placeholder={isLoadingShifts ? "Loading shifts..." : "Select open shift"} />
                      </SelectTrigger>
                      <SelectContent>
                        {shiftOptions.map((shift) => (
                          <SelectItem key={shift.id} value={shift.id}>
                            {shift.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!isLoadingShifts && formData.outlet_id && openShifts.length === 0 && (
                      <p className="text-xs text-destructive">No open shifts for this outlet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Payment Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="payment_method">Payment Method *</Label>
                    <Select
                      value={formData.payment_method}
                      onValueChange={(value) => handleInputChange("payment_method", value)}
                    >
                      <SelectTrigger id="payment_method">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map(method => (
                          <SelectItem key={method.value} value={method.value}>
                            {method.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment_reference">Payment Reference</Label>
                    <Input
                      id="payment_reference"
                      placeholder="Check number, transaction ID, etc."
                      value={formData.payment_reference}
                      onChange={(e) => handleInputChange("payment_reference", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-4">
                <Link href="/dashboard/office/expenses" className="flex-1">
                  <Button type="button" variant="outline" className="w-full">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Expense"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </PageLayout>
    </DashboardLayout>
  )
}

