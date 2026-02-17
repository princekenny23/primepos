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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { BusinessType, POSType } from "@/lib/types"
import { useAuthStore } from "@/stores/authStore"
import { tenantService } from "@/lib/services/tenantService"
import { outletService } from "@/lib/services/outletService"
import { buildOutletSettings, normalizeOutletBusinessType } from "@/lib/utils/outlet-business-type"
import { userService } from "@/lib/services/userService"

interface CreateBusinessModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBusinessCreated: () => void
}

export function CreateBusinessModal({
  open,
  onOpenChange,
  onBusinessCreated,
}: CreateBusinessModalProps) {
  const { user } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  
  const [formData, setFormData] = useState({
    businessName: "",
    businessType: "" as BusinessType | "",
    posType: "standard" as POSType,
    currency: "MWK",
    currencySymbol: "MK",
    phone: "",
    email: "",
    address: "",
    outletName: "",
    outletAddress: "",
    outletPhone: "",
    ownerEmail: "",
    ownerName: "",
  })
  
  const handleSubmit = async () => {
    if (!user) return
    
    setIsLoading(true)
    
    try {
      let business, outlet
      
      // ALWAYS use real API
      // Step 1: Create tenant (business)
      business = await tenantService.create({
        name: formData.businessName,
        type: formData.businessType as BusinessType,
        posType: formData.posType,
        currency: formData.currency,
        currencySymbol: formData.currencySymbol,
        phone: formData.phone || "",
        email: formData.email || "",
        address: formData.address || "",
        settings: {
          posMode: formData.businessType === "restaurant" ? "restaurant" : 
                   formData.businessType === "bar" ? "bar" : "standard",
          receiptTemplate: "standard",
          taxEnabled: false,
          taxRate: 0,
        },
      })
      
      // Step 2: Create outlet for the tenant
      outlet = await outletService.create({
        businessId: business.id,
        name: formData.outletName || `${business.name} - Main`,
        address: formData.outletAddress || "",
        phone: formData.outletPhone || "",
        businessType: normalizeOutletBusinessType(business.type),
        settings: buildOutletSettings(business.settings, business.type),
        isActive: true,
      })
      
      // Step 3: Create owner user if email provided
      if (formData.ownerEmail) {
        try {
          const userResult = await userService.create({
            email: formData.ownerEmail,
            name: formData.ownerName || formData.ownerEmail.split('@')[0],
            role: "admin",
            tenant: business.id,
          })
          
          console.log("Owner user created:", userResult.user.email)
          if (userResult.temporary_password) {
            console.warn("Temporary password generated:", userResult.temporary_password)
            // In production, send this via email instead of logging
          }
        } catch (error) {
          console.error("Failed to create owner user:", error)
          // Continue anyway - business and outlet were created successfully
        }
      }
      
      // Reset form
      setFormData({
        businessName: "",
        businessType: "" as BusinessType | "",
        posType: "standard" as POSType,
        currency: "MWK",
        currencySymbol: "MK",
        phone: "",
        email: "",
        address: "",
        outletName: "",
        outletAddress: "",
        outletPhone: "",
        ownerEmail: "",
        ownerName: "",
      })
      setStep(1)
      onBusinessCreated()
      onOpenChange(false)
    } catch (error) {
      console.error("Error creating business:", error)
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleNext = () => {
    if (step < 3) {
      setStep((step + 1) as 1 | 2 | 3)
    }
  }
  
  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as 1 | 2 | 3)
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Business</DialogTitle>
          <DialogDescription>
            Step {step} of 3: {
              step === 1 && "Business Information"
            }
            {step === 2 && "Contact & Outlet"}
            {step === 3 && "Owner Account"}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Step 1: Business Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name *</Label>
                <Input
                  id="businessName"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  placeholder="My Business"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessType">Business Type *</Label>
                <Select
                  value={formData.businessType}
                  onValueChange={(value) => setFormData({ ...formData, businessType: value as BusinessType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select business type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wholesale and retail">Wholesale and Retail</SelectItem>
                    <SelectItem value="restaurant">Restaurant</SelectItem>
                    <SelectItem value="bar">Bar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="posType">POS Type *</Label>
                <Select
                  value={formData.posType}
                  onValueChange={(value) => setFormData({ ...formData, posType: value as POSType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select POS type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard POS</SelectItem>
                    <SelectItem value="single_product">Single-Product POS</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Standard POS: Multiple products with cart-based checkout.
                  <br />
                  Single-Product POS: One product with fast quantity-first checkout.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency *</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => {
                    const symbols: Record<string, string> = {
                      MWK: "MK",
                      USD: "$",
                      EUR: "€",
                      GBP: "£",
                    }
                    setFormData({
                      ...formData,
                      currency: value,
                      currencySymbol: symbols[value] || "MK",
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MWK">MWK - Malawian Kwacha</SelectItem>
                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                    <SelectItem value="GBP">GBP - British Pound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          {/* Step 2: Contact & Outlet */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Business Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="business@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Business Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+265 123 456 789"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Business Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="123 Main Street"
                />
              </div>
              <div className="border-t pt-4">
                <h4 className="font-medium mb-4">First Outlet</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="outletName">Outlet Name</Label>
                    <Input
                      id="outletName"
                      value={formData.outletName}
                      onChange={(e) => setFormData({ ...formData, outletName: e.target.value })}
                      placeholder="Main Store"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="outletAddress">Outlet Address</Label>
                    <Input
                      id="outletAddress"
                      value={formData.outletAddress}
                      onChange={(e) => setFormData({ ...formData, outletAddress: e.target.value })}
                      placeholder="123 Main Street"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="outletPhone">Outlet Phone</Label>
                    <Input
                      id="outletPhone"
                      value={formData.outletPhone}
                      onChange={(e) => setFormData({ ...formData, outletPhone: e.target.value })}
                      placeholder="+265 123 456 789"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Step 3: Owner Account */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create an owner account for this business (optional). The owner will be able to login and manage their business.
              </p>
              <div className="space-y-2">
                <Label htmlFor="ownerName">Owner Name</Label>
                <Input
                  id="ownerName"
                  value={formData.ownerName}
                  onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerEmail">Owner Email</Label>
                <Input
                  id="ownerEmail"
                  type="email"
                  value={formData.ownerEmail}
                  onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                  placeholder="owner@example.com"
                />
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <div className="flex justify-between w-full">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={step === 1}
            >
              Back
            </Button>
            {step < 3 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={
                  (step === 1 && (!formData.businessName || !formData.businessType || !formData.posType))
                }
              >
                Next
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? "Creating..." : "Create Business"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

