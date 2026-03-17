"use client"

import { AuthLayout } from "@/components/layouts/auth-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter } from "next/navigation"
import { Building2, ArrowRight, AlertCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { TermsConditionsModal } from "@/components/modals/terms-conditions-modal"
import { useAuthStore } from "@/stores/authStore"
import { useBusinessStore } from "@/stores/businessStore"
import { tenantService } from "@/lib/services/tenantService"
import { authService } from "@/lib/services/authService"
import type { BusinessType, POSType } from "@/lib/types"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function SetupBusinessPage() {
  const router = useRouter()
  const { user, setUser } = useAuthStore()
  const { setCurrentBusiness, loadBusinesses } = useBusinessStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    businessName: "",
    businessType: "" as BusinessType | "",
    posType: "standard" as POSType,
    email: "",
    phone: "",
    address: "",
    taxId: "",
    currency: "MWK",
    currencySymbol: "MWK",
  })

  useEffect(() => {
    if (!user) {
      router.push("/auth/login")
    }
  }, [user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    if (!acceptedTerms) {
      setShowTerms(true)
      return
    }

    if (!formData.businessName || !formData.businessType || !formData.posType) {
      setError("Please fill in all required fields")
      return
    }

    if (!user) {
      setError("Please login first")
      return
    }

    setIsLoading(true)
    
    try {
      // Create business (tenant) via API
      const business = await tenantService.create({
        name: formData.businessName,
        type: formData.businessType,
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
          ...(formData.taxId && { taxId: formData.taxId }),
        } as any, // taxId can be in settings but not in type
      })
      
      // Update user's tenant association
      try {
        const updatedUser = await authService.getCurrentUser()
        if (updatedUser) {
          setUser(updatedUser)
        }
      } catch (error) {
        console.warn("Could not refresh user data:", error)
      }
      
      // Set current business and load
      await loadBusinesses()
      await setCurrentBusiness(business.id)
      
      setIsLoading(false)
      router.push("/onboarding/setup-outlet")
    } catch (err: any) {
      console.error("Error creating business:", err)
      setError(err.message || "Failed to create business. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout>
      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-8 w-8 text-primary" />
            <CardTitle className="text-2xl">Setup Your Business</CardTitle>
          </div>
          <CardDescription>
            Let&apos;s get started by setting up your business profile
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="business-name">Business Name *</Label>
              <Input 
                id="business-name" 
                type="text" 
                placeholder="Enter your business name"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-type">Business Type *</Label>
              <Select 
                value={formData.businessType}
                onValueChange={(value) => setFormData({ ...formData, businessType: value as BusinessType })}
                required
              >
                <SelectTrigger id="business-type">
                  <SelectValue placeholder="Select business type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wholesale and retail">Wholesale and Retail</SelectItem>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                  <SelectItem value="bar">Bar/Nightclub</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only wholesale and retail, restaurant, and bar are supported at this time
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pos-type">POS Type *</Label>
              <Select 
                value={formData.posType}
                onValueChange={(value) => setFormData({ ...formData, posType: value as POSType })}
                required
              >
                <SelectTrigger id="pos-type">
                  <SelectValue placeholder="Select POS type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard POS</SelectItem>
                  <SelectItem value="single_product">Single-Product POS</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Standard POS: For businesses with multiple products, categories, and cart-based checkout.
                <br />
                Single-Product POS: For businesses that mainly sell one product in high volume (e.g., maize, rice, juice) with multiple selling units and fast quantity-first checkout.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency *</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => {
                  const symbols: Record<string, string> = {
                    MWK: "MWK",
                    USD: "$",
                    EUR: "€",
                    GBP: "£",
                  }
                  setFormData({
                    ...formData,
                    currency: value,
                    currencySymbol: symbols[value] || "MWK",
                  })
                }}
                required
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

            <div className="space-y-2">
              <Label htmlFor="business-email">Business Email</Label>
              <Input 
                id="business-email" 
                type="email" 
                placeholder="business@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-phone">Business Phone</Label>
              <Input 
                id="business-phone" 
                type="tel" 
                placeholder="+265 123 456 789"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-address">Business Address</Label>
              <Input 
                id="business-address" 
                type="text" 
                placeholder="123 Main Street"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax-id">Tax ID / Registration Number</Label>
              <Input 
                id="tax-id" 
                type="text" 
                placeholder="Optional"
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
              />
            </div>

            <div className="flex items-start gap-2 pt-4">
              <input
                type="checkbox"
                id="accept-terms"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1"
                aria-label="Accept terms and conditions"
                required
              />
              <Label htmlFor="accept-terms" className="text-sm cursor-pointer">
                I agree to the{" "}
                <button
                  type="button"
                  onClick={() => setShowTerms(true)}
                  className="text-primary hover:underline"
                >
                  Terms & Conditions
                </button>
                {" "}and{" "}
                <button
                  type="button"
                  onClick={() => setShowTerms(true)}
                  className="text-primary hover:underline"
                >
                  Privacy Policy
                </button>
              </Label>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating Business..." : "Continue"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Step 1 of 3 - Business Setup
            </p>
          </CardFooter>
        </form>
      </Card>

      <TermsConditionsModal 
        open={showTerms} 
        onOpenChange={setShowTerms}
        onAccept={() => {
          setAcceptedTerms(true)
          setShowTerms(false)
        }}
      />
    </AuthLayout>
  )
}

