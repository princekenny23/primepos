"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FilterableTabs, TabsContent, type TabConfig } from "@/components/ui/filterable-tabs"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { useState, useMemo, useRef } from "react"
import { ArrowLeft, Plus, X, Download, Printer, FileText, Eye } from "lucide-react"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils/currency"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { quotationService, type QuotationItem } from "@/lib/services/quotationService"
import { ProductSelectionOrchestrator, type ProductSelectionResult } from "@/components/modals/product-selection-orchestrator"
import { CustomerSelectModal } from "@/components/modals/customer-select-modal"
import type { Product } from "@/lib/types"
import type { Customer } from "@/lib/services/customerService"

export default function NewQuotationPage() {
  const { currentBusiness } = useBusinessStore()
  const { currentOutlet } = useTenant()
  const { toast } = useToast()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("create")
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Set default valid until date (30 days from now)
  const defaultValidUntil = new Date()
  defaultValidUntil.setDate(defaultValidUntil.getDate() + 30)
  const defaultValidUntilStr = defaultValidUntil.toISOString().split("T")[0]

  const [formData, setFormData] = useState({
    customer_id: "",
    customer_name: "",
    valid_until: defaultValidUntilStr,
    notes: "",
  })
  const [items, setItems] = useState<QuotationItem[]>([])
  const [showProductSelector, setShowProductSelector] = useState(false)
  const [showCustomerSelector, setShowCustomerSelector] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.total, 0)
  const discount = 0 // TODO: Add discount field
  const tax = 0 // TODO: Calculate tax
  const total = subtotal - discount + tax

  // Tabs configuration
  const tabsConfig: TabConfig[] = useMemo(() => [
    {
      value: "create",
      label: "Create Quotation",
      icon: FileText,
    },
    {
      value: "preview",
      label: "Preview",
      icon: Eye,
      badgeCount: items.length > 0 ? undefined : 0,
    },
  ], [items.length])

  // Handle tab change with validation
  const handleTabChange = (value: string) => {
    if (value === "preview" && items.length === 0) {
      toast({
        title: "No Items",
        description: "Please add at least one item before previewing.",
        variant: "destructive",
      })
      return
    }
    setActiveTab(value)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleAddItem = () => {
    setShowProductSelector(true)
  }

  const handleSelectProduct = (result: ProductSelectionResult) => {
    console.log("🎯 Product selected from orchestrator:", result)
    
    const { product, unit } = result
    
    // Calculate price - use unit price if available, otherwise product price
    const price = unit?.retail_price || 
                  (product as any).retail_price || 
                  product.price || 0
    
    console.log("💰 Calculated price:", price)
    
    // Build product name with unit info
    let productName = product.name || ""
    if (unit) {
      productName += ` - ${unit.unit_name}`
    }
    
    console.log("📝 Product name:", productName)
    
    const newItem: QuotationItem = {
      id: Date.now().toString(),
      product_id: product.id,
      product_name: productName,
      quantity: result.quantity || 1,
      price,
      total: price * (result.quantity || 1),
      // Store additional data for reference
      unit_id: unit?.id,
      unit_name: unit?.unit_name,
    } as any
    
    console.log("✅ New item created:", newItem)
    console.log("📋 Current items before adding:", items)
    
    setItems(prev => {
      const updated = [...prev, newItem]
      console.log("📋 Updated items:", updated)
      return updated
    })
  }

  const handleSelectCustomer = (customer: Customer | null) => {
    if (customer) {
      setFormData(prev => ({
        ...prev,
        customer_id: customer.id,
        customer_name: customer.name,
      }))
    } else {
      // New customer - just clear customer_id
      setFormData(prev => ({
        ...prev,
        customer_id: "",
      }))
    }
  }

  const handleRemoveItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId))
  }

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    if (quantity < 1) return
    setItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, quantity, total: item.price * quantity }
        : item
    ))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentOutlet) {
      toast({
        title: "Validation Error",
        description: "Please select an outlet.",
        variant: "destructive",
      })
      return
    }

    if (!formData.customer_id && !formData.customer_name) {
      toast({
        title: "Validation Error",
        description: "Please select or enter a customer.",
        variant: "destructive",
      })
      return
    }

    if (items.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one item to the quotation.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      // Ensure outlet ID is properly formatted
      const outletId = typeof currentOutlet.id === "string" ? parseInt(currentOutlet.id) : currentOutlet.id
      
      const quotationData = {
        outlet: outletId,
        customer_id: formData.customer_id || undefined,
        customer_name: formData.customer_name || undefined,
        items: items.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        })),
        subtotal,
        discount,
        tax,
        total,
        valid_until: formData.valid_until,
        notes: formData.notes || undefined,
      }

      console.log("Creating quotation with data:", quotationData)
      const result = await quotationService.create(quotationData)
      console.log("Quotation created successfully:", result)

      toast({
        title: "Quotation Created",
        description: "Quotation has been created successfully.",
      })
      router.push("/dashboard/office/quotations")
    } catch (error: any) {
      console.error("Failed to create quotation:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create quotation. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle print quotation
  const handlePrint = () => {
    handleDownload()
  }

  // Handle download quotation as PDF
  const handleDownload = async () => {
    if (items.length === 0) {
      toast({
        title: "Error",
        description: "No items to download.",
        variant: "destructive",
      })
      return
    }

    try {
      // Dynamically import jsPDF and html2canvas
      const [{ default: jsPDF }, html2canvas] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ])

      if (!previewRef.current) {
        toast({
          title: "Error",
          description: "Preview content not found. Please switch to preview tab first.",
          variant: "destructive",
        })
        return
      }

      // Show loading toast
      toast({
        title: "Generating PDF",
        description: "Please wait while we generate your quotation PDF...",
      })

      // Capture the preview content as canvas
      const canvas = await html2canvas.default(previewRef.current, {
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      } as any)

      // Calculate PDF dimensions
      const imgWidth = 210 // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const pdf = new jsPDF("p", "mm", "a4")
      
      // Add image to PDF
      const imgData = canvas.toDataURL("image/png")
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight)

      // Generate filename
      const filename = `Quotation-${formData.customer_name || "Customer"}-${format(new Date(), "yyyy-MM-dd")}.pdf`

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
      <PageLayout
        title="Create Quotation"
        description="Create a new customer quotation"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/dashboard/office/quotations">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            {items.length > 0 && activeTab === "preview" && (
              <>
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </>
            )}
          </div>
        }
      >

        {/* Tabs */}
        <FilterableTabs
          tabs={tabsConfig}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          className="space-y-4"
        >

          {/* Create Quotation Tab */}
          <TabsContent value="create">
            <form onSubmit={handleSubmit}>
          <div className="grid gap-6 md:grid-cols-3">
            {/* Left Column - Form */}
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Customer Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer">Customer *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="customer"
                        placeholder="Enter customer name or select from list"
                        value={formData.customer_name}
                        onChange={(e) => {
                          handleInputChange("customer_name", e.target.value)
                          // Clear customer_id when manually typing (walk-in customer)
                          if (formData.customer_id) {
                            handleInputChange("customer_id", "")
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowCustomerSelector(true)}
                      >
                        Select
                      </Button>
                      {formData.customer_id && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            handleInputChange("customer_id", "")
                            handleInputChange("customer_name", "")
                          }}
                          title="Clear selection"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {formData.customer_id ? (
                      <p className="text-xs text-muted-foreground">
                        Customer selected from database
                      </p>
                    ) : formData.customer_name ? (
                      <p className="text-xs text-muted-foreground">
                        Walk-in customer
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="valid_until">Valid Until *</Label>
                    <Input
                      id="valid_until"
                      type="date"
                      value={formData.valid_until || defaultValidUntilStr}
                      onChange={(e) => handleInputChange("valid_until", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Items</CardTitle>
                    <Button type="button" variant="outline" onClick={handleAddItem}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No items added</p>
                      <Button type="button" variant="outline" className="mt-4" onClick={handleAddItem}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Item
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center gap-4 p-4 border rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium">{item.product_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(item.price, currentBusiness)} each
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleUpdateQuantity(item.id!, item.quantity - 1)}
                            >
                              -
                            </Button>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateQuantity(item.id!, parseInt(e.target.value) || 1)}
                              className="w-20 text-center"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleUpdateQuantity(item.id!, item.quantity + 1)}
                            >
                              +
                            </Button>
                          </div>
                          <div className="w-24 text-right">
                            <p className="font-semibold">
                              {formatCurrency(item.total, currentBusiness)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(item.id!)}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Add any notes or terms..."
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    rows={4}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Summary */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">
                      {formatCurrency(subtotal, currentBusiness)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="font-medium">
                      {formatCurrency(discount, currentBusiness)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-medium">
                      {formatCurrency(tax, currentBusiness)}
                    </span>
                  </div>
                  <div className="border-t pt-4 flex justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold">
                      {formatCurrency(total, currentBusiness)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-4">
                <Link href="/dashboard/office/quotations" className="flex-1">
                  <Button type="button" variant="outline" className="w-full">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" className="flex-1" disabled={isSubmitting || items.length === 0}>
                  {isSubmitting ? "Creating..." : "Create Quotation"}
                </Button>
              </div>
            </div>
          </div>
            </form>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Quotation Preview</CardTitle>
                <CardDescription>Preview how the quotation will look</CardDescription>
              </CardHeader>
              <CardContent>
                <div 
                  ref={previewRef}
                  className="bg-white dark:bg-gray-900 p-8 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 print:border-0 print:shadow-none"
                >
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
                        {formData.customer_name || "Customer Name"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Date:</p>
                      <p className="font-semibold mt-1">
                        {format(new Date(), "MMM dd, yyyy")}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">Valid Until:</p>
                      <p className="font-semibold mt-1">
                        {formData.valid_until ? format(new Date(formData.valid_until), "MMM dd, yyyy") : "N/A"}
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
                        {items.map((item) => (
                          <TableRow key={item.id}>
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
                        {formatCurrency(subtotal, currentBusiness)}
                      </span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Discount</span>
                        <span className="font-medium text-green-600">
                          -{formatCurrency(discount, currentBusiness)}
                        </span>
                      </div>
                    )}
                    {tax > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tax</span>
                        <span className="font-medium">
                          {formatCurrency(tax, currentBusiness)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-2 border-t">
                      <span>Total</span>
                      <span>{formatCurrency(total, currentBusiness)}</span>
                    </div>
                  </div>

                  {/* Notes */}
                  {formData.notes && (
                    <div className="mt-6 pt-6 border-t">
                      <p className="text-sm font-semibold mb-2">Notes:</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {formData.notes}
                      </p>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="mt-8 pt-6 border-t text-center text-xs text-muted-foreground">
                    <p>This quotation is valid until {formData.valid_until ? format(new Date(formData.valid_until), "MMMM dd, yyyy") : "N/A"}</p>
                    <p className="mt-1">Thank you for your business!</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </FilterableTabs>

        {/* Modals */}
        <ProductSelectionOrchestrator
          open={showProductSelector}
          onOpenChange={setShowProductSelector}
          onComplete={handleSelectProduct}
          outletId={currentOutlet?.id ? String(currentOutlet.id) : undefined}
          saleType="retail"
        />

        <CustomerSelectModal
          open={showCustomerSelector}
          onOpenChange={setShowCustomerSelector}
          onSelect={handleSelectCustomer}
        />
      </PageLayout>
      </div>
    </DashboardLayout>
  )
}

