"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Search, Receipt, Edit, Trash2, Filter, Download, Calendar, CheckCircle, XCircle, Menu } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { useBusinessStore } from "@/stores/businessStore"
import { useToast } from "@/components/ui/use-toast"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ExpenseApprovalModal } from "@/components/modals/expense-approval-modal"
import { EditExpenseModal } from "@/components/modals/edit-expense-modal"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils/currency"
import Link from "next/link"
import { format } from "date-fns"
import { expenseService } from "@/lib/services/expenseService"
import { useI18n } from "@/contexts/i18n-context"

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
  outlet_name?: string
  status: "pending" | "approved" | "rejected"
  created_at: string
  approved_by?: string
  approved_at?: string
  approval_notes?: string
  rejected_by?: string
  rejected_at?: string
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
  "cash",
]

export default function ExpensesPage() {
  const { currentBusiness } = useBusinessStore()
  const { toast } = useToast()
  const { t } = useI18n()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  })
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false)
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [expenseToApprove, setExpenseToApprove] = useState<Expense | null>(null)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject" | null>(null)

  const loadExpenses = useCallback(async () => {
    if (!currentBusiness) {
      setExpenses([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const response = await expenseService.list({
        tenant: currentBusiness.id,
      })
      setExpenses(response.results || [])
    } catch (error) {
      console.error("Failed to load expenses:", error)
      setExpenses([])
      toast({
        title: "Error",
        description: "Failed to load expenses. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [currentBusiness, toast])

  useEffect(() => {
    if (currentBusiness) {
      loadExpenses()
    }
  }, [currentBusiness, loadExpenses])

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = 
      expense.expense_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.vendor?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = 
      statusFilter === "all" || expense.status === statusFilter

    let matchesDate = true
    if (dateRange.from || dateRange.to) {
      const expenseDate = new Date(expense.expense_date)
      if (dateRange.from && expenseDate < dateRange.from) matchesDate = false
      if (dateRange.to && expenseDate > dateRange.to) matchesDate = false
    }
    
    return matchesSearch && matchesStatus && matchesDate
  })

  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0)
  const todayExpenses = filteredExpenses
    .filter(exp => new Date(exp.expense_date).toDateString() === new Date().toDateString())
    .reduce((sum, exp) => sum + exp.amount, 0)

  const handleDelete = (expenseId: string) => {
    setExpenseToDelete(expenseId)
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (!expenseToDelete) return

    try {
      await expenseService.delete(expenseToDelete)
      
      loadExpenses()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete expense.",
        variant: "destructive",
      })
    } finally {
      setShowDeleteDialog(false)
      setExpenseToDelete(null)
    }
  }

  const handleEdit = (expense: Expense) => {
    setExpenseToEdit(expense)
    setShowEditModal(true)
  }

  const handleApprove = (expense: Expense) => {
    setExpenseToApprove(expense)
    setApprovalAction("approve")
    setShowApprovalModal(true)
  }

  const handleReject = (expense: Expense) => {
    setExpenseToApprove(expense)
    setApprovalAction("reject")
    setShowApprovalModal(true)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="default" className="bg-green-500">Approved</Badge>
      case "pending":
        return <Badge variant="secondary">Pending</Badge>
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <DashboardLayout>
      <PageLayout
        title={t("reports.menu.expenses")}
        description={t("reports.expense_report.description")}
      >

        {/* Filters */}
        <div className="mb-6 pb-4 border-b border-gray-300">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-white border-gray-300">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search expenses..."
                  className="pl-10 bg-white border-gray-300"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">Date Range</label>
              <Popover open={isDateRangeOpen} onOpenChange={setIsDateRangeOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start whitespace-pre-line text-left bg-white border-gray-300">
                    <Calendar className="mr-2 h-4 w-4" />
                    {dateRange.from && dateRange.to
                      ? `Custom Range\n${format(dateRange.from, "MMM dd, yyyy")} - ${format(dateRange.to, "MMM dd, yyyy")}`
                      : dateRange.from
                      ? format(dateRange.from, "MMM dd, yyyy")
                      : "Select date range"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-4">
                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-900">Custom Range</h3>
                      {dateRange.from && dateRange.to && (
                        <p className="text-sm text-gray-600 mt-1">
                          {format(dateRange.from, "MMM dd, yyyy")} - {format(dateRange.to, "MMM dd, yyyy")}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-4 mb-4">
                      <div className="space-y-2 flex-1">
                        <label className="text-xs font-medium text-gray-600">From</label>
                        <DatePicker
                          date={dateRange.from}
                          onDateChange={(date) => setDateRange({ ...dateRange, from: date })}
                          placeholder="Start date"
                        />
                      </div>
                      <div className="space-y-2 flex-1">
                        <label className="text-xs font-medium text-gray-600">To</label>
                        <DatePicker
                          date={dateRange.to}
                          onDateChange={(date) => setDateRange({ ...dateRange, to: date })}
                          placeholder="End date"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange({ from: undefined, to: undefined })}
                        className="flex-1"
                      >
                        Clear
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-blue-900 hover:bg-blue-800 text-white"
                        onClick={() => setIsDateRangeOpen(false)}
                      >
                        Confirm
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Add Expense Button */}
        <div className="mb-6 flex justify-end">
          <Link href="/dashboard/office/expenses/new">
            <Button className="bg-blue-900 hover:bg-blue-800 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </Link>
        </div>

        {/* Expenses Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Expenses</CardTitle>
            <CardDescription>
              {filteredExpenses.length} {filteredExpenses.length === 1 ? "expense" : "expenses"} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading expenses...</div>
            ) : filteredExpenses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No expenses found</p>
                <Link href="/dashboard/office/expenses/new">
                  <Button variant="outline" className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Expense
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Expense #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="font-medium">{expense.expense_number}</TableCell>
                        <TableCell>{format(new Date(expense.expense_date), "MMM dd, yyyy")}</TableCell>
                        <TableCell className="font-medium">{expense.title}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
                        <TableCell>{expense.vendor || "N/A"}</TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(expense.amount, currentBusiness)}
                        </TableCell>
                        <TableCell className="capitalize">{expense.payment_method.replace("_", " ")}</TableCell>
                        <TableCell>{getStatusBadge(expense.status)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Menu className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleEdit(expense)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleApprove(expense)}>
                                <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReject(expense)}>
                                <XCircle className="h-4 w-4 mr-2 text-red-600" />
                                Reject
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDelete(expense.id)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Modal */}
        <EditExpenseModal
          open={showEditModal}
          onOpenChange={setShowEditModal}
          expense={expenseToEdit}
          currentBusiness={currentBusiness}
          onSuccess={loadExpenses}
        />

        {/* Approval Modal */}
        <ExpenseApprovalModal
          open={showApprovalModal}
          onOpenChange={setShowApprovalModal}
          expense={expenseToApprove}
          action={approvalAction}
          currentBusiness={currentBusiness}
          onSuccess={loadExpenses}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Expense?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this expense? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageLayout>
    </DashboardLayout>
  )
}

