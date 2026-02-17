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
import { Plus, Search, FileText, Trash2, Eye, Filter, Download, Menu, ShoppingCart, Calendar, Printer, Pencil, X } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency } from "@/lib/utils/currency"
import Link from "next/link"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { quotationService, type Quotation } from "@/lib/services/quotationService"
import { useTenant } from "@/contexts/tenant-context"
import { SelectProductModal } from "@/components/modals/select-product-modal"
import { CustomerSelectModal } from "@/components/modals/customer-select-modal"

const LOCAL_PRINT_AGENT_URL =
  process.env.NEXT_PUBLIC_LOCAL_PRINT_AGENT_URL || "http://127.0.0.1:7310"
const LOCAL_PRINT_AGENT_TOKEN =
  process.env.NEXT_PUBLIC_LOCAL_PRINT_AGENT_TOKEN || ""

function encodeTextToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ""
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

function htmlToText(html: string): string {
  if (typeof window === "undefined") return html
  const doc = new DOMParser().parseFromString(html, "text/html")
  return doc.body?.innerText || html
}

async function printTextViaAgent(text: string, printer?: string): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (LOCAL_PRINT_AGENT_TOKEN) {
    headers["X-Primepos-Token"] = LOCAL_PRINT_AGENT_TOKEN
  }
  const contentBase64 = encodeTextToBase64(text)
  const response = await fetch(`${LOCAL_PRINT_AGENT_URL}/print`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      printerName: printer || "",
      contentBase64,
      jobName: "PrimePOS Quotation",
    }),
  })
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(body || response.statusText)
  }
}

export default function QuotationsPage() {
  const { currentBusiness } = useBusinessStore()
  const { currentOutlet } = useTenant()
  const { toast } = useToast()
  const router = useRouter()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  })
  const [quotationToDelete, setQuotationToDelete] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null)
  const [editForm, setEditForm] = useState({ customer_id: "", customer_name: "", valid_until: "", notes: "" })
  const [editItems, setEditItems] = useState<any[]>([])
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [showProductSelector, setShowProductSelector] = useState(false)
  const [showCustomerSelector, setShowCustomerSelector] = useState(false)

  const autoExpireQuotations = useCallback(async (data: Quotation[]) => {
    const now = new Date()
    const toExpire = data.filter((quotation) => {
      const validUntil = new Date(quotation.valid_until)
      return validUntil < now && !["expired", "converted", "cancelled"].includes(quotation.status)
    })

    if (!toExpire.length) return data

    try {
      await Promise.allSettled(toExpire.map((quotation) => quotationService.updateStatus(quotation.id, "expired")))
      return data.map((quotation) =>
        toExpire.find((item) => item.id === quotation.id)
          ? { ...quotation, status: "expired" as const }
          : quotation
      )
    } catch (error) {
      console.error("Failed to auto-expire quotations:", error)
      toast({
        title: "Status sync issue",
        description: "Some quotations could not be marked as expired. Please refresh and try again.",
        variant: "destructive",
      })
      return data
    }
  }, [toast])

  const loadQuotations = useCallback(async () => {
    if (!currentBusiness) {
      setQuotations([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const response = await quotationService.list({
        outlet: currentOutlet?.id,
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: searchTerm || undefined,
      })
      const syncedQuotations = await autoExpireQuotations(response.results || [])
      setQuotations(syncedQuotations)
    } catch (error) {
      console.error("Failed to load quotations:", error)
      setQuotations([])
      toast({
        title: "Error",
        description: "Failed to load quotations. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [currentBusiness, currentOutlet, statusFilter, searchTerm, toast, autoExpireQuotations])

  useEffect(() => {
    if (currentBusiness) {
      loadQuotations()
    }
  }, [currentBusiness, loadQuotations])

  // Reload when filters change
  useEffect(() => {
    if (currentBusiness) {
      loadQuotations()
    }
  }, [statusFilter, searchTerm, currentBusiness, loadQuotations])

  const filteredQuotations = quotations.filter(quotation => {
    const matchesSearch = 
      quotation.quotation_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quotation.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = 
      statusFilter === "all" || quotation.status === statusFilter

    let matchesDate = true
    if (dateRange.from || dateRange.to) {
      const quotationDate = new Date(quotation.created_at)
      if (dateRange.from && quotationDate < dateRange.from) matchesDate = false
      if (dateRange.to && quotationDate > dateRange.to) matchesDate = false
    }
    
    return matchesSearch && matchesStatus && matchesDate
  })

  const totalValue = filteredQuotations.reduce((sum, q) => sum + q.total, 0)
  const pendingQuotations = filteredQuotations.filter(q => 
    q.status === "draft" || q.status === "sent"
  ).length
  const convertedQuotations = filteredQuotations.filter(q => 
    q.status === "converted"
  ).length

  const handleDelete = (quotationId: string) => {
    setQuotationToDelete(quotationId)
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (!quotationToDelete) return

    try {
      await quotationService.delete(quotationToDelete)
      
      toast({
        title: "Quotation Deleted",
        description: "Quotation has been deleted successfully.",
      })
      loadQuotations()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete quotation.",
        variant: "destructive",
      })
    } finally {
      setShowDeleteDialog(false)
      setQuotationToDelete(null)
    }
  }

  const handleView = async (quotationId: string) => {
    try {
      const quotation = await quotationService.get(quotationId)
      setSelectedQuotation(quotation)
      setShowViewDialog(true)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load quotation details.",
        variant: "destructive",
      })
    }
  }

  const openEdit = async (quotationId: string) => {
    try {
      const quotation = await quotationService.get(quotationId)
      setEditingQuotation(quotation)
      setEditForm({
        customer_id: quotation.customer?.id ? String(quotation.customer.id) : "",
        customer_name: quotation.customer_name || quotation.customer?.name || "",
        valid_until: quotation.valid_until?.split("T")[0] || "",
        notes: quotation.notes || "",
      })
      setEditItems(
        (quotation.items || []).map((item, idx) => ({
          id: item.id || String(idx),
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        }))
      )
      setShowEditDialog(true)
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load quotation.", variant: "destructive" })
    }
  }

  const editSubtotal = editItems.reduce((sum, it) => sum + (Number(it.total) || 0), 0)
  const editDiscount = 0
  const editTax = 0
  const editTotal = editSubtotal - editDiscount + editTax

  const updateEditQuantity = (id: string, quantity: number) => {
    if (quantity < 1) return
    setEditItems((prev) => prev.map((it) => (it.id === id ? { ...it, quantity, total: (Number(it.price) || 0) * quantity } : it)))
  }

  const removeEditItem = (id: string) => setEditItems((prev) => prev.filter((it) => it.id !== id))

  const addEditProduct = (product: any) => {
    const price = (product as any).retail_price || product.price || 0
    setEditItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        product_id: product.id,
        product_name: product.name || "",
        quantity: 1,
        price,
        total: price,
      },
    ])
  }

  const onSelectCustomer = (customer: any | null) => {
    if (customer) {
      setEditForm((p) => ({ ...p, customer_id: String(customer.id), customer_name: customer.name }))
    } else {
      setEditForm((p) => ({ ...p, customer_id: "" }))
    }
  }

  const saveEdit = async () => {
    if (!editingQuotation) return
    if (!currentOutlet) {
      toast({ title: "Validation Error", description: "Please select an outlet.", variant: "destructive" })
      return
    }
    if (!editForm.customer_id && !editForm.customer_name) {
      toast({ title: "Validation Error", description: "Select or enter a customer.", variant: "destructive" })
      return
    }
    if (editItems.length === 0) {
      toast({ title: "Validation Error", description: "Add at least one item.", variant: "destructive" })
      return
    }
    setIsSavingEdit(true)
    try {
      await quotationService.update(editingQuotation.id, {
        customer_id: editForm.customer_id || undefined,
        customer_name: editForm.customer_name || undefined,
        items: editItems.map((it) => ({
          product_id: it.product_id,
          product_name: it.product_name,
          quantity: it.quantity,
          price: it.price,
          total: it.total,
        })),
        subtotal: editSubtotal,
        discount: editDiscount,
        tax: editTax,
        total: editTotal,
        valid_until: editForm.valid_until,
        notes: editForm.notes || undefined,
      })
      toast({ title: "Quotation Updated", description: "Changes saved successfully." })
      setShowEditDialog(false)
      setEditingQuotation(null)
      loadQuotations()
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update quotation.", variant: "destructive" })
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDownloadPDF = async (quotation: Quotation) => {
    try {
      // Dynamically import jsPDF and html2canvas
      const [{ default: jsPDF }, html2canvas] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ])

      // Show loading toast
      toast({
        title: "Generating PDF",
        description: "Please wait while we generate your quotation PDF...",
      })

      // Create a temporary container for PDF generation
      const tempDiv = document.createElement("div")
      tempDiv.style.position = "absolute"
      tempDiv.style.left = "-9999px"
      tempDiv.style.width = "800px"
      tempDiv.style.padding = "32px"
      tempDiv.style.backgroundColor = "#ffffff"
      tempDiv.className = "bg-white p-8"
      
      // Build HTML content
      tempDiv.innerHTML = `
        <div style="text-align: center; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 2px dashed #ccc;">
          <h2 style="font-size: 24px; font-weight: bold; margin: 0;">${currentBusiness?.name || "Business Name"}</h2>
          ${currentBusiness?.address ? `<p style="font-size: 12px; color: #666; margin-top: 8px;">${currentBusiness.address}</p>` : ""}
          <div style="display: flex; justify-content: center; gap: 16px; margin-top: 8px; font-size: 12px; color: #666;">
            ${currentBusiness?.phone ? `<span>Phone: ${currentBusiness.phone}</span>` : ""}
            ${currentBusiness?.email ? `<span>Email: ${currentBusiness.email}</span>` : ""}
          </div>
          ${currentOutlet ? `<p style="font-size: 12px; color: #666; margin-top: 8px;">Outlet: ${currentOutlet.name}</p>` : ""}
          <div style="margin-top: 16px;">
            <strong style="font-size: 16px;">QUOTATION</strong>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
          <div>
            <p style="font-size: 12px; color: #666; margin-bottom: 4px;">Quotation To:</p>
            <p style="font-weight: 600; font-size: 14px;">${quotation.customer_name || "Customer Name"}</p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 12px; color: #666; margin-bottom: 4px;">Date:</p>
            <p style="font-weight: 600; font-size: 14px;">${format(new Date(quotation.created_at), "MMM dd, yyyy")}</p>
            <p style="font-size: 12px; color: #666; margin-top: 8px; margin-bottom: 4px;">Valid Until:</p>
            <p style="font-weight: 600; font-size: 14px;">${format(new Date(quotation.valid_until), "MMM dd, yyyy")}</p>
          </div>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <thead>
            <tr style="border-bottom: 1px solid #ddd;">
              <th style="text-align: left; padding: 10px; font-weight: bold; font-size: 12px;">Item</th>
              <th style="text-align: right; padding: 10px; font-weight: bold; font-size: 12px;">Quantity</th>
              <th style="text-align: right; padding: 10px; font-weight: bold; font-size: 12px;">Unit Price</th>
              <th style="text-align: right; padding: 10px; font-weight: bold; font-size: 12px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${quotation.items?.map(item => `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px; font-size: 12px;">${item.product_name}</td>
                <td style="text-align: right; padding: 10px; font-size: 12px;">${item.quantity}</td>
                <td style="text-align: right; padding: 10px; font-size: 12px;">${formatCurrency(item.price, currentBusiness)}</td>
                <td style="text-align: right; padding: 10px; font-size: 12px; font-weight: 600;">${formatCurrency(item.total, currentBusiness)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div style="border-top: 2px solid #000; padding-top: 16px; margin-top: 24px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px;">
            <span style="color: #666;">Subtotal:</span>
            <span style="font-weight: 600;">${formatCurrency(quotation.subtotal, currentBusiness)}</span>
          </div>
          ${quotation.discount > 0 ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px;">
            <span style="color: #666;">Discount:</span>
            <span style="font-weight: 600; color: green;">-${formatCurrency(quotation.discount, currentBusiness)}</span>
          </div>
          ` : ""}
          ${quotation.tax > 0 ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px;">
            <span style="color: #666;">Tax:</span>
            <span style="font-weight: 600;">${formatCurrency(quotation.tax, currentBusiness)}</span>
          </div>
          ` : ""}
          <div style="display: flex; justify-content: space-between; margin-top: 16px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 18px; font-weight: bold;">
            <span>Total:</span>
            <span>${formatCurrency(quotation.total, currentBusiness)}</span>
          </div>
        </div>
        ${quotation.notes ? `
        <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #ddd;">
          <p style="font-size: 12px; font-weight: 600; margin-bottom: 8px;">Notes:</p>
          <p style="font-size: 12px; color: #666; white-space: pre-wrap;">${quotation.notes}</p>
        </div>
        ` : ""}
        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px dashed #ccc; text-align: center; font-size: 11px; color: #666;">
          <p>This quotation is valid until ${format(new Date(quotation.valid_until), "MMMM dd, yyyy")}</p>
          <p style="margin-top: 4px;">Thank you for your business!</p>
        </div>
      `
      
      document.body.appendChild(tempDiv)

      // Wait a bit for rendering
      await new Promise(resolve => setTimeout(resolve, 100))

      // Capture as canvas
      const canvas = await html2canvas.default(tempDiv, {
        useCORS: true,
        logging: false,
      })

      // Remove temp element
      document.body.removeChild(tempDiv)

      // Calculate PDF dimensions
      const imgWidth = 210 // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const pdf = new jsPDF("p", "mm", "a4")
      
      // Add image to PDF
      const imgData = canvas.toDataURL("image/png")
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight)

      // Generate filename
      const filename = `Quotation-${quotation.quotation_number}-${format(new Date(quotation.created_at), "yyyy-MM-dd")}.pdf`

      // Save PDF
      pdf.save(filename)

      toast({
        title: "PDF Downloaded",
        description: "Quotation PDF has been downloaded successfully.",
      })
    } catch (error: any) {
      console.error("Failed to download quotation PDF:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to generate PDF. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handlePrintWithQR = async (quotation: Quotation) => {
    setIsPrinting(true)
    try {
      // Generate quotation HTML content
      const quotationHTML = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; margin: 10px; font-size: 12px; max-width: 300px; }
              .header { text-align: center; margin-bottom: 10px; border-bottom: 1px solid #000; padding-bottom: 5px; }
              .title { font-size: 16px; font-weight: bold; }
              .business-name { font-size: 14px; margin-top: 2px; }
              .section { margin-top: 8px; }
              .label { font-weight: bold; }
              .row { display: flex; justify-content: space-between; margin: 3px 0; }
              table { width: 100%; border-collapse: collapse; margin-top: 8px; }
              th, td { text-align: left; padding: 4px; border-bottom: 1px dashed #ccc; font-size: 11px; }
              th { font-weight: bold; }
              .text-right { text-align: right; }
              .totals { margin-top: 8px; border-top: 2px solid #000; padding-top: 5px; }
              .total-row { font-weight: bold; font-size: 14px; margin-top: 5px; padding-top: 5px; border-top: 1px solid #000; }
              .footer { text-align: center; margin-top: 10px; border-top: 1px solid #000; padding-top: 5px; font-size: 10px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">QUOTATION</div>
              <div class="business-name">${currentBusiness?.name || 'Business'}</div>
              ${currentBusiness?.address ? `<div style="font-size: 10px; color: #666;">${currentBusiness.address}</div>` : ""}
              ${currentOutlet ? `<div style="font-size: 10px; margin-top: 2px;">Outlet: ${currentOutlet.name}</div>` : ""}
            </div>
            
            <div class="section">
              <div class="row">
                <span class="label">Quotation #:</span>
                <span>${quotation.quotation_number}</span>
              </div>
              <div class="row">
                <span class="label">Customer:</span>
                <span>${quotation.customer_name || "Walk-in"}</span>
              </div>
              <div class="row">
                <span class="label">Date:</span>
                <span>${format(new Date(quotation.created_at), "MMM dd, yyyy")}</span>
              </div>
              <div class="row">
                <span class="label">Valid Until:</span>
                <span>${format(new Date(quotation.valid_until), "MMM dd, yyyy")}</span>
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th class="text-right">Qty</th>
                  <th class="text-right">Price</th>
                  <th class="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${quotation.items?.map(item => `
                  <tr>
                    <td>${item.product_name}</td>
                    <td class="text-right">${item.quantity}</td>
                    <td class="text-right">${formatCurrency(item.price, currentBusiness)}</td>
                    <td class="text-right">${formatCurrency(item.total, currentBusiness)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
            
            <div class="totals">
              <div class="row">
                <span>Subtotal:</span>
                <span>${formatCurrency(quotation.subtotal, currentBusiness)}</span>
              </div>
              ${quotation.discount > 0 ? `
              <div class="row">
                <span>Discount:</span>
                <span>-${formatCurrency(quotation.discount, currentBusiness)}</span>
              </div>
              ` : ""}
              ${quotation.tax > 0 ? `
              <div class="row">
                <span>Tax:</span>
                <span>${formatCurrency(quotation.tax, currentBusiness)}</span>
              </div>
              ` : ""}
              <div class="row total-row">
                <span>TOTAL:</span>
                <span>${formatCurrency(quotation.total, currentBusiness)}</span>
              </div>
            </div>
            
            ${quotation.notes ? `
            <div class="section">
              <div class="label">Notes:</div>
              <div style="font-size: 10px; margin-top: 3px; white-space: pre-wrap;">${quotation.notes}</div>
            </div>
            ` : ""}
            
            <div class="footer">
              <p>Valid until ${format(new Date(quotation.valid_until), "MMMM dd, yyyy")}</p>
              <p>Thank you for your business!</p>
              <p style="margin-top: 5px;">Printed: ${format(new Date(), "MMM dd, yyyy HH:mm:ss")}</p>
            </div>
          </body>
        </html>
      `

      const quotationText = htmlToText(quotationHTML)
      await printTextViaAgent(quotationText)

      toast({
        title: "Printed",
        description: "Quotation has been sent to printer.",
      })
    } catch (error: any) {
      console.error("Failed to print quotation:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to print. Make sure the Local Print Agent is running.",
        variant: "destructive",
      })
    } finally {
      setIsPrinting(false)
    }
  }

  const getStatusBadge = (quotation: Quotation) => {
    // Check if quotation is expired first
    if (new Date(quotation.valid_until) < new Date() && quotation.status !== "converted" && quotation.status !== "cancelled") {
      return <Badge variant="destructive">Expired</Badge>
    }
    
    // Otherwise show the actual status
    switch (quotation.status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>
      case "sent":
        return <Badge variant="default" className="bg-blue-500">Sent</Badge>
      case "accepted":
        return <Badge variant="default" className="bg-green-500">Accepted</Badge>
      case "converted":
        return <Badge variant="default" className="bg-purple-500">Converted</Badge>
      case "expired":
        return <Badge variant="destructive">Expired</Badge>
      case "cancelled":
        return <Badge variant="outline">Cancelled</Badge>
      default:
        return <Badge variant="secondary">{quotation.status}</Badge>
    }
  }

  const isExpired = (validUntil: string) => {
    return new Date(validUntil) < new Date()
  }

  return (
    <DashboardLayout>
      <PageLayout
        title="Quotations"
        description="Create and manage customer quotations"
        actions={
          <Link href="/dashboard/office/quotations/new">
            <Button className="bg-white border-white text-[#1e3a8a] hover:bg-blue-50 hover:border-blue-50">
              <Plus className="h-4 w-4 mr-2" />
              Create Quotation
            </Button>
          </Link>
        }
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
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search quotations..."
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left bg-white border-gray-300">
                    <Calendar className="mr-2 h-4 w-4" />
                    {dateRange.from && dateRange.to
                      ? `${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd")}`
                      : dateRange.from
                      ? format(dateRange.from, "MMM dd, yyyy")
                      : "Select date range"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="flex gap-4 p-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-600">From</label>
                      <DatePicker
                        date={dateRange.from}
                        onDateChange={(date) => setDateRange({ ...dateRange, from: date })}
                        placeholder="Start date"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-600">To</label>
                      <DatePicker
                        date={dateRange.to}
                        onDateChange={(date) => setDateRange({ ...dateRange, to: date })}
                        placeholder="End date"
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Quotations Table */}
        <div>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">All Quotations</h3>
            <p className="text-sm text-gray-600">
              {filteredQuotations.length} {filteredQuotations.length === 1 ? "quotation" : "quotations"} found
            </p>
          </div>
          <div>
            {isLoading ? (
              <div className="text-center py-8 text-gray-600">Loading quotations...</div>
            ) : filteredQuotations.length === 0 ? (
              <div className="text-center py-8 text-gray-600">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No quotations found</p>
                <Link href="/dashboard/office/quotations/new">
                  <Button variant="outline" className="mt-4 border-gray-300">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Quotation
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="rounded-md border border-gray-300 bg-white">
                <Table>
                    <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-gray-900 font-semibold">Quotation #</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Customer</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Date</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Valid Until</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Items</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Total</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Status</TableHead>
                      <TableHead className="text-right text-gray-900 font-semibold">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                  <TableBody>
                    {filteredQuotations.map((quotation) => (
                      <TableRow key={quotation.id} className="border-gray-300">
                        <TableCell className="font-medium">{quotation.quotation_number}</TableCell>
                        <TableCell>{quotation.customer_name || "Walk-in"}</TableCell>
                        <TableCell>{format(new Date(quotation.created_at), "MMM dd, yyyy")}</TableCell>
                        <TableCell>
                          <span className={isExpired(quotation.valid_until) ? "text-destructive" : ""}>
                            {format(new Date(quotation.valid_until), "MMM dd, yyyy")}
                          </span>
                        </TableCell>
                        <TableCell>{quotation.items?.length || quotation.items_count || 0} items</TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(quotation.total, currentBusiness)}
                        </TableCell>
                        <TableCell>{getStatusBadge(quotation)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="border-gray-300">
                                <Menu className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleView(quotation.id)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(quotation.id)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownloadPDF(quotation)}>
                                <Download className="mr-2 h-4 w-4" />
                                Download PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePrintWithQR(quotation)} disabled={isPrinting}>
                                <Printer className="mr-2 h-4 w-4" />
                                {isPrinting ? "Printing..." : "Print with QR"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(quotation.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
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
          </div>
        </div>
      </PageLayout>

        {/* Edit Quotation Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5" />
                Edit Quotation {editingQuotation?.quotation_number ? `- ${editingQuotation.quotation_number}` : ""}
              </DialogTitle>
              <DialogDescription>
                Update customer, items, and details, then save.
              </DialogDescription>
            </DialogHeader>

            {/* Edit Form */}
            <div className="grid gap-6 md:grid-cols-3">
              {/* Left: Form */}
              <div className="md:col-span-2 space-y-6">
                <div className="space-y-4 border rounded-lg p-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_customer">Customer *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="edit_customer"
                        placeholder="Enter customer name or select from list"
                        value={editForm.customer_name}
                        onChange={(e) => {
                          setEditForm((p) => ({ ...p, customer_name: e.target.value }))
                          if (editForm.customer_id) setEditForm((p) => ({ ...p, customer_id: "" }))
                        }}
                      />
                      <Button type="button" variant="outline" onClick={() => setShowCustomerSelector(true)}>
                        Select
                      </Button>
                      {editForm.customer_id && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditForm((p) => ({ ...p, customer_id: "", customer_name: "" }))}
                          title="Clear selection"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {editForm.customer_id ? (
                      <p className="text-xs text-muted-foreground">Customer selected from database</p>
                    ) : editForm.customer_name ? (
                      <p className="text-xs text-muted-foreground">Walk-in customer</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_valid_until">Valid Until *</Label>
                    <Input
                      id="edit_valid_until"
                      type="date"
                      value={editForm.valid_until}
                      onChange={(e) => setEditForm((p) => ({ ...p, valid_until: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="border rounded-lg">
                  <div className="flex items-center justify-between p-4">
                    <h4 className="font-semibold">Items</h4>
                    <Button type="button" variant="outline" onClick={() => setShowProductSelector(true)}>
                      <Plus className="h-4 w-4 mr-2" /> Add Item
                    </Button>
                  </div>
                  <div className="p-4 pt-0">
                    {editItems.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No items added</p>
                        <Button type="button" variant="outline" className="mt-4" onClick={() => setShowProductSelector(true)}>
                          <Plus className="h-4 w-4 mr-2" /> Add First Item
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {editItems.map((item) => (
                          <div key={item.id} className="flex items-center gap-4 p-4 border rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium">{item.product_name}</p>
                              <p className="text-sm text-muted-foreground">{formatCurrency(item.price, currentBusiness)} each</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button type="button" variant="outline" size="icon" onClick={() => updateEditQuantity(item.id, item.quantity - 1)}>-</Button>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateEditQuantity(item.id, parseInt(e.target.value) || 1)}
                                className="w-20 text-center"
                              />
                              <Button type="button" variant="outline" size="icon" onClick={() => updateEditQuantity(item.id, item.quantity + 1)}>+</Button>
                            </div>
                            <div className="w-24 text-right">
                              <p className="font-semibold">{formatCurrency(item.total, currentBusiness)}</p>
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeEditItem(item.id)}>
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <Label htmlFor="edit_notes">Notes</Label>
                  <Textarea id="edit_notes" rows={4} placeholder="Add notes..." value={editForm.notes} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>

              {/* Right: Summary */}
              <div className="space-y-6">
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold">Summary</h4>
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{formatCurrency(editSubtotal, currentBusiness)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="font-medium">{formatCurrency(editDiscount, currentBusiness)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="font-medium">{formatCurrency(editTax, currentBusiness)}</span></div>
                  <div className="border-t pt-3 flex justify-between"><span className="font-semibold">Total</span><span className="text-lg font-bold">{formatCurrency(editTotal, currentBusiness)}</span></div>
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowEditDialog(false)}>Cancel</Button>
                  <Button type="button" className="flex-1" onClick={saveEdit} disabled={isSavingEdit}>{isSavingEdit ? "Saving..." : "Save Changes"}</Button>
                </div>
              </div>
            </div>

            {/* Modals used inside Edit */}
            <SelectProductModal
              open={showProductSelector}
              onOpenChange={setShowProductSelector}
              onSelect={addEditProduct}
              outletId={currentOutlet?.id ? String(currentOutlet.id) : undefined}
            />

            <CustomerSelectModal
              open={showCustomerSelector}
              onOpenChange={setShowCustomerSelector}
              onSelect={onSelectCustomer}
            />
          </DialogContent>
        </Dialog>

        {/* View Quotation Dialog */}
        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Quotation - {selectedQuotation?.quotation_number}
              </DialogTitle>
              <DialogDescription>
                Created on {selectedQuotation ? format(new Date(selectedQuotation.created_at), "MMM dd, yyyy") : ""}
              </DialogDescription>
            </DialogHeader>
            
            {selectedQuotation && (
              <div className="space-y-6 py-4">
                {/* Quotation Preview */}
                <div className="bg-white dark:bg-gray-900 p-8 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                  {/* Store/Business Header */}
                  <div className="text-center mb-6 pb-6 border-b border-dashed">
                    <h2 className="text-2xl font-bold">{currentBusiness?.name || "Business Name"}</h2>
                    {currentBusiness?.address && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {currentBusiness.address}
                      </p>
                    )}
                    <div className="flex items-center justify-center gap-4 mt-2 text-sm text-muted-foreground">
                      {currentBusiness?.phone && (
                        <p>Phone: {currentBusiness.phone}</p>
                      )}
                      {currentBusiness?.email && (
                        <p>Email: {currentBusiness.email}</p>
                      )}
                    </div>
                    {currentOutlet && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Outlet: {currentOutlet.name}
                      </p>
                    )}
                    <div className="mt-4">
                      <Badge variant="outline" className="text-lg px-4 py-1">
                        QUOTATION
                      </Badge>
                    </div>
                  </div>

                  {/* Quotation Details */}
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <p className="text-sm text-muted-foreground">Quotation To:</p>
                      <p className="font-semibold mt-1">
                        {selectedQuotation.customer_name || "Customer Name"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Date:</p>
                      <p className="font-semibold mt-1">
                        {format(new Date(selectedQuotation.created_at), "MMM dd, yyyy")}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">Valid Until:</p>
                      <p className="font-semibold mt-1">
                        {format(new Date(selectedQuotation.valid_until), "MMM dd, yyyy")}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">Status:</p>
                      <p className="font-semibold mt-1">
                        {getStatusBadge(selectedQuotation)}
                      </p>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="mb-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedQuotation.items?.map((item, index) => (
                          <TableRow key={item.id || index}>
                            <TableCell className="font-medium">{item.product_name}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.price, currentBusiness)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(item.total, currentBusiness)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Totals */}
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">
                        {formatCurrency(selectedQuotation.subtotal, currentBusiness)}
                      </span>
                    </div>
                    {selectedQuotation.discount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Discount</span>
                        <span className="font-medium text-green-600">
                          -{formatCurrency(selectedQuotation.discount, currentBusiness)}
                        </span>
                      </div>
                    )}
                    {selectedQuotation.tax > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tax</span>
                        <span className="font-medium">
                          {formatCurrency(selectedQuotation.tax, currentBusiness)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-2 border-t">
                      <span>Total</span>
                      <span>{formatCurrency(selectedQuotation.total, currentBusiness)}</span>
                    </div>
                  </div>

                  {/* Notes */}
                  {selectedQuotation.notes && (
                    <div className="mt-6 pt-6 border-t">
                      <p className="text-sm font-semibold mb-2">Notes:</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {selectedQuotation.notes}
                      </p>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="mt-8 pt-6 border-t text-center text-xs text-muted-foreground">
                    <p>This quotation is valid until {format(new Date(selectedQuotation.valid_until), "MMMM dd, yyyy")}</p>
                    <p className="mt-1">Thank you for your business!</p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Quotation?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this quotation? This action cannot be undone.
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
    </DashboardLayout>
  )
}

