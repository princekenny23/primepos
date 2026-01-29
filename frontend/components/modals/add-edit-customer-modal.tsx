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
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { User, Mail, Phone, MapPin, CreditCard, FileText } from "lucide-react"
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { customerService, type Customer } from "@/lib/services/customerService"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"
import { useI18n } from "@/contexts/i18n-context"

interface AddEditCustomerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer?: Customer | null
  onSuccess?: (customer?: Customer) => void
}

export function AddEditCustomerModal({ open, onOpenChange, customer, onSuccess }: AddEditCustomerModalProps) {
  const { toast } = useToast()
  const { currentBusiness } = useBusinessStore()
  const { outlets } = useTenant()
  const { t } = useI18n()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    outlet_id: "",
    // Credit fields
    credit_enabled: false,
    credit_limit: "",
    payment_terms_days: "30",
    credit_status: "active" as "active" | "suspended" | "closed",
    credit_notes: "",
  })

  useEffect(() => {
    if (open) {
      if (customer) {
        // Edit mode
        setFormData({
          name: customer.name || "",
          email: customer.email || "",
          phone: customer.phone || "",
          address: customer.address || "",
          outlet_id: String(customer.outlet_id || customer.outlet || ""),
          credit_enabled: customer.credit_enabled || false,
          credit_limit: customer.credit_limit?.toString() || "",
          payment_terms_days: customer.payment_terms_days?.toString() || "30",
          credit_status: (customer.credit_status as "active" | "suspended" | "closed") || "active",
          credit_notes: customer.credit_notes || "",
        })
      } else {
        // Add mode
        setFormData({
          name: "",
          email: "",
          phone: "",
          address: "",
          outlet_id: "",
          credit_enabled: false,
          credit_limit: "",
          payment_terms_days: "30",
          credit_status: "active",
          credit_notes: "",
        })
      }
    }
  }, [open, customer])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentBusiness) {
      toast({
        title: "Error",
        description: "No business selected.",
        variant: "destructive",
      })
      return
    }

    // Validation
    if (!formData.name) {
      toast({
        title: "Validation Error",
        description: "Customer name is required.",
        variant: "destructive",
      })
      return
    }

    if (formData.credit_enabled && (!formData.credit_limit || parseFloat(formData.credit_limit) <= 0)) {
      toast({
        title: "Validation Error",
        description: "Credit limit is required when credit is enabled.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const customerData: Partial<Customer> = {
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        outlet_id: formData.outlet_id || undefined,
        credit_enabled: formData.credit_enabled,
        credit_limit: formData.credit_enabled ? parseFloat(formData.credit_limit) : undefined,
        payment_terms_days: formData.credit_enabled ? parseInt(formData.payment_terms_days) : undefined,
        credit_status: formData.credit_enabled ? formData.credit_status : undefined,
        credit_notes: formData.credit_notes || undefined,
        is_active: true,
      }

      let savedCustomer: Customer | undefined

      if (customer) {
        // Update existing customer
        savedCustomer = await customerService.update(customer.id, customerData)
        toast({
          title: "Customer Updated",
          description: "Customer has been updated successfully.",
        })
      } else {
        // Create new customer
        savedCustomer = await customerService.create(customerData)
        toast({
          title: "Customer Added",
          description: "Customer has been added successfully.",
        })
      }

      onOpenChange(false)
      if (onSuccess) {
        onSuccess(savedCustomer)
      }
    } catch (error: any) {
      console.error("Failed to save customer:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to save customer. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {customer ? "Edit Customer" : "Add Customer"}
          </DialogTitle>
          <DialogDescription>
            {customer ? "Update customer information" : "Add a new customer to your system"}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Basic Information</TabsTrigger>
              <TabsTrigger value="credit">Credit Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Customer Name *</Label>
                  <Input
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t("customers.modal.name_placeholder")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      className="pl-10"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder={t("customers.modal.email_placeholder")}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      className="pl-10"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder={t("customers.modal.phone_placeholder")}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="outlet">Outlet (Optional)</Label>
                  <Select
                    value={formData.outlet_id || "none"}
                    onValueChange={(value) => setFormData({ ...formData, outlet_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("customers.modal.outlet_placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific outlet</SelectItem>
                      {outlets.filter(o => o.isActive).map(outlet => (
                        <SelectItem key={outlet.id} value={outlet.id}>
                          {outlet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <textarea
                      id="address"
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder={t("customers.modal.address_placeholder")}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="credit" className="space-y-4 py-4">
              <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="credit_enabled" className="text-base font-semibold">Enable Credit</Label>
                    <p className="text-sm text-muted-foreground">Allow this customer to make credit purchases</p>
                  </div>
                  <Switch
                    id="credit_enabled"
                    checked={formData.credit_enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, credit_enabled: checked })}
                  />
                </div>
              </div>

              {formData.credit_enabled && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="credit_limit">Credit Limit *</Label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="credit_limit"
                          type="number"
                          step="0.01"
                          min="0"
                          className="pl-10"
                          required={formData.credit_enabled}
                          value={formData.credit_limit}
                          onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                          placeholder={t("common.amount_placeholder")}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Maximum credit amount for this customer
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="payment_terms_days">Payment Terms *</Label>
                      <Select
                        value={formData.payment_terms_days}
                        onValueChange={(value) => setFormData({ ...formData, payment_terms_days: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">COD (Cash on Delivery)</SelectItem>
                          <SelectItem value="15">Net 15</SelectItem>
                          <SelectItem value="30">Net 30</SelectItem>
                          <SelectItem value="60">Net 60</SelectItem>
                          <SelectItem value="90">Net 90</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Number of days until payment is due
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="credit_status">Credit Status</Label>
                      <Select
                        value={formData.credit_status}
                        onValueChange={(value: "active" | "suspended" | "closed") => 
                          setFormData({ ...formData, credit_status: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="credit_notes">Credit Notes</Label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <textarea
                        id="credit_notes"
                        className="flex min-h-[100px] w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm"
                        value={formData.credit_notes}
                        onChange={(e) => setFormData({ ...formData, credit_notes: e.target.value })}
                        placeholder={t("customers.modal.credit_notes_placeholder")}
                      />
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : customer ? "Update Customer" : "Add Customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
